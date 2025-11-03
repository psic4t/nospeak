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
}

func NewSettingsModal(app *tview.Application, config *config.Config, onSave, onCancel func()) *SettingsModal {
	sm := &SettingsModal{
		app:      app,
		config:   config,
		onSave:   onSave,
		onCancel: onCancel,
	}

	sm.createForm()
	return sm
}

func (sm *SettingsModal) createForm() {
	sm.form = tview.NewForm()
	sm.form.SetBorder(true).SetTitle("Settings")
	sm.form.SetFieldBackgroundColor(tcell.ColorDefault)
	sm.form.SetFieldTextColor(tcell.ColorWhite)
	sm.form.SetBackgroundColor(tcell.ColorDefault)

	// Add fields for configuration
	sm.form.AddInputField("Npub:", sm.config.Npub, 60, nil, nil)

	sm.form.AddInputField("Nsec:", sm.config.Nsec, 60, nil, nil)

	relaysText := strings.Join(sm.config.Relays, "\n")
	sm.form.AddTextArea("Relays (one per line):", relaysText, 50, 5, 0, func(text string) {})

	partnersText := strings.Join(sm.config.Partners, "\n")
	sm.form.AddTextArea("Partners (one npub per line):", partnersText, 50, 5, 0, func(text string) {})

	sm.form.AddInputField("Cache (sqlite/memory):", sm.config.Cache, 20, nil, nil)

	sm.form.AddCheckbox("Show Contacts Pane:", sm.config.ShowContacts, nil)

	sm.form.AddInputField("Notify Command:", sm.config.NotifyCommand, 50, nil, nil)

	sm.form.AddCheckbox("Debug Mode:", sm.config.Debug, nil)

	sm.form.AddButton("Save", func() {
		sm.saveSettings()
	})

	sm.form.AddButton("Cancel", func() {
		if sm.onCancel != nil {
			sm.onCancel()
		}
	})
}

func (sm *SettingsModal) saveSettings() {
	// Extract values from form and update config

	// Get form field values
	npub := sm.form.GetFormItem(0).(*tview.InputField).GetText()
	nsec := sm.form.GetFormItem(1).(*tview.InputField).GetText()
	relaysText := sm.form.GetFormItem(2).(*tview.TextArea).GetText()
	partnersText := sm.form.GetFormItem(3).(*tview.TextArea).GetText()
	cache := sm.form.GetFormItem(4).(*tview.InputField).GetText()
	showContacts := sm.form.GetFormItem(5).(*tview.Checkbox).IsChecked()
	notifyCommand := sm.form.GetFormItem(6).(*tview.InputField).GetText()
	debug := sm.form.GetFormItem(7).(*tview.Checkbox).IsChecked()

	// Parse textarea content into string slices
	relays := strings.Split(strings.TrimSpace(relaysText), "\n")
	var cleanRelays []string
	for _, relay := range relays {
		relay = strings.TrimSpace(relay)
		if relay != "" {
			cleanRelays = append(cleanRelays, relay)
		}
	}

	partners := strings.Split(strings.TrimSpace(partnersText), "\n")
	var cleanPartners []string
	for _, partner := range partners {
		partner = strings.TrimSpace(partner)
		if partner != "" {
			cleanPartners = append(cleanPartners, partner)
		}
	}

	// Update config with extracted values
	sm.config.Npub = strings.TrimSpace(npub)
	sm.config.Nsec = strings.TrimSpace(nsec)
	sm.config.Relays = cleanRelays
	sm.config.Partners = cleanPartners
	sm.config.Cache = strings.TrimSpace(cache)
	sm.config.ShowContacts = showContacts
	sm.config.NotifyCommand = strings.TrimSpace(notifyCommand)
	sm.config.Debug = debug

	// Save config to file
	if err := sm.config.Save(); err != nil {
		// Show error message
		errorModal := tview.NewModal().
			SetText(fmt.Sprintf("Failed to save settings: %v", err)).
			AddButtons([]string{"OK"}).
			SetDoneFunc(func(buttonIndex int, buttonLabel string) {
				sm.app.SetRoot(sm.form, true)
			})
		sm.app.SetRoot(errorModal, true)
		return
	}

	if sm.onSave != nil {
		sm.onSave()
	}
}

func (sm *SettingsModal) Show() {
	sm.app.SetRoot(sm.form, true)
}
