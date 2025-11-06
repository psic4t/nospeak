package client

import (
	"testing"
	"time"

	"github.com/data.haus/nospeak/config"
)

func TestConnectionManager(t *testing.T) {
	// Create test client with mock config
	cfg := &config.Config{
		Relays: []string{"wss://relay.damus.io", "wss://nos.lol"},
		Nsec:   "nsec1j4c6269d9q9zqemgqz82xnhl3nyjh2zrfqnyy40s8qfmgvlrnwqsmv9p8r",
		Npub:   "npub1l2vyh47mk2p0qlsku7hg0vn29faehy9hy34ygaclpn66ukqp3afqutajft",
	}

	client, err := NewClient(cfg)
	if err != nil {
		t.Fatalf("Failed to create client: %v", err)
	}

	// Create connection manager with short intervals for testing
	retryConfig := RetryConfig{
		MaxRetries:          3,
		InitialBackoff:      100 * time.Millisecond,
		MaxBackoff:          1 * time.Second,
		BackoffMultiplier:   2.0,
		HealthCheckInterval: 200 * time.Millisecond,
		ConnectionTimeout:   2 * time.Second,
	}

	cm := NewConnectionManager(client, retryConfig, true)

	// Test adding relays
	cm.AddRelay("wss://relay.damus.io")
	cm.AddRelay("wss://nos.lol")

	// Test that relays are tracked
	if len(cm.relays) != 2 {
		t.Errorf("Expected 2 relays, got %d", len(cm.relays))
	}

	// Start connection manager
	cm.Start()
	defer cm.Stop()

	// Wait a bit for connections
	time.Sleep(1 * time.Second)

	// Check connected relays
	connected := cm.GetConnectedRelays()
	t.Logf("Connected to %d relays", len(connected))

	// Test getting all relays
	all := cm.GetAllRelays()
	if len(all) == 0 {
		t.Error("Expected at least one relay to be managed")
	}

	// Test relay health
	for _, relay := range all {
		health := cm.GetRelayHealth(relay.URL)
		if health == nil {
			t.Errorf("Expected health info for relay %s", relay.URL)
		}
	}
}

func TestConnectionManagerHealthTracking(t *testing.T) {
	cfg := &config.Config{
		Relays: []string{"wss://relay.damus.io"},
		Nsec:   "nsec1ufkus6z956de9n5vycpskvq6ue66w5qk0c7xk4qrpnu2z2qvw0qsv4w5x",
		Npub:   "npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr0l60jsyhx3fawhc5r0apsq9vu8",
	}

	client, err := NewClient(cfg)
	if err != nil {
		t.Fatalf("Failed to create client: %v", err)
	}

	retryConfig := DefaultRetryConfig()
	cm := NewConnectionManager(client, retryConfig, false)

	// Add a relay
	cm.AddRelay("wss://relay.damus.io")

	// Test marking success
	cm.MarkRelaySuccess("wss://relay.damus.io")

	health := cm.GetRelayHealth("wss://relay.damus.io")
	if health == nil {
		t.Fatal("Expected health info for relay")
	}

	health.Mu.RLock()
	successCount := health.SuccessCount
	consecutiveFails := health.ConsecutiveFails
	health.Mu.RUnlock()

	if successCount != 1 {
		t.Errorf("Expected success count to be 1, got %d", successCount)
	}
	if consecutiveFails != 0 {
		t.Errorf("Expected consecutive fails to be 0, got %d", consecutiveFails)
	}

	// Test marking failure
	cm.MarkRelayFailure("wss://relay.damus.io")

	health.Mu.RLock()
	failureCount := health.FailureCount
	consecutiveFails = health.ConsecutiveFails
	health.Mu.RUnlock()

	if failureCount != 1 {
		t.Errorf("Expected failure count to be 1, got %d", failureCount)
	}
	if consecutiveFails != 1 {
		t.Errorf("Expected consecutive fails to be 1, got %d", consecutiveFails)
	}
}

func TestBackoffCalculation(t *testing.T) {
	retryConfig := RetryConfig{
		InitialBackoff:    100 * time.Millisecond,
		MaxBackoff:        1 * time.Second,
		BackoffMultiplier: 2.0,
	}

	cm := NewConnectionManager(nil, retryConfig, false)

	// Test backoff calculation
	tests := []struct {
		consecutiveFails int
		expectedDelay    time.Duration
	}{
		{0, 100 * time.Millisecond},
		{1, 100 * time.Millisecond},
		{2, 200 * time.Millisecond},
		{3, 400 * time.Millisecond},
		{4, 800 * time.Millisecond},
		{5, 1000 * time.Millisecond}, // Capped at max
		{10, 1000 * time.Millisecond}, // Still capped
	}

	for _, test := range tests {
		delay := cm.calculateBackoff(test.consecutiveFails)
		if delay != test.expectedDelay {
			t.Errorf("Expected backoff delay %v for %d consecutive fails, got %v",
				test.expectedDelay, test.consecutiveFails, delay)
		}
	}
}

func TestConnectionManagerWithMockRelay(t *testing.T) {
	// Test with a mock relay that simulates failures
	cfg := &config.Config{
		Relays: []string{"ws://localhost:12345"}, // Non-existent relay
		Nsec:   "nsec1ufkus6z956de9n5vycpskvq6ue66w5qk0c7xk4qrpnu2z2qvw0qsv4w5x",
		Npub:   "npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr0l60jsyhx3fawhc5r0apsq9vu8",
	}

	client, err := NewClient(cfg)
	if err != nil {
		t.Fatalf("Failed to create client: %v", err)
	}

	retryConfig := RetryConfig{
		MaxRetries:          2,
		InitialBackoff:      50 * time.Millisecond,
		MaxBackoff:          200 * time.Millisecond,
		BackoffMultiplier:   2.0,
		HealthCheckInterval: 100 * time.Millisecond,
		ConnectionTimeout:   100 * time.Millisecond,
	}

	cm := NewConnectionManager(client, retryConfig, true)

	// Add the non-existent relay
	cm.AddRelay("ws://localhost:12345")

	cm.Start()
	defer cm.Stop()

	// Wait for connection attempts
	time.Sleep(500 * time.Millisecond)

	// Should have attempted connections but failed
	health := cm.GetRelayHealth("ws://localhost:12345")
	if health == nil {
		t.Fatal("Expected health info for relay")
	}

	health.Mu.RLock()
	failureCount := health.FailureCount
	isConnected := health.IsConnected
	health.Mu.RUnlock()

	if failureCount == 0 {
		t.Error("Expected at least one failure attempt")
	}
	if isConnected {
		t.Error("Expected relay to not be connected")
	}
}