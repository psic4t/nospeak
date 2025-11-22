package cache

import (
	"fmt"
	"testing"
	"time"
)

func TestGetLatestMessages(t *testing.T) {
	cache := setupTestCache(t)
	defer cache.Clear()

	recipientNpub := "test-recipient"

	// Create test messages in chronological order
	messages := []MessageEntry{
		{
			RecipientNpub: recipientNpub,
			Message:       "Message 1 (oldest)",
			SentAt:        time.Date(2025, 1, 12, 10, 0, 0, 0, time.UTC),
			EventID:       "event1",
			Direction:     "received",
		},
		{
			RecipientNpub: recipientNpub,
			Message:       "Message 2",
			SentAt:        time.Date(2025, 1, 12, 11, 0, 0, 0, time.UTC),
			EventID:       "event2",
			Direction:     "sent",
		},
		{
			RecipientNpub: recipientNpub,
			Message:       "Message 3 (newest)",
			SentAt:        time.Date(2025, 1, 12, 12, 0, 0, 0, time.UTC),
			EventID:       "event3",
			Direction:     "received",
		},
	}

	// Add messages to cache
	for _, msg := range messages {
		err := cache.AddMessageWithTimestamp(msg.RecipientNpub, msg.Message, msg.EventID, msg.Direction, msg.SentAt)
		if err != nil {
			t.Fatalf("Failed to add message: %v", err)
		}
	}

	// Test getting latest messages with limit 2
	result := cache.GetLatestMessages(recipientNpub, 2)

	// Should return 2 most recent messages in chronological order
	if len(result) != 2 {
		t.Fatalf("Expected 2 messages, got %d", len(result))
	}

	// Should contain messages 2 and 3 in chronological order
	expectedOrder := []string{"Message 2", "Message 3 (newest)"}
	for i, expected := range expectedOrder {
		if result[i].Message != expected {
			t.Errorf("Message %d: expected '%s', got '%s'", i, expected, result[i].Message)
		}
	}

	// Verify chronological order (oldest first)
	for i := 1; i < len(result); i++ {
		if result[i].SentAt.Before(result[i-1].SentAt) {
			t.Errorf("Messages not in chronological order: %v should be after %v", result[i].SentAt, result[i-1].SentAt)
		}
	}
}

func TestGetLatestMessagesLimit(t *testing.T) {
	cache := setupTestCache(t)
	defer cache.Clear()

	recipientNpub := "test-recipient"

	// Add 5 messages
	for i := 0; i < 5; i++ {
		msg := MessageEntry{
			RecipientNpub: recipientNpub,
			Message:       fmt.Sprintf("Message %d", i+1),
			SentAt:        time.Date(2025, 1, 12, 10+i, 0, 0, 0, time.UTC),
			EventID:       fmt.Sprintf("event%d", i+1),
			Direction:     "received",
		}
		err := cache.AddMessageWithTimestamp(msg.RecipientNpub, msg.Message, msg.EventID, msg.Direction, msg.SentAt)
		if err != nil {
			t.Fatalf("Failed to add message: %v", err)
		}
	}

	// Test with limit 3
	result := cache.GetLatestMessages(recipientNpub, 3)

	if len(result) != 3 {
		t.Fatalf("Expected 3 messages, got %d", len(result))
	}

	// Should contain messages 3, 4, 5 in chronological order
	expectedMessages := []string{"Message 3", "Message 4", "Message 5"}
	for i, expected := range expectedMessages {
		if result[i].Message != expected {
			t.Errorf("Message %d: expected '%s', got '%s'", i, expected, result[i].Message)
		}
	}
}

func TestGetLatestMessagesEmpty(t *testing.T) {
	cache := setupTestCache(t)
	defer cache.Clear()

	result := cache.GetLatestMessages("nonexistent", 10)
	if len(result) != 0 {
		t.Errorf("Expected empty result for nonexistent recipient, got %d messages", len(result))
	}
}

func TestGetLatestMessagesZeroLimit(t *testing.T) {
	cache := setupTestCache(t)
	defer cache.Clear()

	recipientNpub := "test-recipient"

	// Add a message
	err := cache.AddMessageWithTimestamp(recipientNpub, "Test message", "event1", "received", time.Now())
	if err != nil {
		t.Fatalf("Failed to add message: %v", err)
	}

	// Test with limit 0
	result := cache.GetLatestMessages(recipientNpub, 0)
	if len(result) != 0 {
		t.Errorf("Expected empty result with limit 0, got %d messages", len(result))
	}
}
