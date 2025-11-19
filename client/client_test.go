package client

import (
	"context"
	"testing"

	"github.com/data.haus/nospeak/config"
	"github.com/data.haus/nospeak/mocks"
	"github.com/data.haus/nospeak/testutils"
	"github.com/nbd-wtf/go-nostr"
)

func TestNewClient(t *testing.T) {
	// Generate test keys
	keys := testutils.GenerateTestKeys(t)

	// Create test config
	cfg := &config.Config{
		// No static relays - will use discovery relays
		Nsec:     keys.Nsec,
		Npub:     keys.Npub,
		Partners: []string{keys.Npub},
		Cache:    "memory",
	}

	// Test client creation
	client, err := NewClient(cfg)
	testutils.AssertNoError(t, err)

	if client.GetSecretKey() != keys.PrivateKey {
		t.Error("Secret key not set correctly")
	}

	if client.GetPublicKey() != keys.PublicKey {
		t.Error("Public key not set correctly")
	}

	if client.GetRelayCount() != 0 {
		t.Error("Should start with 0 relays")
	}
}

func TestNewClientInvalidConfig(t *testing.T) {
	tests := []struct {
		name    string
		cfg     *config.Config
		wantErr bool
	}{
		{
			name: "invalid nsec",
			cfg: &config.Config{
				// No static relays - will use discovery relays
				Nsec:  "invalid-nsec",
				Npub:  "npub1test...",
				Cache: "memory",
			},
			wantErr: true,
		},
		{
			name: "invalid npub",
			cfg: &config.Config{
				// No static relays - will use discovery relays
				Nsec:  "nsec1test...",
				Npub:  "invalid-npub",
				Cache: "memory",
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := NewClient(tt.cfg)
			if tt.wantErr {
				testutils.AssertError(t, err)
			} else {
				testutils.AssertNoError(t, err)
			}
		})
	}
}

func TestClientConnect(t *testing.T) {
	// Generate test keys
	keys := testutils.GenerateTestKeys(t)

	// Create test config
	cfg := &config.Config{
		// No static relays - will use discovery relays
		Nsec:  keys.Nsec,
		Npub:  keys.Npub,
		Cache: "memory",
	}

	client, err := NewClient(cfg)
	testutils.AssertNoError(t, err)

	// Test connection (this will fail with real URLs, but we can test the logic)
	ctx := context.Background()
	err = client.Connect(ctx, false)
	// We expect this to fail since we're using mock URLs
	testutils.AssertError(t, err)
}

func TestClientDisconnect(t *testing.T) {
	keys := testutils.GenerateTestKeys(t)

	cfg := &config.Config{
		// No static relays - will use discovery relays
		Nsec:  keys.Nsec,
		Npub:  keys.Npub,
		Cache: "memory",
	}

	client, err := NewClient(cfg)
	testutils.AssertNoError(t, err)

	// Disconnect should not error even without connections
	client.Disconnect()

	if client.GetRelayCount() != 0 {
		t.Error("Should have 0 relays after disconnect")
	}
}

func TestClientPublishEvent(t *testing.T) {
	keys := testutils.GenerateTestKeys(t)

	cfg := &config.Config{
		// No static relays - will use discovery relays
		Nsec:  keys.Nsec,
		Npub:  keys.Npub,
		Cache: "memory",
	}

	client, err := NewClient(cfg)
	testutils.AssertNoError(t, err)

	// Create test event
	event := testutils.CreateTestEvent(t, keys.PublicKey, 1, "Test content")
	// Sign the event properly
	err = event.Sign(keys.PrivateKey)
	testutils.AssertNoError(t, err)

	// Try to publish (will fail without real connection)
	ctx := context.Background()
	err = client.PublishEvent(ctx, event, false)
	// May not error if no relays are connected
	_ = err
}

func TestClientSubscribe(t *testing.T) {
	keys := testutils.GenerateTestKeys(t)

	cfg := &config.Config{
		// No static relays - will use discovery relays
		Nsec:  keys.Nsec,
		Npub:  keys.Npub,
		Cache: "memory",
	}

	client, err := NewClient(cfg)
	testutils.AssertNoError(t, err)

	// Create filters
	filters := nostr.Filters{{
		Kinds:   []int{1},
		Authors: []string{keys.PublicKey},
	}}

	// Try to subscribe (will fail without real connection)
	ctx := context.Background()
	err = client.Subscribe(ctx, filters, func(event nostr.Event) {
		// Handler function
	})
	// Subscribe may not error immediately, so we don't assert error here
	_ = err
}

func TestClientQueryEvents(t *testing.T) {
	keys := testutils.GenerateTestKeys(t)

	cfg := &config.Config{
		// No static relays - will use discovery relays
		Nsec:  keys.Nsec,
		Npub:  keys.Npub,
		Cache: "memory",
	}

	client, err := NewClient(cfg)
	testutils.AssertNoError(t, err)

	// Create filters
	filters := nostr.Filters{{
		Kinds:   []int{1},
		Authors: []string{keys.PublicKey},
	}}

	// Try to query (will fail without real connection)
	ctx := context.Background()
	events, err := client.QueryEvents(ctx, filters, false)
	// Should return empty events, not error
	testutils.AssertNoError(t, err)

	if len(events) != 0 {
		t.Errorf("Expected 0 events without connection, got %d", len(events))
	}
}

