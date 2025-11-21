package tui

import (
	"fmt"
	"strings"

	"github.com/data.haus/nospeak/config"
	"github.com/gdamore/tcell/v2"
	"github.com/rivo/tview"
)

type SettingsModal struct {
	app      *tview.Application
	form     *tview.Form
	config   *config.Config
	onSave   func()
	onCancel func()
	saveFunc func() error
}

func NewSettingsModal(app *tview.Application, config *config.Config, onSave, onCancel func()) *SettingsModal {
	return NewSettingsModalWithSaveFunc(app, config, onSave, onCancel, nil)
}

func NewSettingsModalWithSaveFunc(app *tview.Application, config *config.Config, onSave, onCancel func(), saveFunc func() error) *SettingsModal {
	sm := &SettingsModal{
		app:      app,
		config:   config,
		onSave:   onSave,
		onCancel: onCancel,
		saveFunc: saveFunc,
	}

	sm.createForm()
	return sm
}

func (sm *SettingsModal) createForm() {
	sm.form = tview.NewForm()
	sm.form.SetBorder(true).SetTitle("[violet]Settings[white]")

	// Set form colors with proper focus highlighting using theme colors
	sm.form.SetFieldBackgroundColor(FieldBackgroundColor)
	sm.form.SetFieldTextColor(tcell.ColorWhite)
	sm.form.SetButtonBackgroundColor(ButtonBackgroundColor)
	sm.form.SetButtonTextColor(tcell.ColorWhite)
	sm.form.SetBackgroundColor(tcell.ColorDefault)
	sm.form.SetTitleColor(tcell.ColorWhite)

	// Add fields for configuration with colored labels
	sm.form.AddInputField("[green]Npub:[white]", sm.config.Npub, 65, nil, nil)

	sm.form.AddInputField("[green]Nsec:[white]", sm.config.Nsec, 65, nil, nil)

	partnersText := strings.Join(sm.config.Partners, "\n")
	partnersHeight := len(sm.config.Partners) + 1
	if partnersHeight < 3 {
		partnersHeight = 3
	}
	sm.form.AddTextArea("[green]Partners (one npub per line):[white]", partnersText, 65, partnersHeight, 0, func(text string) {})

	sm.form.AddInputField("[green]Cache (sqlite/memory):[white]", sm.config.Cache, 20, nil, nil)

	sm.form.AddCheckbox("[green]Show Contacts Pane:[white]", sm.config.ShowContacts, nil)

	sm.form.AddInputField("[green]Notify Command:[white]", sm.config.NotifyCommand, 65, nil, nil)

	sm.form.AddCheckbox("[green]Debug Mode:[white]", sm.config.Debug, nil)

	sm.form.AddButton("[green]Save[white]", func() {
		sm.saveSettings()
	})

	sm.form.AddButton("[red]Cancel[white]", func() {
		if sm.onCancel != nil {
			sm.onCancel()
		}
	})

	// Add ESC key handler to close settings modal
	sm.form.SetInputCapture(func(event *tcell.EventKey) *tcell.EventKey {
		if event.Key() == tcell.KeyEscape {
			if sm.onCancel != nil {
				sm.onCancel()
			}
			return nil // Consume the event
		}
		return event // Let other keys pass through
	})
}

func (sm *SettingsModal) saveSettings() {
	// Store original partners to detect new additions
	originalPartners := make(map[string]bool)
	for _, partner := range sm.config.Partners {
		originalPartners[strings.TrimSpace(partner)] = true
	}

	// Extract values from form and update config

	// Get form field values
	npub := sm.form.GetFormItem(0).(*tview.InputField).GetText()
	nsec := sm.form.GetFormItem(1).(*tview.InputField).GetText()
	partnersText := sm.form.GetFormItem(2).(*tview.TextArea).GetText()
	cache := sm.form.GetFormItem(3).(*tview.InputField).GetText()
	showContacts := sm.form.GetFormItem(4).(*tview.Checkbox).IsChecked()
	notifyCommand := sm.form.GetFormItem(5).(*tview.InputField).GetText()
	debug := sm.form.GetFormItem(6).(*tview.Checkbox).IsChecked()

	partners := strings.Split(strings.TrimSpace(partnersText), "\n")
	var cleanPartners []string
	var newPartners []string
	for _, partner := range partners {
		partner = strings.TrimSpace(partner)
		if partner != "" {
			cleanPartners = append(cleanPartners, partner)
			// Check if this is a new partner
			if !originalPartners[partner] {
				newPartners = append(newPartners, partner)
			}
		}
	}

	// Update config with extracted values
	sm.config.Npub = strings.TrimSpace(npub)
	sm.config.Nsec = strings.TrimSpace(nsec)
	// Relays field removed - no longer saved to config
	sm.config.Partners = cleanPartners
	sm.config.Cache = strings.TrimSpace(cache)
	sm.config.ShowContacts = showContacts
	sm.config.NotifyCommand = strings.TrimSpace(notifyCommand)
	sm.config.Debug = debug

	// Save config to file
	var err error
	if sm.saveFunc != nil {
		err = sm.saveFunc()
	} else {
		err = sm.config.Save()
	}
	if err != nil {
		// Show error message
		errorModal := tview.NewModal().
			SetText(fmt.Sprintf("[red]Failed to save settings:[white] %v", err)).
			AddButtons([]string{"[green]OK[white]"}).
			SetDoneFunc(func(buttonIndex int, buttonLabel string) {
				sm.app.SetRoot(sm.form, true)
			})
		errorModal.SetBackgroundColor(tcell.ColorDefault)
		sm.app.SetRoot(errorModal, true)
		return
	}

	// Show notification if new partners were added
	if len(newPartners) > 0 {
		var message string
		if len(newPartners) == 1 {
			message = fmt.Sprintf("[green]New partner added:[white] %s", newPartners[0][:8]+"...")
		} else {
			message = fmt.Sprintf("[green]%d new partners added[white]", len(newPartners))
		}

		notificationModal := tview.NewModal().
			SetText(message + "\n\n[gray]Contacts will be refreshed automatically.[white]").
			AddButtons([]string{"[green]OK[white]"}).
			SetDoneFunc(func(buttonIndex int, buttonLabel string) {
				if sm.onSave != nil {
					sm.onSave()
				}
			})
		notificationModal.SetBackgroundColor(tcell.ColorDefault)
		sm.app.SetRoot(notificationModal, true)
	} else {
		if sm.onSave != nil {
			sm.onSave()
		}
	}
}

func (sm *SettingsModal) Show() {
	// Force form to redraw and ensure proper display
	sm.form.SetTitle("[violet]Settings[white]")

	sm.app.SetRoot(sm.form, true)

	// Force TextAreas to display from top instead of bottom
	partnersTextArea := sm.form.GetFormItem(2).(*tview.TextArea)
	partnersTextArea.SetOffset(0, 0)
}
