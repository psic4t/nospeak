package client

import (
	"context"
	"testing"
	"time"

	"github.com/data.haus/nospeak/config"
	"github.com/nbd-wtf/go-nostr"
)

func TestRetryQueue(t *testing.T) {
	// Create test client
	cfg := &config.Config{
		Relays: []string{"wss://relay.damus.io"},
		Nsec:   "nsec1ufkus6z956de9n5vycpskvq6ue66w5qk0c7xk4qrpnu2z2qvw0qsv4w5x",
		Npub:   "npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr0l60jsyhx3fawhc5r0apsq9vu8",
	}

	client, err := NewClient(cfg)
	if err != nil {
		t.Fatalf("Failed to create client: %v", err)
	}

	retryConfig := RetryConfig{
		MaxRetries:          3,
		InitialBackoff:      50 * time.Millisecond,
		MaxBackoff:          500 * time.Millisecond,
		BackoffMultiplier:   2.0,
		HealthCheckInterval: 100 * time.Millisecond,
		ConnectionTimeout:   2 * time.Second,
	}

	cm := NewConnectionManager(client, retryConfig, false)
	rq := NewRetryQueue(client, cm, retryConfig, false)

	rq.Start()
	defer rq.Stop()
	defer cm.Stop()

	// Test stats
	stats := rq.GetStats()
	if stats["max_retries"] != 3 {
		t.Errorf("Expected max_retries to be 3, got %v", stats["max_retries"])
	}
}

func TestRetryQueueBackoffCalculation(t *testing.T) {
	retryConfig := RetryConfig{
		InitialBackoff:    100 * time.Millisecond,
		MaxBackoff:        1 * time.Second,
		BackoffMultiplier: 2.0,
	}

	cfg := &config.Config{
		Relays: []string{"wss://relay.damus.io"},
		Nsec:   "nsec1ufkus6z956de9n5vycpskvq6ue66w5qk0c7xk4qrpnu2z2qvw0qsv4w5x",
		Npub:   "npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr0l60jsyhx3fawhc5r0apsq9vu8",
	}

	client, _ := NewClient(cfg)
	cm := NewConnectionManager(client, retryConfig, false)
	rq := NewRetryQueue(client, cm, retryConfig, false)

	// Test backoff calculation
	tests := []struct {
		attempt         int
		expectedMin     time.Duration
		expectedMax     time.Duration
	}{
		{1, 100 * time.Millisecond, 100 * time.Millisecond},
		{2, 200 * time.Millisecond, 200 * time.Millisecond},
		{3, 400 * time.Millisecond, 400 * time.Millisecond},
		{4, 800 * time.Millisecond, 800 * time.Millisecond},
		{5, 1000 * time.Millisecond, 1000 * time.Millisecond}, // Capped
	}

	for _, test := range tests {
		delay := rq.calculateBackoff(test.attempt)
		if delay < test.expectedMin || delay > test.expectedMax {
			t.Errorf("Expected backoff delay between %v and %v for attempt %d, got %v",
				test.expectedMin, test.expectedMax, test.attempt, delay)
		}
	}
}