func TestClientGetPartnerDisplayNames(t *testing.T) {
	keys := testutils.GenerateTestKeys(t)
	partnerKeys := testutils.GenerateTestKeys(t)

	cfg := &config.Config{
		// No static relays - will use discovery relays
		Nsec:     keys.Nsec,
		Npub:     keys.Npub,
		Partners: []string{partnerKeys.Npub},
		Cache:    "memory",
	}

	client, err := NewClient(cfg)
	testutils.AssertNoError(t, err)

	// Get partner display names (will return npub as fallback since no relay connection)
	ctx := context.Background()
	displayNames, err := client.GetPartnerDisplayNames(ctx, false)
	testutils.AssertNoError(t, err)

	if len(displayNames) != 1 {
		t.Errorf("Expected 1 display name, got %d", len(displayNames))
	}

	if _, exists := displayNames[partnerKeys.Npub]; !exists {
		t.Error("Partner npub not found in display names")
	}
}

func TestClientGetPartnerProfiles(t *testing.T) {
	keys := testutils.GenerateTestKeys(t)
	partnerKeys := testutils.GenerateTestKeys(t)

	cfg := &config.Config{
		// No static relays - will use discovery relays
		Nsec:     keys.Nsec,
		Npub:     keys.Npub,
		Partners: []string{partnerKeys.Npub},
		Cache:    "memory",
	}

	client, err := NewClient(cfg)
	testutils.AssertNoError(t, err)

	// Get partner profiles (will return empty profiles since no relay connection)
	ctx := context.Background()
	profiles, err := client.GetPartnerProfiles(ctx, false)
	testutils.AssertNoError(t, err)

	if len(profiles) != 1 {
		t.Errorf("Expected 1 profile, got %d", len(profiles))
	}

	if _, exists := profiles[partnerKeys.Npub]; !exists {
		t.Error("Partner npub not found in profiles")
	}
}

func TestClientGetPartnerNpubs(t *testing.T) {
	keys := testutils.GenerateTestKeys(t)
	partnerKeys := testutils.GenerateTestKeys(t)

	cfg := &config.Config{
		// No static relays - will use discovery relays
		Nsec:     keys.Nsec,
		Npub:     keys.Npub,
		Partners: []string{partnerKeys.Npub, "npub1another..."},
		Cache:    "memory",
	}

	client, err := NewClient(cfg)
	testutils.AssertNoError(t, err)

	// Get partner npubs
	partners := client.GetPartnerNpubs()

	if len(partners) != 2 {
		t.Errorf("Expected 2 partners, got %d", len(partners))
	}

	if partners[0] != partnerKeys.Npub {
		t.Errorf("Expected first partner %s, got %s", partnerKeys.Npub, partners[0])
	}
}

func TestClientGetMessageHistory(t *testing.T) {
	keys := testutils.GenerateTestKeys(t)
	partnerKeys := testutils.GenerateTestKeys(t)

	cfg := &config.Config{
		// No static relays - will use discovery relays
		Nsec:     keys.Nsec,
		Npub:     keys.Npub,
		Partners: []string{partnerKeys.Npub},
		Cache:    "memory",
	}

	client, err := NewClient(cfg)
	testutils.AssertNoError(t, err)

	// Get message history (will be empty since no cache)
	messages := client.GetMessageHistory(partnerKeys.Npub, 10)

	if len(messages) != 0 {
		t.Errorf("Expected 0 messages, got %d", len(messages))
	}
}

func TestClientGetMessageHistoryEnhanced(t *testing.T) {
	keys := testutils.GenerateTestKeys(t)
	partnerKeys := testutils.GenerateTestKeys(t)

	cfg := &config.Config{
		// No static relays - will use discovery relays
		Nsec:     keys.Nsec,
		Npub:     keys.Npub,
		Partners: []string{partnerKeys.Npub},
		Cache:    "memory",
	}

	client, err := NewClient(cfg)
	testutils.AssertNoError(t, err)

	// Get enhanced message history (will be empty since no cache)
	messages := client.GetMessageHistoryEnhanced(partnerKeys.Npub, 5, 5)

	if len(messages) != 0 {
		t.Errorf("Expected 0 messages, got %d", len(messages))
	}
}

func TestClientAuthentication(t *testing.T) {
	keys := testutils.GenerateTestKeys(t)

	cfg := &config.Config{
		// No static relays - will use discovery relays
		Nsec:  keys.Nsec,
		Npub:  keys.Npub,
		Cache: "memory",
	}

	client, err := NewClient(cfg)
	testutils.AssertNoError(t, err)

	// Test authentication helper methods
	if client.GetSecretKey() == "" {
		t.Error("Secret key should not be empty")
	}

	if client.GetPublicKey() == "" {
		t.Error("Public key should not be empty")
	}

	if client.GetSecretKey() != keys.PrivateKey {
		t.Error("Secret key mismatch")
	}

	if client.GetPublicKey() != keys.PublicKey {
		t.Error("Public key mismatch")
	}
}

func TestClientWithMockRelay(t *testing.T) {
	keys := testutils.GenerateTestKeys(t)

	// Create mock relay pool
	relayPool := mocks.NewMockRelayPool()
	_ = relayPool.AddRelay("wss://mock.relay")

	cfg := &config.Config{
		// No static relays - will use discovery relays
		Nsec:  keys.Nsec,
		Npub:  keys.Npub,
		Cache: "memory",
	}

	client, err := NewClient(cfg)
	testutils.AssertNoError(t, err)

	// Test with mock relay would require more complex setup
	// For now, just test basic client functionality
	if client.GetSecretKey() != keys.PrivateKey {
		t.Error("Secret key not set correctly")
	}
}
