package tui

import (
	"context"
	"fmt"
	"log"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/data.haus/nospeak/cache"
	"github.com/data.haus/nospeak/client"
	"github.com/data.haus/nospeak/config"
	"github.com/data.haus/nospeak/notification"
	"github.com/gdamore/tcell/v2"
	"github.com/rivo/tview"
)

type App struct {
	app    *tview.Application
	client *client.Client
	config *config.Config

	// UI Components
	mainFlex    *tview.Flex
	sidebar     *tview.Flex
	contactList *tview.List
	chatArea    *tview.Flex
	messageView *tview.TextView
	inputArea   *tview.Flex
	inputField  *tview.InputField
	sendButton  *tview.Button
	statusBar   *tview.TextView

	// State
	currentPartner string
	partners       []string
	profileResolver *client.ProfileResolver
	messageCache   cache.Cache
	connected      bool
	mu             sync.RWMutex

	// Message loading state
	loadedSentCount     int
	loadedReceivedCount int
	hasMoreMessages     bool

	// UI state
	contactsVisible bool

	// Status message
	statusMessage string
	statusMu      sync.RWMutex

	// Unread messages tracking
	unreadMessages map[string]bool
	unreadMu       sync.RWMutex

	// Message formatting
	messageFormatter *MessageFormatter

	// Context
	ctx    context.Context
	cancel context.CancelFunc
}

// setTerminalTitle sets the terminal window title using ANSI escape sequence
func (a *App) setTerminalTitle(contactName string) {
	title := fmt.Sprintf("nospeak: Chat with %s", contactName)
	// ANSI escape sequence to set window title
	fmt.Fprint(os.Stdout, "\033]0;"+title+"\007")
}

// updateTerminalTitle updates the terminal title with the current active contact
func (a *App) updateTerminalTitle() {
	a.mu.RLock()
	currentPartner := a.currentPartner
	a.mu.RUnlock()

	contactName := "None"
	if currentPartner != "" {
		contactName = a.profileResolver.GetDisplayName(currentPartner)
	}

	a.setTerminalTitle(contactName)
}

func NewApp(configPath string) (*App, error) {
	if configPath == "" {
		configPath = config.GetConfigPath()
	}
	cfg, err := config.LoadWithPath(configPath)
	if err != nil {
		return nil, fmt.Errorf("failed to load config: %w", err)
	}

	nostrClient, err := client.NewClient(cfg)
	if err != nil {
		return nil, fmt.Errorf("failed to create client: %w", err)
	}

	ctx, cancel := context.WithCancel(context.Background())

	app := &App{
		app:              tview.NewApplication(),
		client:           nostrClient,
		config:           cfg,
		profileResolver:  client.NewProfileResolver(nostrClient),
		messageCache:     cache.GetCache(),
		contactsVisible:  cfg.ShowContacts,
		unreadMessages:   make(map[string]bool),
		messageFormatter: NewMessageFormatter(),
		ctx:              ctx,
		cancel:           cancel,
	}

	if err := app.setupUI(); err != nil {
		cancel()
		return nil, fmt.Errorf("failed to setup UI: %w", err)
	}

	return app, nil
}