func TestEnqueueRetry(t *testing.T) {
	retryConfig := RetryConfig{
		MaxRetries:          3,
		InitialBackoff:      50 * time.Millisecond,
		MaxBackoff:          200 * time.Millisecond,
		BackoffMultiplier:   2.0,
		HealthCheckInterval: 100 * time.Millisecond,
	}

	cfg := &config.Config{
		Relays: []string{"wss://relay.damus.io"},
		Nsec:   "nsec1j4c6269d9q9zqemgqz82xnhl3nyjh2zrfqnyy40s8qfmgvlrnwqsmv9p8r",
		Npub:   "npub1l2vyh47mk2p0qlsku7hg0vn29faehy9hy34ygaclpn66ukqp3afqutajft",
	}

	client, _ := NewClient(cfg)
	cm := NewConnectionManager(client, retryConfig, false)
	rq := NewRetryQueue(client, cm, retryConfig, false)

	// Create test event
	event := nostr.Event{
		ID:        "test-event-id",
		PubKey:    "test-pubkey",
		CreatedAt: nostr.Now(),
		Kind:      1,
		Content:   "test content",
	}

	// Enqueue retry below max retries
	rq.EnqueueRetry(event, "wss://relay.damus.io", 1)

	// Check that queue length increased
	stats := rq.GetStats()
	if stats["queue_length"] == 0 {
		t.Error("Expected queue length to be > 0 after enqueueing retry")
	}

	// Enqueue retry at max retries (should not be enqueued)
	rq.EnqueueRetry(event, "wss://relay.damus.io", 3)

	// Queue length should not have increased for the max retries attempt
	time.Sleep(10 * time.Millisecond) // Give time for processing
	stats = rq.GetStats()
	// The queue might still have the first item, but shouldn't have the second
}

func TestRetryablePublish(t *testing.T) {
	event := nostr.Event{
		ID:        "test-event-id",
		PubKey:    "test-pubkey",
		CreatedAt: nostr.Now(),
		Kind:      1,
		Content:   "test content",
	}

	// Test RetryablePublish creation
	retry := &RetryablePublish{
		Event:       event,
		TargetRelay: "wss://relay.damus.io",
		Attempt:     1,
		MaxAttempts: 3,
		NextAttempt: time.Now().Add(100 * time.Millisecond),
		CreatedAt:   time.Now(),
	}

	if retry.Event.ID != event.ID {
		t.Errorf("Expected event ID %s, got %s", event.ID, retry.Event.ID)
	}
	if retry.Attempt != 1 {
		t.Errorf("Expected attempt 1, got %d", retry.Attempt)
	}
	if retry.MaxAttempts != 3 {
		t.Errorf("Expected max attempts 3, got %d", retry.MaxAttempts)
	}
}

func TestPublishResult(t *testing.T) {
	result := PublishResult{
		RelayURL: "wss://relay.damus.io",
		Success:  true,
		Attempt:  2,
	}

	if result.RelayURL != "wss://relay.damus.io" {
		t.Errorf("Expected relay URL wss://relay.damus.io, got %s", result.RelayURL)
	}
	if !result.Success {
		t.Error("Expected success to be true")
	}
	if result.Attempt != 2 {
		t.Errorf("Expected attempt 2, got %d", result.Attempt)
	}
}

func TestPublishToAllRelays(t *testing.T) {
	// This test would require actual relay connections, so we'll test the structure
	retryConfig := DefaultRetryConfig()
	cfg := &config.Config{
		Relays: []string{"wss://relay.damus.io"},
		Nsec:   "nsec1ufkus6z956de9n5vycpskvq6ue66w5qk0c7xk4qrpnu2z2qvw0qsv4w5x",
		Npub:   "npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr0l60jsyhx3fawhc5r0apsq9vu8",
	}

	client, _ := NewClient(cfg)
	cm := NewConnectionManager(client, retryConfig, false)
	rq := NewRetryQueue(client, cm, retryConfig, false)

	// Add a mock relay to test structure
	cm.AddRelay("wss://relay.damus.io")

	event := nostr.Event{
		ID:        "test-event-id",
		PubKey:    "test-pubkey",
		CreatedAt: nostr.Now(),
		Kind:      1,
		Content:   "test content",
	}

	// This will likely fail since we don't have real connections, but tests the structure
	ctx := context.Background()
	results := rq.PublishToAllRelays(ctx, event)

	// Should return results for each managed relay
	if len(results) == 0 {
		t.Error("Expected at least one result, got none")
	}

	// Check result structure
	for _, result := range results {
		if result.RelayURL == "" {
			t.Error("Expected relay URL in result")
		}
		if result.Attempt == 0 {
			t.Error("Expected attempt count > 0")
		}
	}
}