package cache

import (
	"fmt"
	"os"
	"testing"
	"time"
)

func TestGetMessagesBefore(t *testing.T) {
	// Setup test cache
	cache := setupTestCache(t)
	defer cache.Clear()

	recipientNpub := "test-recipient"
	now := time.Now()

	// Add test messages at different times
	messages := []MessageEntry{
		{
			RecipientNpub: recipientNpub,
			Message:       "Message 3 hours ago",
			SentAt:        now.Add(-3 * time.Hour),
			EventID:       "event-3",
			Direction:     "sent",
		},
		{
			RecipientNpub: recipientNpub,
			Message:       "Message 2 hours ago",
			SentAt:        now.Add(-2 * time.Hour),
			EventID:       "event-2",
			Direction:     "received",
		},
		{
			RecipientNpub: recipientNpub,
			Message:       "Message 1 hour ago",
			SentAt:        now.Add(-1 * time.Hour),
			EventID:       "event-1",
			Direction:     "sent",
		},
		{
			RecipientNpub: recipientNpub,
			Message:       "Message now",
			SentAt:        now,
			EventID:       "event-0",
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

	// Test GetMessagesBefore with cutoff 1.5 hours ago
	cutoff := now.Add(-90 * time.Minute)
	result := cache.GetMessagesBefore(recipientNpub, cutoff, 10)

	// Should return messages 3 and 2 hours ago (chronological order: oldest first)
	expectedCount := 2
	if len(result) != expectedCount {
		t.Errorf("Expected %d messages, got %d", expectedCount, len(result))
	}

	// Verify chronological order (oldest first)
	for i := 1; i < len(result); i++ {
		if result[i-1].SentAt.After(result[i].SentAt) {
			t.Error("Messages are not in chronological order")
			break
		}
	}

	// Verify cutoff - all messages should be before cutoff time
	for _, msg := range result {
		if !msg.SentAt.Before(cutoff) {
			t.Errorf("Message %s is not before cutoff time", msg.EventID)
		}
	}
}

func TestGetMessagesBeforeLimit(t *testing.T) {
	// Test that limit parameter works correctly
	cache := setupTestCache(t)
	defer cache.Clear()

	recipientNpub := "test-recipient"
	now := time.Now()

	// Add 10 messages
	for i := 0; i < 10; i++ {
		msg := MessageEntry{
			RecipientNpub: recipientNpub,
			Message:       fmt.Sprintf("Message %d", i),
			SentAt:        now.Add(time.Duration(i) * time.Hour),
			EventID:       fmt.Sprintf("event-%d", i),
			Direction:     "sent",
		}
		err := cache.AddMessageWithTimestamp(msg.RecipientNpub, msg.Message, msg.EventID, msg.Direction, msg.SentAt)
		if err != nil {
			t.Fatalf("Failed to add message: %v", err)
		}
	}

	// Request only 5 messages
	result := cache.GetMessagesBefore(recipientNpub, now.Add(11*time.Hour), 5)

	if len(result) != 5 {
		t.Errorf("Expected 5 messages, got %d", len(result))
	}
}

func TestGetMessagesBeforeEmpty(t *testing.T) {
	// Test with empty cache
	cache := setupTestCache(t)
	defer cache.Clear()

	result := cache.GetMessagesBefore("nonexistent", time.Now(), 10)

	if len(result) != 0 {
		t.Errorf("Expected 0 messages from empty cache, got %d", len(result))
	}
}

func TestGetMessagesBeforeNoResults(t *testing.T) {
	// Test when no messages match the criteria
	cache := setupTestCache(t)
	defer cache.Clear()

	recipientNpub := "test-recipient"
	now := time.Now()

	// Add a message after the cutoff time
	msg := MessageEntry{
		RecipientNpub: recipientNpub,
		Message:       "Future message",
		SentAt:        now.Add(1 * time.Hour),
		EventID:       "event-future",
		Direction:     "sent",
	}

	err := cache.AddMessageWithTimestamp(msg.RecipientNpub, msg.Message, msg.EventID, msg.Direction, msg.SentAt)
	if err != nil {
		t.Fatalf("Failed to add message: %v", err)
	}

	// Request messages before now (should return none since all messages are in the future)
	result := cache.GetMessagesBefore(recipientNpub, now, 10)

	if len(result) != 0 {
		t.Errorf("Expected 0 messages when all are after cutoff, got %d", len(result))
	}
}

func TestGetMessagesBeforeChronologicalOrder(t *testing.T) {
	// Test that messages are returned in chronological order
	cache := setupTestCache(t)
	defer cache.Clear()

	recipientNpub := "test-recipient"
	now := time.Now()

	// Add messages in random order
	times := []time.Duration{
		5 * time.Hour,
		1 * time.Hour,
		3 * time.Hour,
		2 * time.Hour,
		4 * time.Hour,
	}

	for i, offset := range times {
		msg := MessageEntry{
			RecipientNpub: recipientNpub,
			Message:       fmt.Sprintf("Message %d", i),
			SentAt:        now.Add(-offset),
			EventID:       fmt.Sprintf("event-%d", i),
			Direction:     "sent",
		}
		err := cache.AddMessageWithTimestamp(msg.RecipientNpub, msg.Message, msg.EventID, msg.Direction, msg.SentAt)
		if err != nil {
			t.Fatalf("Failed to add message: %v", err)
		}
	}

	// Get all messages
	result := cache.GetMessagesBefore(recipientNpub, now, 10)

	// Verify chronological order
	for i := 1; i < len(result); i++ {
		if result[i-1].SentAt.After(result[i].SentAt) {
			t.Errorf("Messages not in chronological order: %s should be after %s",
				result[i-1].SentAt, result[i].SentAt)
		}
	}
}

func TestGetMessagesBeforeWithDifferentRecipients(t *testing.T) {
	// Test that messages are filtered by recipient correctly
	cache := setupTestCache(t)
	defer cache.Clear()

	now := time.Now()

	// Add messages for different recipients
	recipients := []string{"user1", "user2", "user3"}
	for i, recipient := range recipients {
		msg := MessageEntry{
			RecipientNpub: recipient,
			Message:       fmt.Sprintf("Message for %s", recipient),
			SentAt:        now.Add(-time.Duration(i+1) * time.Hour),
			EventID:       fmt.Sprintf("event-%d", i),
			Direction:     "sent",
		}
		err := cache.AddMessageWithTimestamp(msg.RecipientNpub, msg.Message, msg.EventID, msg.Direction, msg.SentAt)
		if err != nil {
			t.Fatalf("Failed to add message: %v", err)
		}
	}

	// Request messages for user2 only
	result := cache.GetMessagesBefore("user2", now, 10)

	if len(result) != 1 {
		t.Errorf("Expected 1 message for user2, got %d", len(result))
	}

	if result[0].RecipientNpub != "user2" {
		t.Errorf("Expected message for user2, got for %s", result[0].RecipientNpub)
	}
}

// Helper function to setup test cache
func setupTestCache(t *testing.T) Cache {
	// Create temporary directory for test
	tempDir := t.TempDir()

	// Set environment variable to use temp database
	originalCacheHome := os.Getenv("XDG_CACHE_HOME")
	os.Setenv("XDG_CACHE_HOME", tempDir)
	defer os.Setenv("XDG_CACHE_HOME", originalCacheHome)

	// Initialize cache
	cache, err := NewSQLiteCache()
	if err != nil {
		t.Fatalf("Failed to initialize test cache: %v", err)
	}

	return cache
}
