package tui

import (
	"context"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	"github.com/data.haus/nospeak/cache"
	"github.com/data.haus/nospeak/client"
	"github.com/data.haus/nospeak/config"
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
	displayNames   map[string]string
	messageCache   cache.Cache
	connected      bool
	mu             sync.RWMutex

	// Message loading state
	loadedSentCount     int
	loadedReceivedCount int
	hasMoreMessages     bool

	// Context
	ctx    context.Context
	cancel context.CancelFunc
}

func NewApp() (*App, error) {
	cfg, err := config.Load()
	if err != nil {
		return nil, fmt.Errorf("failed to load config: %w", err)
	}

	nostrClient, err := client.NewClient(cfg)
	if err != nil {
		return nil, fmt.Errorf("failed to create client: %w", err)
	}

	ctx, cancel := context.WithCancel(context.Background())

	app := &App{
		app:          tview.NewApplication(),
		client:       nostrClient,
		config:       cfg,
		displayNames: make(map[string]string),
		messageCache: cache.GetCache(),
		ctx:          ctx,
		cancel:       cancel,
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
	grid.SetRows(0, 1)     // 0 for main content, 1 for input
	grid.SetColumns(0, 25) // 0 for messages, 25 for contacts

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
		}
	})

	a.inputArea.AddItem(a.inputField, 0, 1, true)

	// Assemble grid layout
	grid.AddItem(a.messageView, 0, 0, 1, 1, 0, 0, false) // messages - row 0, col 0
	grid.AddItem(a.contactList, 0, 1, 1, 1, 0, 0, false) // contacts - row 0, col 1
	grid.AddItem(a.inputArea, 1, 0, 1, 2, 0, 0, true)    // input - row 1, span 2 cols

	// Assemble main layout
	a.mainFlex.AddItem(a.statusBar, 1, 0, false)
	a.mainFlex.AddItem(grid, 0, 1, true)

	// Set up keyboard shortcuts
	a.app.SetInputCapture(a.handleGlobalKeys)

	// Set root
	a.app.SetRoot(a.mainFlex, true)

	// Load contacts
	if err := a.loadContacts(); err != nil {
		return fmt.Errorf("failed to load contacts: %w", err)
	}

	return nil
}

func (a *App) loadContacts() error {
	a.partners = a.client.GetPartnerNpubs()
	if len(a.partners) == 0 {
		return fmt.Errorf("no chat partners configured")
	}

	// Get display names
	displayNames, err := a.client.GetPartnerDisplayNames(a.ctx, false)
	if err != nil {
		log.Printf("Failed to resolve usernames: %v", err)
		// Use fallback names
		for _, partner := range a.partners {
			displayNames[partner] = partner[:8] + "..."
		}
	}

	a.displayNames = displayNames

	// Populate contact list
	a.contactList.Clear()
	for i, partner := range a.partners {
		displayName := displayNames[partner]
		a.contactList.AddItem(displayName, partner, 0, nil)
		if i == 0 {
			a.currentPartner = partner
			a.contactList.SetCurrentItem(0)
			a.loadChatHistory()
		}
	}

	return nil
}

