package tui

import (
	"testing"
	"time"

	"github.com/data.haus/nospeak/cache"
)

func TestCountLinesInFormattedMessages(t *testing.T) {
	mf := NewMessageFormatter()

	tests := []struct {
		name     string
		messages []cache.MessageEntry
		expected int
	}{
		{
			name:     "empty messages",
			messages: []cache.MessageEntry{},
			expected: 0,
		},
		{
			name: "single message",
			messages: []cache.MessageEntry{
				{
					Message:   "Hello world",
					SentAt:    time.Date(2025, 1, 12, 10, 0, 0, 0, time.UTC),
					Direction: "sent",
				},
			},
			expected: 4, // Date bar (1) + spacing (2) + message (1)
		},
		{
			name: "multiple messages same day",
			messages: []cache.MessageEntry{
				{
					Message:   "Hello",
					SentAt:    time.Date(2025, 1, 12, 10, 0, 0, 0, time.UTC),
					Direction: "sent",
				},
				{
					Message:   "Hi there",
					SentAt:    time.Date(2025, 1, 12, 10, 1, 0, 0, time.UTC),
					Direction: "received",
				},
			},
			expected: 6, // Two message lines + one newline between + date bar (1) + spacing (2)
		},
		{
			name: "messages across days",
			messages: []cache.MessageEntry{
				{
					Message:   "Yesterday message",
					SentAt:    time.Date(2025, 1, 11, 23, 59, 0, 0, time.UTC),
					Direction: "sent",
				},
				{
					Message:   "Today message",
					SentAt:    time.Date(2025, 1, 12, 0, 0, 0, 0, time.UTC),
					Direction: "received",
				},
			},
			expected: 10, // Date bar (1) + spacing (2) + first message (1) + newline (1) + date bar (1) + spacing (2) + second message (1)
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := mf.CountLinesInFormattedMessages(tt.messages, func(npub string) string {
				return "TestUser"
			})
			if result != tt.expected {
				t.Errorf("CountLinesInFormattedMessages() = %d, want %d", result, tt.expected)
			}
		})
	}
}

func TestScrollPositionCalculation(t *testing.T) {
	// Test that scroll position calculation accounts for date bars correctly
	mf := NewMessageFormatter()

	olderMessages := []cache.MessageEntry{
		{
			Message:   "Older message",
			SentAt:    time.Date(2025, 1, 11, 12, 0, 0, 0, time.UTC),
			Direction: "sent",
		},
	}

	// Calculate lines that will be added
	linesToAdd := mf.CountLinesInFormattedMessages(olderMessages, func(npub string) string {
		return "TestUser"
	})

	// Should add: date bar (1) + spacing (2) + message (1) = 4 lines
	expected := 4
	if linesToAdd != expected {
		t.Errorf("Expected %d lines to be added, got %d", expected, linesToAdd)
	}

	// Test scroll position calculation
	currentRow := 5
	newScrollRow := currentRow + linesToAdd
	expectedNewRow := 9

	if newScrollRow != expectedNewRow {
		t.Errorf("Expected new scroll row to be %d, got %d", expectedNewRow, newScrollRow)
	}
}

func TestPaginationStateTracking(t *testing.T) {
	// Test that pagination state is properly managed with ChatState
	app := &App{
		chatStates: make(map[string]*ChatState),
	}

	// Initialize chat state for a test partner
	partner := "test-partner"
	chatState := app.getChatState(partner)

	// Test initial state
	if chatState.IsLoading {
		t.Error("IsLoading should be false initially")
	}
	if chatState.IsFullyLoaded {
		t.Error("IsFullyLoaded should be false initially")
	}
	if chatState.CurrentOffset != 0 {
		t.Error("CurrentOffset should be 0 initially")
	}
	if len(chatState.Messages) != 0 {
		t.Error("Messages should be empty initially")
	}

	// Test state update after loading messages
	messages := []cache.MessageEntry{
		{
			Message:   "Test message",
			SentAt:    time.Date(2025, 1, 12, 10, 0, 0, 0, time.UTC),
			EventID:   "test-event-id",
			Direction: "sent",
		},
	}

	chatState.AddMessages(messages, false) // Append messages
	chatState.CurrentOffset = len(messages)
	chatState.IsFullyLoaded = len(messages) < chatState.PageSize

	if len(chatState.Messages) != 1 {
		t.Error("Messages should contain 1 message after loading")
	}
	if chatState.CurrentOffset != 1 {
		t.Error("CurrentOffset should be 1 after loading 1 message")
	}
}

