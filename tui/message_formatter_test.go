package tui

import (
	"strings"
	"testing"
	"time"
	"github.com/data.haus/nospeak/cache"
	"github.com/nbd-wtf/go-nostr"
)

func TestMessageFormatter_FormatMessage(t *testing.T) {
	formatter := NewMessageFormatter()

	// Test case: basic message
	event := &nostr.Event{
		ID:        "test-id",
		CreatedAt: nostr.Timestamp(time.Now().Unix()),
		Content:   "Hello world",
		PubKey:    "test-pubkey",
	}

	result := formatter.FormatMessage(event, "alice", false, false)

	if result == "" {
		t.Error("Expected formatted message, got empty string")
	}

	// Verify timestamp is included
	if !containsTimestamp(result) {
		t.Error("Expected timestamp in formatted message")
	}
}

func TestMessageFormatter_FormatMessage_EdgeCases(t *testing.T) {
	formatter := NewMessageFormatter()

	// Test long message
	longEvent := &nostr.Event{
		ID:        "test-long",
		CreatedAt: nostr.Timestamp(time.Now().Unix()),
		Content:   strings.Repeat("This is a very long message that should be handled properly. ", 10),
		PubKey:    "test-pubkey",
	}

	result := formatter.FormatMessage(longEvent, "testuser", true, true)
	if len(result) == 0 {
		t.Error("Expected formatted long message, got empty string")
	}

	// Test encrypted message indicator
	encryptedResult := formatter.FormatMessage(longEvent, "testuser", false, true)
	if !strings.Contains(encryptedResult, "🔒") {
		t.Error("Expected encryption indicator in formatted message")
	}

	// Test outgoing vs incoming color coding
	outgoingResult := formatter.FormatMessage(longEvent, "testuser", true, false)
	incomingResult := formatter.FormatMessage(longEvent, "testuser", false, false)

	if !strings.Contains(outgoingResult, "[blue]") {
		t.Error("Expected [blue] prefix for outgoing messages")
	}
	if !strings.Contains(incomingResult, "[green]") {
		t.Error("Expected [green] prefix for incoming messages")
	}
}

func TestMessageFormatter_FormatMessageEntry(t *testing.T) {
	formatter := NewMessageFormatter()

	// Test outgoing message
	sentEntry := cache.MessageEntry{
		ID:            1,
		RecipientNpub: "recipient-npub",
		Message:       "Hello from me",
		SentAt:        time.Now(),
		Direction:     "sent",
	}

	result := formatter.FormatMessageEntry(sentEntry, "", true)
	if !strings.Contains(result, "[orange]You:[white]") {
		t.Error("Expected 'You' label for outgoing message")
	}
	if !strings.Contains(result, "[blue]") {
		t.Error("Expected timestamp formatting")
	}

	// Test received message
	receivedEntry := cache.MessageEntry{
		ID:            2,
		RecipientNpub: "sender-npub",
		Message:       "Hello from them",
		SentAt:        time.Now(),
		Direction:     "received",
	}

	result = formatter.FormatMessageEntry(receivedEntry, "Alice", false)
	if !strings.Contains(result, "[green]Alice:[white]") {
		t.Error("Expected sender name for received message")
	}
}

func TestMessageFormatter_FormatIncomingMessage(t *testing.T) {
	formatter := NewMessageFormatter()

	timestamp := "12:30:45"
	username := "Bob"
	message := "Hello there!"

	result := formatter.FormatIncomingMessage(timestamp, username, message)
	expected := "[blue]12:30:45[white] [green]Bob:[white] Hello there!"

	if result != expected {
		t.Errorf("Expected %q, got %q", expected, result)
	}
}

func containsTimestamp(s string) bool {
	// Simple timestamp format check (HH:MM:SS) - can be in brackets or standalone
	parts := strings.FieldsFunc(s, func(c rune) bool {
		return c == ' ' || c == '[' || c == ']'
	})
	for _, part := range parts {
		if len(part) == 8 && part[2] == ':' && part[5] == ':' {
			return true
		}
	}
	return false
}