func (a *App) setupUI() error {
	// Apply theme
	tview.Styles = GetTheme()

	// Set transparent background for the application
	a.app.SetBeforeDrawFunc(func(screen tcell.Screen) bool {
		screen.Clear()
		return false
	})

	// Create main layout
	a.mainFlex = tview.NewFlex().SetDirection(tview.FlexRow)
	a.mainFlex.SetBackgroundColor(tcell.ColorDefault)

	// Create status bar
	a.statusBar = tview.NewTextView()
	a.statusBar.SetDynamicColors(true)
	a.statusBar.SetText("[red]Disconnected[white]")
	a.statusBar.SetBackgroundColor(tcell.ColorDefault)
	a.updateStatusBar()

	// Create main content area using grid for better control
	grid := tview.NewGrid()
	grid.SetBackgroundColor(tcell.ColorDefault)
	grid.SetRows(0, 1) // 0 for main content, 1 for input

	// Set columns based on config
	if a.contactsVisible {
		grid.SetColumns(0, 25) // 0 for messages, 25 for contacts
	} else {
		grid.SetColumns(0) // only messages
	}

	// Create sidebar with contact list
	a.sidebar = tview.NewFlex().SetDirection(tview.FlexRow)
	a.sidebar.SetBackgroundColor(tcell.ColorDefault)
	a.contactList = tview.NewList()
	a.contactList.ShowSecondaryText(false)
	a.contactList.SetBorder(true)
	a.contactList.SetTitle("Contacts")
	a.contactList.SetBackgroundColor(tcell.ColorDefault)
	a.contactList.SetSelectedFunc(func(index int, mainText string, secondaryText string, rune rune) {
		a.onContactSelected(index, mainText, secondaryText)
	})

	// Handle arrow key navigation to switch contacts immediately
	a.contactList.SetInputCapture(func(event *tcell.EventKey) *tcell.EventKey {
		switch event.Key() {
		case tcell.KeyUp, tcell.KeyDown:
			// Let the list handle the navigation first
			return event
		case tcell.KeyTab:
			a.app.SetFocus(a.inputField)
			return nil
		default:
			return event
		}
	})

	// Add a callback for when the selection changes
	a.contactList.SetChangedFunc(func(index int, mainText string, secondaryText string, shortcut rune) {
		a.onContactSelected(index, mainText, secondaryText)
	})

	// Handle Tab key directly in contact list
	a.contactList.SetInputCapture(func(event *tcell.EventKey) *tcell.EventKey {
		if event.Key() == tcell.KeyTab {
			a.app.SetFocus(a.inputField)
			return nil // Consume the event
		}
		return event
	})

	// Create chat area
	a.chatArea = tview.NewFlex().SetDirection(tview.FlexRow)
	a.chatArea.SetBackgroundColor(tcell.ColorDefault)

	// Message display area
	a.messageView = tview.NewTextView()
	a.messageView.SetDynamicColors(true)
	a.messageView.SetScrollable(true)
	a.messageView.SetChangedFunc(func() {
		a.messageView.ScrollToEnd()
	})
	a.messageView.SetBorder(true)
	a.messageView.SetTitle("Messages")
	a.messageView.SetBackgroundColor(tcell.ColorDefault)
	a.messageView.SetTextColor(tcell.ColorDefault)

	// Assemble chat area (just messages now)
	a.chatArea.AddItem(a.messageView, 0, 1, false)

	// Create input area (full width, one line high)
	a.inputArea = tview.NewFlex().SetDirection(tview.FlexColumn)
	a.inputArea.SetBackgroundColor(tcell.ColorDefault)
	a.inputArea.SetBorderColor(tcell.ColorDefault)
	a.inputField = tview.NewInputField()
	a.inputField.SetLabel("Message: ")
	a.inputField.SetFieldWidth(0)
	a.inputField.SetFieldTextColor(tcell.ColorDefault)
	a.inputField.SetLabelColor(tcell.ColorDefault)
	a.inputField.SetFieldBackgroundColor(tcell.ColorDefault)
	a.inputField.SetBackgroundColor(tcell.ColorDefault)
	a.inputField.SetDoneFunc(func(key tcell.Key) {
		if key == tcell.KeyEnter {
			a.sendMessage()
		} else if key == tcell.KeyTab {
			if a.contactsVisible {
				a.app.SetFocus(a.contactList)
			}
		}
	})

	a.inputArea.AddItem(a.inputField, 0, 1, true)

	// Assemble grid layout
	grid.AddItem(a.messageView, 0, 0, 1, 1, 0, 0, false) // messages - row 0, col 0

	if a.contactsVisible {
		grid.AddItem(a.contactList, 0, 1, 1, 1, 0, 0, false) // contacts - row 0, col 1
		grid.AddItem(a.inputArea, 1, 0, 1, 2, 0, 0, true)    // input - row 1, span 2 cols
	} else {
		grid.AddItem(a.inputArea, 1, 0, 1, 1, 0, 0, true) // input - row 1, span 1 col
	}

	// Assemble main layout
	a.mainFlex.AddItem(a.statusBar, 1, 0, false)
	a.mainFlex.AddItem(grid, 0, 1, true)

	// Set up keyboard shortcuts
	a.app.SetInputCapture(a.handleGlobalKeys)

	// Set root
	a.app.SetRoot(a.mainFlex, true)

	// Load contacts (basic list without name resolution)
	if err := a.loadContactsBasic(); err != nil {
		return fmt.Errorf("failed to load contacts: %w", err)
	}

	// Set initial focus to input field
	a.app.SetFocus(a.inputField)

	return nil
}

