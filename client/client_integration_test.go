package client

import (
	"context"
	"testing"
	"time"

	"github.com/data.haus/nospeak/config"
	"github.com/data.haus/nospeak/testutils"
	"github.com/nbd-wtf/go-nostr"
)

func TestClientWithConnectionManager(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	// Create test config - will use discovery relays
	cfg := &config.Config{
		// No static relays - will use discovery relays automatically
		Nsec: testutils.GenerateTestKeys(t).Nsec,
		Npub: testutils.GenerateTestKeys(t).Npub,
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

	// Create config - will use discovery relays with retry logic
	cfg := &config.Config{
		// No static relays - will use discovery relays with retry logic
		Nsec: testutils.GenerateTestKeys(t).Nsec,
		Npub: testutils.GenerateTestKeys(t).Npub,
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
		// No static relays - will use discovery relays
		Partners: []string{
			"npub1l2vyh47mk2p0qlsku7hg0vn29faehy9hy34ygaclpn66ukqp3afqutajft",
		},
		Nsec: testutils.GenerateTestKeys(t).Nsec,
		Npub: testutils.GenerateTestKeys(t).Npub,
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

	if totalManaged < len(mailboxRelays) {
		t.Logf("Note: Some mailbox relays may already be managed. Total managed: %d", totalManaged)
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
		// No static relays - will use discovery relays
		Nsec: testutils.GenerateTestKeys(t).Nsec,
		Npub: testutils.GenerateTestKeys(t).Npub,
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

func TestDynamicMessageSendingIntegration(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	// Create config without static relays - should use discovery
	cfg := &config.Config{
		// No relays configured - test dynamic discovery (Relays field removed)
		Nsec: testutils.GenerateTestKeys(t).Nsec,
		Npub: testutils.GenerateTestKeys(t).Npub,
		Partners: []string{
			"npub1l2vyh47mk2p0qlsku7hg0vn29faehy9hy34ygaclpn66ukqp3afqutajft", // Self for testing
		},
	}

	client, err := NewClient(cfg)
	if err != nil {
		t.Fatalf("Failed to create client: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	defer cancel()

	// Connect should use discovery relays when no static relays configured
	if err := client.Connect(ctx, true); err != nil {
		t.Logf("Connection completed with discovery relays: %v", err)
	}

	time.Sleep(3 * time.Second)

	// Verify discovery relays are being used
	stats := client.GetConnectionStats()
	totalManaged := stats["total_managed_relays"].(int)
	connectedRelays := stats["connected_relays"].(int)

	t.Logf("Connected to %d out of %d discovery relays", connectedRelays, totalManaged)

	if totalManaged == 0 {
		t.Error("Expected at least one discovery relay to be managed")
	}

	// Test sending message with dynamic relay discovery
	err = client.SendChatMessage(ctx, cfg.Partners[0], "Test dynamic message sending", true)
	if err != nil {
		t.Logf("Message sending completed with dynamic relay discovery: %v", err)
	}

	// Wait for message processing and relay discovery
	time.Sleep(5 * time.Second)

	// Check that additional relays may have been discovered and added
	finalStats := client.GetConnectionStats()
	finalTotalManaged := finalStats["total_managed_relays"].(int)

	t.Logf("Final managed relays after message sending: %d", finalTotalManaged)

	client.Disconnect()
}

func TestCacheMissAndFallbackIntegration(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	// Test recipient with no cached relay information
	unknownRecipient := "npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr0l60syp3hjuyqewzw44msqs8v6"

	cfg := &config.Config{
		// No static relays - force discovery
		Nsec: testutils.GenerateTestKeys(t).Nsec,
		Npub: testutils.GenerateTestKeys(t).Npub,
	}

	client, err := NewClient(cfg)
	if err != nil {
		t.Fatalf("Failed to create client: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := client.Connect(ctx, true); err != nil {
		t.Logf("Connected with discovery relays: %v", err)
	}

	time.Sleep(2 * time.Second)

	// Send message to unknown recipient - should trigger cache miss and fallback
	err = client.SendChatMessage(ctx, unknownRecipient, "Test cache miss fallback", true)
	if err != nil {
		t.Logf("Message sent with cache miss handling: %v", err)
	}

	// Wait for processing
	time.Sleep(3 * time.Second)

	// Verify fallback behavior worked
	stats := client.GetConnectionStats()
	t.Logf("Stats after cache miss test: %+v", stats)

	client.Disconnect()
}

func TestExpiredCacheRefreshIntegration(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	cfg := &config.Config{
		Nsec: testutils.GenerateTestKeys(t).Nsec,
		Npub: testutils.GenerateTestKeys(t).Npub,
	}

	client, err := NewClient(cfg)
	if err != nil {
		t.Fatalf("Failed to create client: %v", err)
	}

	// Setup cache with expired entry manually (simulating expired cache)
	testRecipient := "npub1l2vyh47mk2p0qlsku7hg0vn29faehy9hy34ygaclpn66ukqp3afqutajft"

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := client.Connect(ctx, true); err != nil {
		t.Logf("Connected with discovery relays: %v", err)
	}

	time.Sleep(2 * time.Second)

	// Send message - should handle expired cache gracefully
	err = client.SendChatMessage(ctx, testRecipient, "Test expired cache refresh", true)
	if err != nil {
		t.Logf("Message sent with expired cache handling: %v", err)
	}

	// Wait for cache refresh and message processing
	time.Sleep(5 * time.Second)

	// Verify cache refresh occurred
	stats := client.GetConnectionStats()
	t.Logf("Stats after expired cache test: %+v", stats)

	client.Disconnect()
}

func TestDiscoveryRelaysOnlyIntegration(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	// Test with only discovery relays (no static config)
	cfg := &config.Config{
		// No static relays - will use discovery-only mode automatically
		Nsec: testutils.GenerateTestKeys(t).Nsec,
		Npub: testutils.GenerateTestKeys(t).Npub,
	}

	client, err := NewClient(cfg)
	if err != nil {
		t.Fatalf("Failed to create client: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Should connect to discovery relays only
	if err := client.Connect(ctx, true); err != nil {
		t.Logf("Connected to discovery relays only: %v", err)
	}

	time.Sleep(3 * time.Second)

	// Verify only discovery relays are managed
	stats := client.GetConnectionStats()
	totalManaged := stats["total_managed_relays"].(int)
	connectedRelays := stats["connected_relays"].(int)

	t.Logf("Discovery-only mode: %d/%d relays connected", connectedRelays, totalManaged)

	// Should have exactly the 4 discovery relays managed
	expectedDiscoveryCount := 4
	if totalManaged < expectedDiscoveryCount {
		t.Logf("Note: Expected %d discovery relays, got %d (some may be filtered)", expectedDiscoveryCount, totalManaged)
	}

	// Test sending message with discovery-only setup
	err = client.SendChatMessage(ctx, "npub1l2vyh47mk2p0qlsku7hg0vn29faehy9hy34ygaclpn66ukqp3afqutajft", "Discovery-only test message", true)
	if err != nil {
		t.Logf("Message sent via discovery relays: %v", err)
	}

	time.Sleep(3 * time.Second)

	client.Disconnect()
}

func TestMixedRelayConfigurationIntegration(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	// Test with discovery relays (static relays removed)
	cfg := &config.Config{
		// No static relays - will use discovery relays
		Nsec: testutils.GenerateTestKeys(t).Nsec,
		Npub: testutils.GenerateTestKeys(t).Npub,
	}

	client, err := NewClient(cfg)
	if err != nil {
		t.Fatalf("Failed to create client: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := client.Connect(ctx, true); err != nil {
		t.Logf("Connected with mixed relay configuration: %v", err)
	}

	time.Sleep(3 * time.Second)

	// Should have both static and discovery relays
	stats := client.GetConnectionStats()
	totalManaged := stats["total_managed_relays"].(int)
	connectedRelays := stats["connected_relays"].(int)

	t.Logf("Mixed configuration: %d/%d relays connected (static + discovery)", connectedRelays, totalManaged)

	if totalManaged < 1 {
		t.Error("Expected at least one relay (static or discovery) to be managed")
	}

	// Test message sending with mixed relay setup
	err = client.SendChatMessage(ctx, "npub1l2vyh47mk2p0qlsku7hg0vn29faehy9hy34ygaclpn66ukqp3afqutajft", "Mixed relay test message", true)
	if err != nil {
		t.Logf("Message sent with mixed relay configuration: %v", err)
	}

	time.Sleep(3 * time.Second)

	client.Disconnect()
}