func (a *App) onContactSelected(index int, mainText, secondaryText string) {
	if index < len(a.partners) {
		a.mu.Lock()
		a.currentPartner = a.partners[index]
		a.mu.Unlock()
		a.loadChatHistory()
		a.updateStatusBar()
	}
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
	a.messageView.SetText(fmt.Sprintf("[::b]Chat with %s[::-]\n\n", a.displayNames[partner]))

	for _, msg := range messages {
		timestamp := msg.SentAt.Format("15:04:05")
		if msg.Direction == "sent" {
			a.messageView.Write([]byte(fmt.Sprintf("[%s] [yellow]You:[white] %s\n", timestamp, msg.Message)))
		} else {
			// For received messages, RecipientNpub contains the sender's npub
			senderNpub := msg.RecipientNpub
			username := a.displayNames[senderNpub]
			if username == "" {
				username = senderNpub[:8] + "..."
			}
			a.messageView.Write([]byte(fmt.Sprintf("[%s] [green]%s:[white] %s\n", timestamp, username, msg.Message)))
		}
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
	a.messageView.SetText(fmt.Sprintf("[::b]Chat with %s[::-]\n\n", a.displayNames[partner]))

	for _, msg := range messages {
		timestamp := msg.SentAt.Format("15:04:05")
		if msg.Direction == "sent" {
			a.messageView.Write([]byte(fmt.Sprintf("[%s] [yellow]You:[white] %s\n", timestamp, msg.Message)))
		} else {
			// For received messages, RecipientNpub contains the sender's npub
			senderNpub := msg.RecipientNpub
			username := a.displayNames[senderNpub]
			if username == "" {
				username = senderNpub[:8] + "..."
			}
			a.messageView.Write([]byte(fmt.Sprintf("[%s] [green]%s:[white] %s\n", timestamp, username, msg.Message)))
		}
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

	a.mu.RLock()
	partner := a.currentPartner
	a.mu.RUnlock()

	if partner == "" {
		a.showMessage("No contact selected")
		return
	}

	// Display message immediately
	timestamp := time.Now().Format("15:04:05")
	a.messageView.Write([]byte(fmt.Sprintf("[%s] [yellow]You:[white] %s\n", timestamp, message)))
	a.messageView.ScrollToEnd()
	a.inputField.SetText("")

	// Send message in background
	go func() {
		if err := a.client.SendChatMessage(a.ctx, partner, message, false); err != nil {
			a.app.QueueUpdate(func() {
				a.showMessage(fmt.Sprintf("Failed to send message: %v", err))
				// Remove the failed message from display by reloading
				a.loadChatHistory()
			})
		}
	}()
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

	status := "[red]Disconnected[white]"
	if connected {
		status = "[green]Connected[white]"
	}

	partnerName := "None"
	if partner != "" && a.displayNames[partner] != "" {
		partnerName = a.displayNames[partner]
	}

	timeStr := time.Now().Format("15:04:05")
	a.statusBar.SetText(fmt.Sprintf("%s | Partner: %s | %s", status, partnerName, timeStr))
}

func (a *App) handleGlobalKeys(event *tcell.EventKey) *tcell.EventKey {
	switch event.Key() {
	case tcell.KeyCtrlC:
		a.Stop()
		return nil
	case tcell.KeyCtrlQ:
		a.Stop()
		return nil
	case tcell.KeyCtrlJ:
		// Scroll up in message view
		a.scrollMessageUp()
		return nil
	case tcell.KeyCtrlK:
		// Scroll down in message view
		a.scrollMessageDown()
		return nil
	case tcell.KeyF1:
		a.showHelp()
		return nil
	case tcell.KeyF2:
		a.showSettings()
		return nil
	case tcell.KeyTab:
		// Cycle between input field and contact list
		if a.app.GetFocus() == a.inputField {
			a.app.SetFocus(a.contactList)
		} else {
			a.app.SetFocus(a.inputField)
		}
		return nil
	}
	return event
}

func (a *App) showHelp() {
	helpText := `Nospeak TUI Help

Keyboard Shortcuts:
  Ctrl+C/Ctrl+Q  - Quit application
  Tab            - Switch between contact list and input
  Enter          - Send message (when in input field)
  Ctrl+J/K       - Scroll message pane up/down
  F1             - Show this help
  F2             - Show settings

Navigation:
  ↑/↓            - Navigate contact list
  Enter          - Select contact

Commands:
  /quit          - Quit application
  /help          - Show this help`

	modal := tview.NewModal().
		SetText(helpText).
		AddButtons([]string{"Close"}).
		SetDoneFunc(func(buttonIndex int, buttonLabel string) {
			a.app.SetRoot(a.mainFlex, true)
		})

	a.app.SetRoot(modal, true)
}

func (a *App) showSettings() {
	settings := NewSettingsModal(a.app, a.config, func() {
		// Settings saved callback
		a.app.SetRoot(a.mainFlex, true)
	}, func() {
		// Settings cancelled callback
		a.app.SetRoot(a.mainFlex, true)
	})
	settings.Show()
}

func (a *App) Start(debug bool) error {
	// Connect to relays
	if err := a.client.Connect(a.ctx, debug); err != nil {
		return fmt.Errorf("failed to connect to relays: %w", err)
	}

	a.mu.Lock()
	a.connected = true
	a.mu.Unlock()

	a.updateStatusBar()

	// Start listening for messages
	go a.listenForMessages(debug)

	// Start status bar updates
	go a.updateStatusBarPeriodically()

	// Set initial focus
	a.app.SetFocus(a.inputField)

	// Run the application
	return a.app.Run()
}

func (a *App) listenForMessages(debug bool) {
	messageHandler := func(senderNpub, message string) {
		a.mu.RLock()
		currentPartner := a.currentPartner
		a.mu.RUnlock()

		// Update UI if message is from current partner
		if senderNpub == currentPartner {
			a.app.QueueUpdate(func() {
				timestamp := time.Now().Format("15:04:05")
				username := a.displayNames[senderNpub]
				if username == "" {
					username = senderNpub[:8] + "..."
				}
				a.messageView.Write([]byte(fmt.Sprintf("[%s] [green]%s:[white] %s\n", timestamp, username, message)))
				a.messageView.ScrollToEnd()
				// Force the UI to redraw
				a.app.ForceDraw()
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