func (a *App) loadContactsBasic() error {
	a.partners = a.client.GetPartnerNpubs()

	// Initialize display names using ProfileResolver
	a.profileResolver.InitializeDisplayNames(a.partners)

	// Populate contact list with cached/fallback names
	a.contactList.Clear()
	if len(a.partners) == 0 {
		// Show helpful message when no partners are configured
		a.contactList.AddItem("[yellow]No chat partners configured[white]", "[gray]Press F2 to add partners[white]", 0, nil)
		a.currentPartner = ""
	} else {
		for i, partner := range a.partners {
			displayName := a.profileResolver.GetDisplayName(partner)
			a.contactList.AddItem(displayName, partner, 0, nil)
			if i == 0 {
				a.currentPartner = partner
				a.contactList.SetCurrentItem(0)
				a.loadChatHistory()
			}
		}
	}

	// Highlight current selection
	a.updateContactListHighlight()

	// Set initial terminal title
	a.updateTerminalTitle()

	return nil
}

func (a *App) loadContacts() error {
	// Get full profiles (now with relay connections established)
	profiles, err := a.client.GetPartnerProfiles(a.ctx, false)
	if err != nil {
		log.Printf("Failed to resolve profiles: %v", err)
		// Use fallback names via ProfileResolver
		a.profileResolver.InitializeDisplayNames(a.partners)
	} else {
		// Update ProfileResolver with fetched profiles
		for npub := range profiles {
			// Cache the profile
			a.profileResolver.GetFullProfile(a.ctx, npub, false)
		}
	}

	// Don't update UI here - let the async caller handle UI updates
	return nil
}

func (a *App) onContactSelected(index int, mainText, secondaryText string) {
	a.mu.RLock()
	partnersLen := len(a.partners)
	a.mu.RUnlock()

	if index >= 0 && index < partnersLen {
		a.mu.Lock()
		a.currentPartner = a.partners[index]
		selectedPartner := a.partners[index]
		a.mu.Unlock()

		// Clear unread status for selected contact
		a.unreadMu.Lock()
		delete(a.unreadMessages, selectedPartner)
		a.unreadMu.Unlock()

		a.loadChatHistory()
		a.updateStatusBar()
		a.updateContactListHighlight()
		a.updateTerminalTitle()
	} else if partnersLen == 0 && index == 0 {
		// Handle selection of "no partners" message
		a.mu.Lock()
		a.currentPartner = ""
		a.mu.Unlock()

		a.messageView.Clear()
		a.messageView.Write([]byte("[yellow]No chat partners configured[white]\n\n[gray]Press F2 to open settings and add partners[white]\n"))
		a.updateStatusBar()
		a.updateTerminalTitle()
	}
}

func (a *App) updateContactListWithNames() {
	if a.config.Debug {
		log.Printf("updateContactListWithNames called")
	}

	a.mu.RLock()
	currentPartner := a.currentPartner
	partners := a.partners
	a.mu.RUnlock()

	// Update contact list with resolved names
	for i, partner := range partners {
		if i < a.contactList.GetItemCount() {
			displayName := a.profileResolver.GetDisplayName(partner)

			a.unreadMu.RLock()
			hasUnread := a.unreadMessages[partner]
			a.unreadMu.RUnlock()

			var prefix string
			if partner == currentPartner {
				// Show current contact with a marker
				prefix = "▶ "
			} else {
				// Show other contacts without marker
				prefix = "  "
			}

			// Add green dot for unread messages
			if hasUnread {
				displayName = displayName + " [green]●[white]"
			}

			a.contactList.SetItemText(i, prefix+displayName, partner)
		}
	}

	// Update terminal title when names are resolved
	a.updateTerminalTitle()
}

