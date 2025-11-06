package tui

import (
	"testing"

	"github.com/data.haus/nospeak/config"
	"github.com/rivo/tview"
	"github.com/stretchr/testify/assert"
)

func TestShowSettingsWithNewUI(t *testing.T) {
	app := createTestApp(t)
	defer app.app.Stop()

	app.showSettings()

	// Verify settings modal is created (shows new partner list UI integration works)
	assert.NotNil(t, app.settingsModal)
}

func createTestApp(t *testing.T) *App {
	// Create a minimal test app
	testApp := tview.NewApplication()
	app := &App{
		app:    testApp,
		config: &config.Config{},
		pages:  tview.NewPages(),
	}
	return app
}