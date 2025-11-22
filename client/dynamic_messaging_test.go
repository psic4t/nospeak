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

func TestDynamicMessageSending(t *testing.T) {
	// Setup test client with discovery relays
	keys := testutils.GenerateTestKeys(t)

	cfg := &config.Config{
		Npub: keys.Npub,
		Nsec: keys.Nsec,
		// No relays configured - should use discovery
	}

	client, err := NewClient(cfg)
	if err != nil {
		t.Fatalf("Failed to create client: %v", err)
	}

	// Initialize mock cache
	testCache := mocks.NewMockCache()
	cache.SetCache(testCache)

	ctx := context.Background()

	t.Run("Send message with dynamic relay discovery", func(t *testing.T) {
		recipientKeys := testutils.GenerateTestKeys(t)
		recipientNpub := recipientKeys.Npub

		// Setup cached relays for recipient
		testCache.SetNIP65Relays(recipientNpub,
			[]string{"wss://recipient-read.example.com"},
			[]string{"wss://recipient-write.example.com"},
			24*time.Hour)

		// Setup cached relays for sender
		senderNpub := keys.Npub
		testCache.SetNIP65Relays(senderNpub,
			[]string{"wss://sender-read.example.com"},
			[]string{"wss://sender-write.example.com"},
			24*time.Hour)

		message := "Test message with dynamic relays"

		// Send message
		_, err = client.SendChatMessage(ctx, recipientNpub, message, true)
		if err != nil {
			t.Errorf("Failed to send message: %v", err)
		}

		// Verify that cached relays were used
		// In a real test, we would verify that message was sent to the correct relays
		// For this test, we just verify that no error occurred
	})

	t.Run("Send message with cache miss and fallback", func(t *testing.T) {
		recipientKeys := testutils.GenerateTestKeys(t)
		recipientNpub := recipientKeys.Npub

		// No cached relays for recipient - should trigger discovery and fallback
		message := "Test message with cache miss"

		// Send message
		_, err = client.SendChatMessage(ctx, recipientNpub, message, true)
		if err != nil {
			t.Errorf("Failed to send message with cache miss: %v", err)
		}
	})

	t.Run("Send message with expired cache", func(t *testing.T) {
		recipientKeys := testutils.GenerateTestKeys(t)
		recipientNpub := recipientKeys.Npub

		// Setup expired cached relays
		testCache.SetNIP65Relays(recipientNpub,
			[]string{"wss://expired.example.com"},
			[]string{"wss://expired.example.com"},
			-1*time.Hour) // Expired

		message := "Test message with expired cache"

		// Send message
		_, err = client.SendChatMessage(ctx, recipientNpub, message, true)
		if err != nil {
			t.Errorf("Failed to send message with expired cache: %v", err)
		}
	})
}

func TestDiscoveryRelaysFunction(t *testing.T) {
	t.Run("GetDiscoveryRelays returns correct relays", func(t *testing.T) {
		discovery := GetDiscoveryRelays()

		expectedRelays := []string{
			"wss://purplepag.es",
			"wss://nostr.data.haus",
			"wss://nos.lol",
			"wss://relay.damus.io",
		}

		if len(discovery.Relays) != len(expectedRelays) {
			t.Errorf("Expected %d relays, got %d", len(expectedRelays), len(discovery.Relays))
		}

		for _, expected := range expectedRelays {
			found := false
			for _, actual := range discovery.Relays {
				if actual == expected {
					found = true
					break
				}
			}
			if !found {
				t.Errorf("Expected relay %s not found in discovery relays", expected)
			}
		}
	})
}