func (a *App) updateContactListHighlight() {
	a.updateContactListWithNames()
}

func (a *App) loadChatHistory() {
	a.mu.RLock()
	partner := a.currentPartner
	a.mu.RUnlock()

	if partner == "" {
		return
	}

	// Reset loading state for new contact
	a.loadedSentCount = 10
	a.loadedReceivedCount = 10
	a.hasMoreMessages = true

	messages := a.client.GetMessageHistoryEnhanced(partner, a.loadedSentCount, a.loadedReceivedCount)

	a.messageView.Clear()

	for _, msg := range messages {
		var formatted string
		if msg.Direction == "sent" {
			formatted = a.messageFormatter.FormatMessageEntry(msg, "", true)
		} else {
			// For received messages, RecipientNpub contains the sender's npub
			senderNpub := msg.RecipientNpub
			username := a.profileResolver.GetDisplayName(senderNpub)
			formatted = a.messageFormatter.FormatMessageEntry(msg, username, false)
		}
		a.messageView.Write([]byte(formatted + "\n"))
	}

	a.messageView.ScrollToEnd()
}

func (a *App) loadOlderMessages() {
	a.mu.RLock()
	partner := a.currentPartner
	a.mu.RUnlock()

	if partner == "" || !a.hasMoreMessages {
		return
	}

	// Store current content and scroll position
	currentContent := a.messageView.GetText(false)
	row, col := a.messageView.GetScrollOffset()

	// Load more messages
	newSentCount := a.loadedSentCount + 10
	newReceivedCount := a.loadedReceivedCount + 10

	messages := a.client.GetMessageHistoryEnhanced(partner, newSentCount, newReceivedCount)

	// Check if we got more messages
	if len(messages) <= (a.loadedSentCount + a.loadedReceivedCount) {
		a.hasMoreMessages = false
	}

	a.loadedSentCount = newSentCount
	a.loadedReceivedCount = newReceivedCount

	// Count how many new lines we're adding
	oldLineCount := len(strings.Split(currentContent, "\n"))

	// Rebuild the entire message view
	a.messageView.Clear()

	for _, msg := range messages {
		var formatted string
		if msg.Direction == "sent" {
			formatted = a.messageFormatter.FormatMessageEntry(msg, "", true)
		} else {
			// For received messages, RecipientNpub contains the sender's npub
			senderNpub := msg.RecipientNpub
			username := a.profileResolver.GetDisplayName(senderNpub)
			formatted = a.messageFormatter.FormatMessageEntry(msg, username, false)
		}
		a.messageView.Write([]byte(formatted + "\n"))
	}

	// Calculate new scroll position
	newLineCount := len(strings.Split(a.messageView.GetText(false), "\n"))
	lineDifference := newLineCount - oldLineCount

	// Restore scroll position, adjusted for new content
	newScrollRow := row + lineDifference
	if newScrollRow < 0 {
		newScrollRow = 0
	}
	a.messageView.ScrollTo(newScrollRow, col)
}

func (a *App) scrollMessageUp() {
	row, col := a.messageView.GetScrollOffset()
	if row > 0 {
		a.messageView.ScrollTo(row-1, col)
	} else if row == 0 && a.hasMoreMessages {
		// At the top and there are more messages to load
		a.loadOlderMessages()
	}
}

func (a *App) scrollMessageDown() {
	row, col := a.messageView.GetScrollOffset()
	a.messageView.ScrollTo(row+1, col)
}

func (a *App) switchContact(direction int) {
	a.mu.RLock()
	currentIndex := a.contactList.GetCurrentItem()
	partnersLen := len(a.partners)
	a.mu.RUnlock()

	if partnersLen == 0 {
		return
	}

	// Calculate new index with wrap-around
	newIndex := currentIndex + direction
	if newIndex < 0 {
		newIndex = partnersLen - 1
	} else if newIndex >= partnersLen {
		newIndex = 0
	}

	// Set the new selection
	a.contactList.SetCurrentItem(newIndex)

	// Trigger the selection change
	a.onContactSelected(newIndex, "", "")
}

