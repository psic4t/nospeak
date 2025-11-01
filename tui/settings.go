package tui

import (
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
	sm.form.AddInputField("Name:", "", 20, nil, nil)

	relaysText := strings.Join(sm.config.Relays, "\n")
	sm.form.AddTextArea("Relays (one per line):", relaysText, 50, 5, 0, func(text string) {})

	partnersText := strings.Join(sm.config.Partners, "\n")
	sm.form.AddTextArea("Partners (one npub per line):", partnersText, 50, 5, 0, func(text string) {})

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
	// This is a simplified version - in practice you'd want to validate
	// and properly parse the form fields

	if sm.onSave != nil {
		sm.onSave()
	}
}

func (sm *SettingsModal) Show() {
	sm.app.SetRoot(sm.form, true)
}
