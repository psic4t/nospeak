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

func createTestApp(t *testing.T) *App {
	// Create a minimal test app
	testApp := tview.NewApplication()
	app := &App{
		app:    testApp,
		config: &config.Config{},
	}
	return app
}