func (a *App) refreshChatHistory() {
	a.app.QueueUpdate(func() {
		a.loadChatHistory()
	})
}

func (a *App) sendMessage() {
	message := strings.TrimSpace(a.inputField.GetText())
	if message == "" {
		return
	}

	// Check for IRC-style commands
	if strings.HasPrefix(message, "/") {
		a.handleCommand(message)
		a.inputField.SetText("")
		return
	}

	a.mu.RLock()
	partner := a.currentPartner
	a.mu.RUnlock()

	if partner == "" {
		a.showMessage("No contact selected")
		return
	}

	// Display message immediately
	timestamp := time.Now().Format("15:04:05")
	a.messageView.Write([]byte(fmt.Sprintf("[blue]%s[white] [orange]You:[white] %s\n", timestamp, message)))
	a.messageView.ScrollToEnd()
	a.inputField.SetText("")

	// Show sending status
	a.setStatusMessage("sending message...")

	// Send message in background
	go func() {
		err := a.client.SendChatMessage(a.ctx, partner, message, false)

		if err != nil {
			a.app.QueueUpdate(func() {
				a.statusMessage = "sending failed"
				a.updateStatusBar()
				a.app.ForceDraw()
			})
			// Clear status after 3 seconds
			time.Sleep(3 * time.Second)
			a.app.QueueUpdate(func() {
				a.clearStatusMessage()
				a.showMessage(fmt.Sprintf("Failed to send message: %v", err))
				// Remove the failed message from display by reloading
				a.loadChatHistory()
			})
		} else {
			a.app.QueueUpdate(func() {
				a.statusMessage = "sent"
				a.updateStatusBar()
				a.app.ForceDraw()
			})
			// Clear status after 2 seconds
			time.Sleep(2 * time.Second)
			a.app.QueueUpdate(func() {
				a.statusMessage = ""
				a.updateStatusBar()
				a.app.ForceDraw()
			})
		}
	}()
}

func (a *App) handleCommand(command string) {
	parts := strings.Fields(command)
	if len(parts) == 0 {
		return
	}

	switch strings.ToLower(parts[0]) {
	case "/quit":
		a.Stop()
	case "/help":
		a.showHelp()
	default:
		timestamp := time.Now().Format("15:04:05")
		a.messageView.Write([]byte(fmt.Sprintf("[%s] [red]Unknown command:[white] %s\n", timestamp, command)))
		a.messageView.ScrollToEnd()
	}
}

func (a *App) showMessage(text string) {
	modal := tview.NewModal().
		SetText(text).
		AddButtons([]string{"OK"}).
		SetDoneFunc(func(buttonIndex int, buttonLabel string) {
			a.app.SetRoot(a.mainFlex, true)
		})

	a.app.SetRoot(modal, true)
}

func (a *App) updateStatusBar() {
	a.mu.RLock()
	partner := a.currentPartner
	connected := a.connected
	a.mu.RUnlock()

	relayCount := a.client.GetRelayCount()
	status := fmt.Sprintf("[red]%d relays[white]", relayCount)
	if connected && relayCount > 0 {
		status = fmt.Sprintf("[green]%d relays[white]", relayCount)
	}

	partnerName := "None"
	if partner != "" {
		partnerName = a.profileResolver.GetDisplayName(partner)
	}

	a.statusMu.RLock()
	statusMsg := a.statusMessage
	a.statusMu.RUnlock()

	statusText := fmt.Sprintf("%s | [violet]Chat with %s[white]", status, partnerName)
	if statusMsg != "" {
		statusText = fmt.Sprintf("%s | %s", statusText, statusMsg)
	}

	a.statusBar.SetText(statusText)
}

func (a *App) setStatusMessage(message string) {
	a.statusMu.Lock()
	a.statusMessage = message
	a.statusMu.Unlock()
	a.updateStatusBar()
}

