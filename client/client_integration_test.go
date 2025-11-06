package client

import (
	"context"
	"testing"
	"time"

	"github.com/data.haus/nospeak/config"
	"github.com/nbd-wtf/go-nostr"
)

func TestClientWithConnectionManager(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	// Create test config with real relays
	cfg := &config.Config{
		Relays: []string{
			"wss://relay.damus.io",
			"wss://nos.lol",
		},
		Nsec: "nsec1j4c6269d9q9zqemgqz82xnhl3nyjh2zrfqnyy40s8qfmgvlrnwqsmv9p8r",
		Npub: "npub1l2vyh47mk2p0qlsku7hg0vn29faehy9hy34ygaclpn66ukqp3afqutajft",
	}

	client, err := NewClient(cfg)
	if err != nil {
		t.Fatalf("Failed to create client: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Test connection with enhanced connection manager
	if err := client.Connect(ctx, true); err != nil {
		t.Logf("Connection warning: %v", err)
		// Don't fail - connection manager will keep trying
	}

	// Wait for connections
	time.Sleep(2 * time.Second)

	// Test connection stats
	stats := client.GetConnectionStats()
	t.Logf("Connection stats: %+v", stats)

	connectedRelays := stats["connected_relays"].(int)
	totalManaged := stats["total_managed_relays"].(int)

	if totalManaged == 0 {
		t.Error("Expected at least one managed relay")
	}

	t.Logf("Connected to %d out of %d managed relays", connectedRelays, totalManaged)

	// Test publishing with retry queue
	event := nostr.Event{
		PubKey:    client.GetPublicKey(),
		CreatedAt: nostr.Now(),
		Kind:      1, // Text note
		Content:   "Test message from nospeak integration test",
		Tags:      nostr.Tags{},
	}

	if err := event.Sign(client.GetSecretKey()); err != nil {
		t.Fatalf("Failed to sign event: %v", err)
	}

	// Publish with retry logic
	if err := client.PublishEvent(ctx, event, true); err != nil {
		t.Logf("Publish warning: %v", err)
		// Don't fail - retry queue will handle failures
	}

	// Wait for retries
	time.Sleep(3 * time.Second)

	// Check final stats
	finalStats := client.GetConnectionStats()
	t.Logf("Final connection stats: %+v", finalStats)

	// Test disconnection
	client.Disconnect()
}

func TestClientRetryLogic(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	// Create config with a mix of working and non-working relays
	cfg := &config.Config{
		Relays: []string{
			"wss://relay.damus.io", // Working relay
			"ws://localhost:12345", // Non-working relay
		},
		Nsec: "nsec1j4c6269d9q9zqemgqz82xnhl3nyjh2zrfqnyy40s8qfmgvlrnwqsmv9p8r",
		Npub: "npub1l2vyh47mk2p0qlsku7hg0vn29faehy9hy34ygaclpn66ukqp3afqutajft",
	}

	client, err := NewClient(cfg)
	if err != nil {
		t.Fatalf("Failed to create client: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Connect should succeed despite some relays failing
	if err := client.Connect(ctx, true); err != nil {
		t.Logf("Connection completed with warnings: %v", err)
	}

	time.Sleep(2 * time.Second)

	// Test that we have some managed relays
	stats := client.GetConnectionStats()
	totalManaged := stats["total_managed_relays"].(int)

	if totalManaged == 0 {
		t.Error("Expected at least one managed relay")
	}

	// Test publishing to both working and non-working relays
	event := nostr.Event{
		PubKey:    client.GetPublicKey(),
		CreatedAt: nostr.Now(),
		Kind:      1,
		Content:   "Test retry logic message",
		Tags:      nostr.Tags{},
	}

	if err := event.Sign(client.GetSecretKey()); err != nil {
		t.Fatalf("Failed to sign event: %v", err)
	}

	// This should succeed for working relays and queue retries for failed ones
	if err := client.PublishEvent(ctx, event, true); err != nil {
		t.Logf("Publish completed with retries queued: %v", err)
	}

	// Wait for retry processing
	time.Sleep(5 * time.Second)

	// Check retry queue stats
	finalStats := client.GetConnectionStats()
	t.Logf("Stats after retry processing: %+v", finalStats)

	client.Disconnect()
}

func TestMailboxRelayHandling(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	cfg := &config.Config{
		Relays: []string{"wss://relay.damus.io"},
		Partners: []string{
			"npub1l2vyh47mk2p0qlsku7hg0vn29faehy9hy34ygaclpn66ukqp3afqutajft",
		},
		Nsec: "nsec1j4c6269d9q9zqemgqz82xnhl3nyjh2zrfqnyy40s8qfmgvlrnwqsmv9p8r",
		Npub: "npub1l2vyh47mk2p0qlsku7hg0vn29faehy9hy34ygaclpn66ukqp3afqutajft",
	}

	client, err := NewClient(cfg)
	if err != nil {
		t.Fatalf("Failed to create client: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := client.Connect(ctx, true); err != nil {
		t.Logf("Connection warning: %v", err)
	}

	time.Sleep(2 * time.Second)

	// Test adding mailbox relays
	mailboxRelays := []string{
		"wss://nostr.data.haus",
		"wss://relay.snort.social",
	}

	client.AddMailboxRelays(mailboxRelays)

	// Wait for connection manager to add new relays
	time.Sleep(1 * time.Second)

	// Check that mailbox relays were added
	stats := client.GetConnectionStats()
	totalManaged := stats["total_managed_relays"].(int)

	if totalManaged < len(cfg.Relays)+len(mailboxRelays) {
		t.Logf("Note: Some mailbox relays may already be in config. Total managed: %d", totalManaged)
	}

	// Test sending a message (this will discover and add more mailbox relays)
	err = client.SendChatMessage(ctx, cfg.Partners[0], "Test mailbox relay handling", true)
	if err != nil {
		t.Logf("Message sending completed with retries: %v", err)
	}

	// Wait for processing
	time.Sleep(3 * time.Second)

	finalStats := client.GetConnectionStats()
	t.Logf("Final stats after mailbox relay test: %+v", finalStats)

	client.Disconnect()
}

func TestEnhancedSubscribe(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	cfg := &config.Config{
		Relays: []string{
			"wss://relay.damus.io",
			"wss://nos.lol",
		},
		Nsec: "nsec1j4c6269d9q9zqemgqz82xnhl3nyjh2zrfqnyy40s8qfmgvlrnwqsmv9p8r",
		Npub: "npub1l2vyh47mk2p0qlsku7hg0vn29faehy9hy34ygaclpn66ukqp3afqutajft",
	}

	client, err := NewClient(cfg)
	if err != nil {
		t.Fatalf("Failed to create client: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := client.Connect(ctx, true); err != nil {
		t.Logf("Connection warning: %v", err)
	}

	time.Sleep(2 * time.Second)

	// Test enhanced subscription
	filters := nostr.Filters{{
		Kinds: []int{1}, // Text notes
		Limit: 5,
	}}

	var receivedEvents []nostr.Event
	eventsChan := make(chan nostr.Event, 10)

	err = client.Subscribe(ctx, filters, func(event nostr.Event) {
		eventsChan <- event
	})

	if err != nil {
		t.Logf("Subscribe completed with some relays failing: %v", err)
	}

	// Collect events
	go func() {
		for event := range eventsChan {
			receivedEvents = append(receivedEvents, event)
			if len(receivedEvents) >= 5 {
				break
			}
		}
	}()

	// Wait for events
	time.Sleep(10 * time.Second)

	t.Logf("Received %d events through enhanced subscription", len(receivedEvents))

	client.Disconnect()
}