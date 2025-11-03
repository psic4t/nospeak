package tui

import (
	"testing"

	"github.com/data.haus/nospeak/config"
	"github.com/rivo/tview"
)

func TestSettingsModalDetectsNewPartners(t *testing.T) {
	// Create a test config with existing partners
	cfg := &config.Config{
		Partners: []string{"npub1existing1", "npub1existing2"},
		Relays:   []string{"wss://relay.example.com"},
		Npub:     "npub1test",
		Nsec:     "nsec1test",
		Cache:    "sqlite",
	}

	// Create test app
	app := tview.NewApplication()

	// Create a mock save function that doesn't write to real config
	mockSave := func() error {
		// Do nothing - just return success
		return nil
	}

	// Create settings modal with mock save function
	settings := NewSettingsModalWithSaveFunc(app, cfg, func() {
		// Save callback
	}, nil, mockSave)

	// Simulate adding new partners in the form
	// Get the partners textarea (index 3) and set new content
	partnersTextArea := settings.form.GetFormItem(3).(*tview.TextArea)
	newPartnersText := "npub1existing1\nnpub1existing2\nnpub1new1\nnpub1new2"
	partnersTextArea.SetText(newPartnersText, true)

	// Call saveSettings to test the logic
	settings.saveSettings()

	// Verify that the config was updated with new partners
	expectedPartners := []string{"npub1existing1", "npub1existing2", "npub1new1", "npub1new2"}
	if len(cfg.Partners) != len(expectedPartners) {
		t.Errorf("Expected %d partners, got %d", len(expectedPartners), len(cfg.Partners))
	}

	for i, expected := range expectedPartners {
		if i >= len(cfg.Partners) || cfg.Partners[i] != expected {
			t.Errorf("Expected partner %d to be %s, got %s", i, expected, cfg.Partners[i])
		}
	}

	// Note: We can't easily test the modal notification in unit tests
	// since it involves UI interactions, but we can verify the config update logic
}

func TestSettingsModalNoNewPartners(t *testing.T) {
	// Create a test config with existing partners
	cfg := &config.Config{
		Partners: []string{"npub1existing1", "npub1existing2"},
		Relays:   []string{"wss://relay.example.com"},
		Npub:     "npub1test",
		Nsec:     "nsec1test",
		Cache:    "sqlite",
	}

	// Create test app
	app := tview.NewApplication()

	// Create a mock save function that doesn't write to real config
	mockSave := func() error {
		// Do nothing - just return success
		return nil
	}

	// Create settings modal with mock save function
	settings := NewSettingsModalWithSaveFunc(app, cfg, func() {
		// Save callback
	}, nil, mockSave)

	// Simulate keeping the same partners in the form
	partnersTextArea := settings.form.GetFormItem(3).(*tview.TextArea)
	samePartnersText := "npub1existing1\nnpub1existing2"
	partnersTextArea.SetText(samePartnersText, true)

	// Call saveSettings to test the logic
	settings.saveSettings()

	// Verify that the config still has the same partners
	expectedPartners := []string{"npub1existing1", "npub1existing2"}
	if len(cfg.Partners) != len(expectedPartners) {
		t.Errorf("Expected %d partners, got %d", len(expectedPartners), len(cfg.Partners))
	}

	for i, expected := range expectedPartners {
		if i >= len(cfg.Partners) || cfg.Partners[i] != expected {
			t.Errorf("Expected partner %d to be %s, got %s", i, expected, cfg.Partners[i])
		}
	}
}