func (a *App) clearStatusMessage() {
	a.setStatusMessage("")
}

func (a *App) handleGlobalKeys(event *tcell.EventKey) *tcell.EventKey {
	switch event.Key() {
	case tcell.KeyCtrlC:
		a.Stop()
		return nil
	case tcell.KeyCtrlQ:
		a.Stop()
		return nil
	case tcell.KeyPgUp:
		// Scroll up in message view
		a.scrollMessageUp()
		return nil
	case tcell.KeyPgDn:
		// Scroll down in message view
		a.scrollMessageDown()
		return nil
	case tcell.KeyCtrlJ:
		// Switch to next contact
		a.switchContact(1)
		return nil
	case tcell.KeyCtrlK:
		// Switch to previous contact
		a.switchContact(-1)
		return nil
	case tcell.KeyF1:
		a.showHelp()
		return nil
	case tcell.KeyF2:
		a.showSettings()
		return nil
	case tcell.KeyF3:
		a.toggleContactsPane()
		return nil
	case tcell.KeyCtrlP:
		a.showProfileModal()
		return nil

	}
	return event
}

func (a *App) toggleContactsPane() {
	a.contactsVisible = !a.contactsVisible

	// Find the grid in the main layout
	grid := a.mainFlex.GetItem(1).(*tview.Grid)

	if a.contactsVisible {
		// Show contacts pane
		grid.SetColumns(0, 25)                              // messages, contacts
		grid.AddItem(a.contactList, 0, 1, 1, 1, 0, 0, true) // contacts - row 0, col 1
		grid.AddItem(a.inputArea, 1, 0, 1, 2, 0, 0, true)   // input - row 1, span 2 cols
	} else {
		// Hide contacts pane
		grid.SetColumns(0) // only messages
		grid.RemoveItem(a.contactList)
		grid.AddItem(a.inputArea, 1, 0, 1, 1, 0, 0, true) // input - row 1, span 1 col
	}

	// Always focus on message input
	a.app.SetFocus(a.inputField)
}

func (a *App) showHelp() {
	helpText := `Nospeak TUI Help

 Keyboard Shortcuts:
  Ctrl+C/Ctrl+Q  - Quit application
  Tab            - Switch between contact list and input
  Enter          - Send message (when in input field)
  PgUp/PgDn      - Scroll message pane up/down
  Ctrl+k/j       - Switch between contacts (k=up, j=down)
  Ctrl+p         - Show profile information for current contact
  F1             - Show this help
  F2             - Show settings
  F3             - Toggle contacts pane

Note: Contacts pane visibility can be set in config.toml with "show_contacts" option

Navigation:
  ↑/↓            - Navigate contact list
  Enter          - Select contact

IRC-style Commands:
  /quit          - Quit application
  /help          - Show this help

Type commands in the input field and press Enter to execute.`

	modal := tview.NewModal().
		SetText(helpText).
		AddButtons([]string{"Close"}).
		SetDoneFunc(func(buttonIndex int, buttonLabel string) {
			a.app.SetRoot(a.mainFlex, true)
		})

	a.app.SetRoot(modal, true)
}

