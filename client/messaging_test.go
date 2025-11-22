package client

import (
	"context"
	"testing"
	"time"

	"github.com/data.haus/nospeak/cache"
	"github.com/data.haus/nospeak/config"
	"github.com/data.haus/nospeak/mocks"
	"github.com/data.haus/nospeak/testutils"
)

func TestSetupMessageRelays(t *testing.T) {
	// Setup test client
	keys := testutils.GenerateTestKeys(t)

	cfg := &config.Config{
		Npub: keys.Npub,
		Nsec: keys.Nsec,
	}

	client, err := NewClient(cfg)
	if err != nil {
		t.Fatalf("Failed to create client: %v", err)
	}

	// Initialize cache for testing
	testCache := mocks.NewMockCache()
	cache.SetCache(testCache)

	ctx := context.Background()
	debug := true

	// Create retry config for connection manager
	retryConfig := DefaultRetryConfig()
	retryConfig.HealthCheckInterval = 100 * time.Millisecond

	// Start connection manager to handle relay additions
	client.connectionManager.Start()

	t.Run("Setup message relays with valid config", func(t *testing.T) {
		// Clear any existing relays for clean test
		client.connectionManager = NewConnectionManager(client, retryConfig, true)
		client.connectionManager.Start()

		err := client.SetupMessageRelays(ctx, debug)
		if err != nil {
			t.Errorf("SetupMessageRelays failed: %v", err)
		}

		// Give connection manager a moment to process relay additions
		time.Sleep(100 * time.Millisecond)

		allURLs := client.connectionManager.GetAllManagedRelayURLs()

		// Should have exactly 4 default discovery relays (fallback behavior)
		if len(allURLs) != 4 {
			t.Errorf("Expected exactly 4 managed relays (fallback), got: %d", len(allURLs))
		}
	})

	t.Run("Setup message relays with cache hit", func(t *testing.T) {
		// Clear any existing relays for clean test
		client.connectionManager = NewConnectionManager(client, retryConfig, true)
		client.connectionManager.Start()
		// Setup cached NIP-65 relays
		testCache.SetNIP65Relays(keys.Npub,
			[]string{"wss://read1.example.com", "wss://read2.example.com"}, // read relays
			[]string{"wss://write1.example.com"},                           // write relays
			24*time.Hour)

		err := client.SetupMessageRelays(ctx, debug)
		if err != nil {
			t.Errorf("SetupMessageRelays failed with cache: %v", err)
		}

		// Give connection manager a moment to process relay additions
		time.Sleep(100 * time.Millisecond)

		allURLs := client.connectionManager.GetAllManagedRelayURLs()

		// Should have exactly 2 cached read relays (selective connections)
		if len(allURLs) != 2 {
			t.Errorf("Expected exactly 2 managed relays (cached), got: %d", len(allURLs))
		}
	})

	// Stop connection manager
	client.connectionManager.Stop()
}

func TestListenForMessagesWithRelaySetup(t *testing.T) {
	// Setup test client
	keys := testutils.GenerateTestKeys(t)

	cfg := &config.Config{
		Npub: keys.Npub,
		Nsec: keys.Nsec,
	}

	client, err := NewClient(cfg)
	if err != nil {
		t.Fatalf("Failed to create client: %v", err)
	}

	// Initialize cache for testing
	testCache := mocks.NewMockCache()
	cache.SetCache(testCache)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	debug := true
	var messageHandler = func(senderNpub, message string) {
		t.Logf("Message received from %s: %s", senderNpub, message)
	}

	t.Run("ListenForMessages performs relay setup", func(t *testing.T) {
		err := client.ListenForMessages(ctx, messageHandler, debug)
		if err != nil {
			t.Errorf("ListenForMessages failed: %v", err)
		}

		// Verify that relays were set up for message reception
		stats := client.GetConnectionStats()
		totalRelays := stats["total_managed_relays"].(int)

		// Should have at least the 4 default discovery relays
		if totalRelays < 4 {
			t.Errorf("Expected at least 4 managed relays after ListenForMessages, got: %d", totalRelays)
		}
	})
}

func TestRemoveDuplicateRelays(t *testing.T) {
	t.Run("Remove duplicates from relay list", func(t *testing.T) {
		input := []string{
			"wss://relay1.example.com",
			"wss://relay2.example.com",
			"wss://relay1.example.com", // duplicate
			"wss://relay3.example.com",
			"wss://relay2.example.com", // duplicate
		}

		result := removeDuplicateRelays(input)
		expected := []string{"wss://relay1.example.com", "wss://relay2.example.com", "wss://relay3.example.com"}

		if len(result) != len(expected) {
			t.Errorf("Expected %d unique relays, got %d", len(expected), len(result))
		}

		// Check that all expected relays are present
		relayMap := make(map[string]bool)
		for _, relay := range result {
			relayMap[relay] = true
		}

		for _, expectedRelay := range expected {
			if !relayMap[expectedRelay] {
				t.Errorf("Expected relay %s not found in result", expectedRelay)
			}
		}
	})

	t.Run("Handle empty relay list", func(t *testing.T) {
		result := removeDuplicateRelays([]string{})
		if len(result) != 0 {
			t.Errorf("Expected empty list, got %v", result)
		}
	})

	t.Run("Handle list with no duplicates", func(t *testing.T) {
		input := []string{"wss://relay1.com", "wss://relay2.com"}
		result := removeDuplicateRelays(input)
		if len(result) != len(input) {
			t.Errorf("Expected %d relays, got %d", len(input), len(result))
		}
	})
}