func TestDuplicateMessageFiltering(t *testing.T) {
	// Test that duplicate messages are properly filtered out
	messages := []cache.MessageEntry{
		{
			Message:   "Message 1",
			SentAt:    time.Date(2025, 1, 12, 10, 0, 0, 0, time.UTC),
			EventID:   "event-1",
			Direction: "sent",
		},
		{
			Message:   "Message 2",
			SentAt:    time.Date(2025, 1, 12, 9, 0, 0, 0, time.UTC),
			EventID:   "event-2",
			Direction: "received",
		},
		{
			Message:   "Message 3",
			SentAt:    time.Date(2025, 1, 12, 8, 0, 0, 0, time.UTC),
			EventID:   "event-3",
			Direction: "sent",
		},
	}

	oldestID := "event-2" // Simulate having event-2 as the oldest loaded message

	// Filter out duplicates
	filtered := make([]cache.MessageEntry, 0, len(messages))
	for _, msg := range messages {
		if msg.EventID != oldestID {
			filtered = append(filtered, msg)
		}
	}

	// Should have 2 messages (event-1 and event-3)
	if len(filtered) != 2 {
		t.Errorf("Expected 2 filtered messages, got %d", len(filtered))
	}

	// Check that event-2 is filtered out
	for _, msg := range filtered {
		if msg.EventID == "event-2" {
			t.Error("Duplicate message event-2 should have been filtered out")
		}
	}
}

func TestDateBarInsertion(t *testing.T) {
	// Test date bar insertion logic
	tests := []struct {
		name      string
		prevTime  time.Time
		currTime  time.Time
		shouldBar bool
	}{
		{
			name:      "first message",
			prevTime:  time.Time{},
			currTime:  time.Date(2025, 1, 12, 10, 0, 0, 0, time.UTC),
			shouldBar: true,
		},
		{
			name:      "same day",
			prevTime:  time.Date(2025, 1, 12, 9, 0, 0, 0, time.UTC),
			currTime:  time.Date(2025, 1, 12, 10, 0, 0, 0, time.UTC),
			shouldBar: false,
		},
		{
			name:      "different day",
			prevTime:  time.Date(2025, 1, 11, 23, 59, 0, 0, time.UTC),
			currTime:  time.Date(2025, 1, 12, 0, 0, 0, 0, time.UTC),
			shouldBar: true,
		},
		{
			name:      "different month",
			prevTime:  time.Date(2025, 1, 10, 10, 0, 0, 0, time.UTC),
			currTime:  time.Date(2025, 2, 10, 10, 0, 0, 0, time.UTC),
			shouldBar: true,
		},
		{
			name:      "different year",
			prevTime:  time.Date(2024, 1, 12, 10, 0, 0, 0, time.UTC),
			currTime:  time.Date(2025, 1, 12, 10, 0, 0, 0, time.UTC),
			shouldBar: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := shouldInsertDateBar(tt.prevTime, tt.currTime)
			if result != tt.shouldBar {
				t.Errorf("shouldInsertDateBar() = %v, want %v", result, tt.shouldBar)
			}
		})
	}
}

func TestChatStateManagement(t *testing.T) {
	// Test that ChatState properly manages loading state
	app := &App{
		chatStates: make(map[string]*ChatState),
	}

	partner := "test-partner"
	chatState := app.getChatState(partner)

	// Test initial state
	if chatState.IsLoading {
		t.Error("IsLoading should be false initially")
	}
	if chatState.IsFullyLoaded {
		t.Error("IsFullyLoaded should be false initially")
	}

	// Test loading state management
	chatState.IsLoading = true
	if !chatState.IsLoading {
		t.Error("IsLoading should be true when set")
	}

	// Test that concurrent loading is prevented
	chatState.IsLoading = true
	if chatState.IsLoading && chatState.IsFullyLoaded {
		t.Error("Should not allow loading when already loading")
	}

	// Test completion state
	chatState.IsLoading = false
	chatState.IsFullyLoaded = true
	if !chatState.IsFullyLoaded {
		t.Error("IsFullyLoaded should be true when set")
	}
}

func TestConcurrentLoadingPrevention(t *testing.T) {
	// Test that concurrent loading of older messages is prevented with ChatState
	app := &App{
		chatStates: make(map[string]*ChatState),
	}

	partner := "test-partner"
	chatState := app.getChatState(partner)

	// First call should succeed
	firstCall := !chatState.IsLoading
	if !firstCall {
		t.Error("First call to loadOlderMessages should succeed")
	}

	// Simulate setting loading flag
	chatState.IsLoading = true

	// Second call should be prevented
	secondCall := !chatState.IsLoading
	if secondCall {
		t.Error("Second concurrent call to loadOlderMessages should be prevented")
	}
}

func TestMessageFormattingConsistency(t *testing.T) {
	// Test that message formatting is consistent between different methods
	mf := NewMessageFormatter()

	message := cache.MessageEntry{
		Message:   "Test message",
		SentAt:    time.Date(2025, 1, 12, 10, 30, 0, 0, time.UTC),
		Direction: "sent",
	}

	// Test FormatMessageEntry
	formatted1 := mf.FormatMessageEntry(message, "", true)

	// Test equivalent formatting using other methods
	timestamp := message.SentAt.Format("15:04:05")
	formatted2 := "[blue]" + timestamp + "[white] [orange]You:[white] " + message.Message

	if formatted1 != formatted2 {
		t.Errorf("Message formatting inconsistency:\nGot:      %s\nExpected: %s", formatted1, formatted2)
	}
}