func (a *App) refreshPartners() {
	// Get old partners to detect new additions
	oldPartners := make(map[string]bool)
	for _, partner := range a.partners {
		oldPartners[partner] = true
	}

	// Reload partners from config
	a.partners = a.client.GetPartnerNpubs()

	// Detect new partners
	var newPartners []string
	for _, partner := range a.partners {
		if !oldPartners[partner] {
			newPartners = append(newPartners, partner)
			if a.config.Debug {
				log.Printf("New partner detected: %s", partner[:8]+"...")
			}
		}
	}

	// Initialize display names for all partners using ProfileResolver
	a.profileResolver.InitializeDisplayNames(a.partners)

	// Fetch profiles for new partners asynchronously
	if len(newPartners) > 0 {
		if a.config.Debug {
			log.Printf("Fetching profiles for %d new partners", len(newPartners))
		}

		go func() {
			// Use the existing profile fetching mechanism
			err := a.loadContacts()
			if err != nil && a.config.Debug {
				log.Printf("Failed to load contacts: %v", err)
			}

			// Update UI with resolved names (same pattern as initialization)
			a.app.QueueUpdate(func() {
				a.updateContactListWithNames()
				a.updateStatusBar()
				a.updateTerminalTitle()
				a.app.ForceDraw() // Force entire app to redraw
			})
		}()
	}

	// Update contact list
	a.contactList.Clear()
	if len(a.partners) == 0 {
		// Show helpful message when no partners are configured
		a.contactList.AddItem("[yellow]No chat partners configured[white]", "[gray]Press F2 to add partners[white]", 0, nil)
		a.currentPartner = ""
	} else {
		for i, partner := range a.partners {
			displayName := a.profileResolver.GetDisplayName(partner)
			a.contactList.AddItem(displayName, partner, 0, nil)
			if i == 0 && a.currentPartner == "" {
				// Select first partner if none was selected
				a.currentPartner = partner
				a.contactList.SetCurrentItem(0)
				a.loadChatHistory()
			}
		}
	}

	// Update UI
	a.updateContactListHighlight()
	a.updateStatusBar()
	a.updateTerminalTitle()
}

func (a *App) showSettings() {
	settings := NewSettingsModal(a.app, a.config, func() {
		// Settings saved callback - refresh partners
		a.refreshPartners()
		a.app.SetRoot(a.mainFlex, true)
	}, func() {
		// Settings cancelled callback
		a.app.SetRoot(a.mainFlex, true)
	})
	settings.Show()
}

func (a *App) showProfileModal() {
	a.mu.RLock()
	currentPartner := a.currentPartner
	a.mu.RUnlock()

	displayName := a.profileResolver.GetDisplayName(currentPartner)

	if currentPartner == "" {
		a.showMessage("No contact selected")
		return
	}

	// Get profile using ProfileResolver
	metadata, err := a.profileResolver.GetFullProfile(a.ctx, currentPartner, false)

	var profileText string
	if err == nil {
			// Build profile display text
			profileText = fmt.Sprintf("[violet]Profile Information[white]\n\n")

			// Name/Display Name
			if metadata.Name != "" || metadata.DisplayName != "" {
				profileText += fmt.Sprintf("[green]Name:[white]\n")
				if metadata.Name != "" {
					profileText += fmt.Sprintf("  %s", metadata.Name)
					if metadata.DisplayName != "" && metadata.DisplayName != metadata.Name {
						profileText += fmt.Sprintf(" (%s)", metadata.DisplayName)
					}
					profileText += "\n\n"
				} else if metadata.DisplayName != "" {
					profileText += fmt.Sprintf("  %s\n\n", metadata.DisplayName)
				}
			}

			// About section
			if metadata.About != "" {
				profileText += fmt.Sprintf("[green]About:[white]\n  %s\n\n", metadata.About)
			}

			// NIP05
			if metadata.NIP05 != "" {
				profileText += fmt.Sprintf("[green]NIP05:[white]\n  %s\n\n", metadata.NIP05)
			}

			// Lightning address
			if metadata.LUD16 != "" {
				profileText += fmt.Sprintf("[green]Lightning:[white]\n  %s\n\n", metadata.LUD16)
			}

			// Picture URL
			if metadata.Picture != "" {
				profileText += fmt.Sprintf("[green]Picture:[white]\n  %s\n\n", metadata.Picture)
			}
		} else {
			// No profile data available
			profileText = fmt.Sprintf("No profile data available for %s\n\n", displayName)
			profileText += fmt.Sprintf("[yellow]Public Key:[white]\n  %s\n\n", currentPartner)
			profileText += "Profile will be fetched when needed."
		}

	modal := tview.NewModal().
		SetText(profileText).
		AddButtons([]string{"Close"}).
		SetDoneFunc(func(buttonIndex int, buttonLabel string) {
			a.app.SetRoot(a.mainFlex, true)
		})

	modal.SetBackgroundColor(tcell.ColorDefault)

	a.app.SetRoot(modal, true)
}

