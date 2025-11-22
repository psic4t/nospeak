package tui

import (
	"testing"
	"time"

	"github.com/data.haus/nospeak/client"
	"github.com/data.haus/nospeak/config"
	"github.com/data.haus/nospeak/testutils"
	"github.com/rivo/tview"
)

func TestRelayConnectionsModal(t *testing.T) {
	// Create a test config with valid keys
	testKeys := testutils.GenerateTestKeys(t)
	cfg := &config.Config{
		Npub:  testKeys.Npub,
		Nsec:  testKeys.Nsec,
		Cache: "sqlite",
	}

	// Create a test client
	testClient, err := client.NewClient(cfg)
	if err != nil {
		t.Fatalf("Failed to create test client: %v", err)
	}

	// Create test app
	app := tview.NewApplication()

	// Create relay connections modal
	modal := NewRelayConnectionsModal(app, testClient, func() {
		// Close callback
	})

	// Test that modal components are created
	if modal.flex == nil {
		t.Error("Expected flex container to be created")
	}

	if modal.table == nil {
		t.Error("Expected table to be created")
	}

	if modal.statsView == nil {
		t.Error("Expected stats view to be created")
	}

	// Test table headers
	headerCell := modal.table.GetCell(0, 0)
	if headerCell == nil {
		t.Error("Expected header cell to be created")
	}

	// Test that updateData doesn't panic
	modal.updateData()

	// Test close functionality
	modal.Close()

	// Verify context is cancelled
	select {
	case <-modal.ctx.Done():
		// Expected - context should be cancelled
	default:
		t.Error("Expected context to be cancelled after Close()")
	}
}

func TestRelayConnectionsModalUpdateStats(t *testing.T) {
	// Create a test config with valid keys
	testKeys := testutils.GenerateTestKeys(t)
	cfg := &config.Config{
		Npub:  testKeys.Npub,
		Nsec:  testKeys.Nsec,
		Cache: "sqlite",
	}

	// Create a test client
	testClient, err := client.NewClient(cfg)
	if err != nil {
		t.Fatalf("Failed to create test client: %v", err)
	}

	// Create test app
	app := tview.NewApplication()

	// Create relay connections modal
	modal := NewRelayConnectionsModal(app, testClient, func() {})

	// Mock stats data
	mockStats := map[string]interface{}{
		"connected_relays":     1,
		"total_managed_relays": 2,
		"retry_queue_size":     0,
		"relay_health": map[string]interface{}{
			"wss://relay.damus.io": map[string]interface{}{
				"connected":         true,
				"success_count":     10,
				"failure_count":     2,
				"consecutive_fails": 0,
				"last_connected":    time.Now(),
				"last_attempt":      time.Now(),
			},
		},
	}

	// Test updateStats function
	modal.updateStats(mockStats)

	// Verify stats view was updated
	statsText := modal.statsView.GetText(true)
	if statsText == "" {
		t.Error("Expected stats view to be updated")
	}

	// Test with no relays
	emptyStats := map[string]interface{}{
		"connected_relays":     0,
		"total_managed_relays": 0,
		"retry_queue_size":     0,
		"relay_health":         map[string]interface{}{},
	}

	modal.updateStats(emptyStats)
	emptyStatsText := modal.statsView.GetText(true)
	if emptyStatsText == "" {
		t.Error("Expected stats view to be updated even with empty stats")
	}
}

func TestRelayConnectionsModalUpdateRelayTable(t *testing.T) {
	// Create a test config with valid keys
	testKeys := testutils.GenerateTestKeys(t)
	cfg := &config.Config{
		Npub:  testKeys.Npub,
		Nsec:  testKeys.Nsec,
		Cache: "sqlite",
	}

	// Create a test client
	testClient, err := client.NewClient(cfg)
	if err != nil {
		t.Fatalf("Failed to create test client: %v", err)
	}

	// Create test app
	app := tview.NewApplication()

	// Create relay connections modal
	modal := NewRelayConnectionsModal(app, testClient, func() {})

	// Mock relay health data
	mockStats := map[string]interface{}{
		"relay_health": map[string]interface{}{
			"wss://relay.damus.io": map[string]interface{}{
				"connected":         true,
				"success_count":     10,
				"failure_count":     2,
				"consecutive_fails": 0,
				"last_connected":    time.Now(),
				"last_attempt":      time.Now(),
			},
			"wss://nostr.data.haus": map[string]interface{}{
				"connected":         false,
				"success_count":     5,
				"failure_count":     8,
				"consecutive_fails": 4,
				"last_connected":    time.Now().Add(-1 * time.Hour),
				"last_attempt":      time.Now().Add(-5 * time.Minute),
			},
		},
	}

	// Test updateRelayTable function
	modal.updateRelayTable(mockStats)

	// Verify table has rows (header + data rows)
	rowCount := modal.table.GetRowCount()
	if rowCount < 2 {
		t.Errorf("Expected at least 2 rows (header + data), got %d", rowCount)
	}

	// Test with empty relay health
	emptyStats := map[string]interface{}{
		"relay_health": map[string]interface{}{},
	}

	modal.updateRelayTable(emptyStats)
	emptyRowCount := modal.table.GetRowCount()
	// Should have header + "no relays" message
	if emptyRowCount < 2 {
		t.Errorf("Expected at least 2 rows (header + no relays message), got %d", emptyRowCount)
	}
}

func TestRelayConnectionsModalRealTimeUpdates(t *testing.T) {
	// Create a test config with valid keys
	testKeys := testutils.GenerateTestKeys(t)
	cfg := &config.Config{
		Npub:  testKeys.Npub,
		Nsec:  testKeys.Nsec,
		Cache: "sqlite",
	}

	// Create a test client
	testClient, err := client.NewClient(cfg)
	if err != nil {
		t.Fatalf("Failed to create test client: %v", err)
	}

	// Create test app
	app := tview.NewApplication()

	// Create relay connections modal
	modal := NewRelayConnectionsModal(app, testClient, func() {})

	// Test startUpdates
	modal.startUpdates()

	// Wait a short time to ensure ticker is created
	time.Sleep(100 * time.Millisecond)

	// Verify ticker is created
	if modal.updateTicker == nil {
		t.Error("Expected update ticker to be created")
	}

	// Test stopUpdates
	modal.stopUpdates()

	// Verify context is cancelled
	select {
	case <-modal.ctx.Done():
		// Expected
	default:
		t.Error("Expected context to be cancelled after stopUpdates()")
	}
}
