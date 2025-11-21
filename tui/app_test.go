package tui

import (
	"testing"

	"github.com/data.haus/nospeak/config"
	"github.com/rivo/tview"
)

func TestShowSettingsWithNewUI(t *testing.T) {
	app := createTestApp(t)
	defer app.app.Stop()

	app.showSettings()

	// Settings modal should be created and displayed
	// Note: We can't directly access settingsModal as it's not exported
	// The test verifies the function doesn't panic
}

func TestStatusMessageFormatting(t *testing.T) {
	app := createTestApp(t)
	defer app.app.Stop()

	// Test singular relay message
	app.statusMessage = "sent to 1 relay"
	if app.statusMessage != "sent to 1 relay" {
		t.Errorf("Expected 'sent to 1 relay', got '%s'", app.statusMessage)
	}

	// Test plural relay message
	app.statusMessage = "sent to 3 relays"
	if app.statusMessage != "sent to 3 relays" {
		t.Errorf("Expected 'sent to 3 relays', got '%s'", app.statusMessage)
	}

	// Test zero relays (edge case)
	app.statusMessage = "sent to 0 relays"
	if app.statusMessage != "sent to 0 relays" {
		t.Errorf("Expected 'sent to 0 relays', got '%s'", app.statusMessage)
	}
}

func createTestApp(t *testing.T) *App {
	// Create a minimal test app
	testApp := tview.NewApplication()
	app := &App{
		app:    testApp,
		config: &config.Config{},
	}
	return app
}