func (a *App) Start(debug bool) error {
	// Connect to relays
	if err := a.client.Connect(a.ctx, debug); err != nil {
		return fmt.Errorf("failed to connect to relays: %w", err)
	}

	a.mu.Lock()
	a.connected = true
	a.mu.Unlock()

	// Resolve contact names after a short delay to allow UI to start
	go func() {
		time.Sleep(1 * time.Second) // Allow UI to start fully

		if err := a.loadContacts(); err != nil {
			log.Printf("Failed to resolve contact names: %v", err)
		}

		// Update UI
		a.app.QueueUpdate(func() {
			a.updateContactListWithNames()
			a.updateStatusBar()
			a.updateTerminalTitle()
			a.app.ForceDraw() // Force entire app to redraw
		})
	}()

	a.updateStatusBar()

	// Start listening for messages
	go a.listenForMessages(debug)

	// Start status bar updates
	go a.updateStatusBarPeriodically()

	// Set initial focus to message input
	a.app.SetFocus(a.inputField)

	// Run the application
	return a.app.Run()
}

func (a *App) listenForMessages(debug bool) {
	messageHandler := func(senderNpub, message string) {
		if debug {
			log.Printf("TUI messageHandler called for %s: %q", senderNpub, message)
		}

		if !a.client.IsPartner(senderNpub) {
			if err := a.client.AddPartner(senderNpub); err != nil {
				log.Printf("Failed to add new partner %s: %v", senderNpub, err)
			} else {
				log.Printf("Auto-added new partner: %s", senderNpub[:8]+"...")
				a.app.QueueUpdate(func() {
					a.refreshPartners()
				})
			}
		}

		// Send notification for ALL incoming messages
		username := a.profileResolver.GetDisplayName(senderNpub)
		if debug {
			log.Printf("Sending notification to %s with command: %s", username, a.config.NotifyCommand)
		}
		go notification.SendNotification(username, message, a.config.NotifyCommand, debug)

		a.mu.RLock()
		currentPartner := a.currentPartner
		a.mu.RUnlock()

		// Update UI if message is from current partner
		if senderNpub == currentPartner {
			a.app.QueueUpdate(func() {
				timestamp := time.Now().Format("15:04:05")
				username := a.profileResolver.GetDisplayName(senderNpub)
				formatted := a.messageFormatter.FormatIncomingMessage(timestamp, username, message)
				a.messageView.Write([]byte(formatted + "\n"))
				a.messageView.ScrollToEnd()
				// Force the UI to redraw
				a.app.ForceDraw()
			})
		} else {
			// Message from other contact - mark as unread
			a.unreadMu.Lock()
			a.unreadMessages[senderNpub] = true
			a.unreadMu.Unlock()

			// Message from other contact - mark as unread and show status
			a.unreadMu.Lock()
			a.unreadMessages[senderNpub] = true
			a.unreadMu.Unlock()

			a.app.QueueUpdate(func() {
				// Show status message
				username := a.profileResolver.GetDisplayName(senderNpub)
				a.setStatusMessage(fmt.Sprintf("New message from %s", username))
				a.app.ForceDraw()

				// Update contact list to show green dot
				a.updateContactListWithNames()

				// Clear status message after 3 seconds
				go func() {
					time.Sleep(3 * time.Second)
					a.app.QueueUpdate(func() {
						a.setStatusMessage("")
						a.app.ForceDraw()
					})
				}()
			})
		}
	}

	if err := a.client.ListenForMessages(a.ctx, messageHandler, debug); err != nil {
		log.Printf("Error listening for messages: %v", err)
	}
}

func (a *App) updateStatusBarPeriodically() {
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-a.ctx.Done():
			return
		case <-ticker.C:
			a.app.QueueUpdate(a.updateStatusBar)
		}
	}
}

func (a *App) Stop() {
	a.cancel()

	a.mu.Lock()
	a.connected = false
	a.mu.Unlock()

	if a.client != nil {
		a.client.Disconnect()
	}

	if a.app != nil {
		a.app.Stop()
	}
}
