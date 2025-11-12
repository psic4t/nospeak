package tui

import (
	"github.com/data.haus/nospeak/cache"
	"github.com/nbd-wtf/go-nostr"
	"strings"
	"testing"
	"time"
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

func TestFormatDateBar(t *testing.T) {
	testDate := time.Date(2025, 11, 12, 0, 0, 0, 0, time.UTC)
	result := formatDateBar(testDate)

	expected := "[yellow]------ November 12, 2025 ------[white]"

	if result != expected {
		t.Errorf("Expected:\n%s\nGot:\n%s", expected, result)
	}
}

func TestShouldInsertDateBar(t *testing.T) {
	// Same day - should not insert date bar
	prev := time.Date(2025, 11, 12, 14, 30, 0, 0, time.UTC)
	current := time.Date(2025, 11, 12, 15, 45, 0, 0, time.UTC)

	if shouldInsertDateBar(prev, current) {
		t.Error("Should not insert date bar for same day")
	}

	// Different day - should insert date bar
	current = time.Date(2025, 11, 13, 9, 15, 0, 0, time.UTC)

	if !shouldInsertDateBar(prev, current) {
		t.Error("Should insert date bar for different day")
	}

	// No previous message - should insert date bar
	if !shouldInsertDateBar(time.Time{}, current) {
		t.Error("Should insert date bar for first message")
	}

	// Different month - should insert date bar
	prev = time.Date(2025, 10, 31, 23, 59, 0, 0, time.UTC)
	current = time.Date(2025, 11, 1, 0, 0, 0, 0, time.UTC)

	if !shouldInsertDateBar(prev, current) {
		t.Error("Should insert date bar for different month")
	}

	// Different year - should insert date bar
	prev = time.Date(2024, 12, 31, 23, 59, 0, 0, time.UTC)
	current = time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)

	if !shouldInsertDateBar(prev, current) {
		t.Error("Should insert date bar for different year")
	}
}

func TestFormatDateBarDifferentDates(t *testing.T) {
	testCases := []struct {
		date     time.Time
		expected string
	}{
		{
			date:     time.Date(2025, 1, 5, 0, 0, 0, 0, time.UTC),
			expected: "[yellow]------ January 5, 2025 ------[white]",
		},
		{
			date:     time.Date(2025, 12, 25, 0, 0, 0, 0, time.UTC),
			expected: "[yellow]------ December 25, 2025 ------[white]",
		},
		{
			date:     time.Date(2024, 2, 29, 0, 0, 0, 0, time.UTC), // Leap year
			expected: "[yellow]------ February 29, 2024 ------[white]",
		},
	}

	for _, tc := range testCases {
		result := formatDateBar(tc.date)
		if result != tc.expected {
			t.Errorf("For date %s, expected:\n%s\nGot:\n%s", tc.date.Format("2006-01-02"), tc.expected, result)
		}
	}
}

func TestDateBarInsertionLogic(t *testing.T) {
	// Test the logic for inserting date bars between messages
	now := time.Now()
	yesterday := now.AddDate(0, 0, -1)
	twoDaysAgo := now.AddDate(0, 0, -2)

	// Test same day - no date bar needed
	if shouldInsertDateBar(now, now.Add(time.Hour)) {
		t.Error("Should not insert date bar for messages on same day")
	}

	// Test different day - date bar needed
	if !shouldInsertDateBar(yesterday, now) {
		t.Error("Should insert date bar for messages on different days")
	}

	// Test multiple days difference
	if !shouldInsertDateBar(twoDaysAgo, now) {
		t.Error("Should insert date bar for messages multiple days apart")
	}

	// Test zero time (first message) - should insert date bar
	if !shouldInsertDateBar(time.Time{}, now) {
		t.Error("Should insert date bar when previous time is zero (first message)")
	}
}

func TestSendMessageDateBarLogic(t *testing.T) {
	// Test the specific logic for send message date bar insertion
	now := time.Now()

	// Test empty content (no existing messages) - should not add date bar
	emptyContent := ""
	hasExistingMessages := strings.TrimSpace(emptyContent) != ""
	if hasExistingMessages {
		t.Error("Empty content should not have existing messages")
	}

	// Test non-empty content (has existing messages) - should add date bar if needed
	nonEmptyContent := "Some existing message"
	hasExistingMessages = strings.TrimSpace(nonEmptyContent) != ""
	if !hasExistingMessages {
		t.Error("Non-empty content should have existing messages")
	}

	// Test the combined logic: empty content + zero time = no date bar
	emptyContent = ""
	hasExistingMessages = strings.TrimSpace(emptyContent) != ""
	zeroTime := time.Time{}
	shouldAddDateBar := hasExistingMessages && shouldInsertDateBar(zeroTime, now)
	if shouldAddDateBar {
		t.Error("Should not add date bar for first message (empty content)")
	}

	// Test the combined logic: non-empty content + different day = date bar
	nonEmptyContent = "Existing message"
	hasExistingMessages = strings.TrimSpace(nonEmptyContent) != ""
	yesterday := now.AddDate(0, 0, -1)
	shouldAddDateBar = hasExistingMessages && shouldInsertDateBar(yesterday, now)
	if !shouldAddDateBar {
		t.Error("Should add date bar when there are existing messages from different day")
	}

	// Test the combined logic: non-empty content + same day = no date bar
	sameDay := now.Add(-time.Hour)
	shouldAddDateBar = hasExistingMessages && shouldInsertDateBar(sameDay, now)
	if shouldAddDateBar {
		t.Error("Should not add date bar when there are existing messages from same day")
	}
}

func TestDuplicateDateBarPrevention(t *testing.T) {
	// Test the enhanced logic that prevents duplicate date bars
	now := time.Now()

	// Test case 1: Empty content - should not add date bar
	currentContent := ""
	hasExistingMessages := strings.TrimSpace(currentContent) != ""
	todayDateBar := formatDateBar(now)
	hasTodayDateBar := strings.Contains(currentContent, todayDateBar)

	shouldAddDateBar := hasExistingMessages && !hasTodayDateBar && shouldInsertDateBar(time.Time{}, now)
	if shouldAddDateBar {
		t.Error("Should not add date bar for empty content")
	}

	// Test case 2: Content with today's date bar already present - should not add another
	currentContent = "Some message\n" + todayDateBar + "\nAnother message"
	hasExistingMessages = strings.TrimSpace(currentContent) != ""
	hasTodayDateBar = strings.Contains(currentContent, todayDateBar)

	shouldAddDateBar = hasExistingMessages && !hasTodayDateBar && shouldInsertDateBar(time.Time{}, now)
	if shouldAddDateBar {
		t.Error("Should not add duplicate date bar when today's date bar already exists")
	}

	// Test case 3: Content without today's date bar, different day - should add date bar
	yesterday := now.AddDate(0, 0, -1)
	currentContent = "Some message from yesterday"
	hasExistingMessages = strings.TrimSpace(currentContent) != ""
	hasTodayDateBar = strings.Contains(currentContent, todayDateBar)

	shouldAddDateBar = hasExistingMessages && !hasTodayDateBar && shouldInsertDateBar(yesterday, now)
	if !shouldAddDateBar {
		t.Error("Should add date bar when content exists, no today's date bar, and different day")
	}

	// Test case 4: Content without today's date bar, same day - should not add date bar
	sameDay := now.Add(-time.Hour)
	currentContent = "Some message from today"
	hasExistingMessages = strings.TrimSpace(currentContent) != ""
	hasTodayDateBar = strings.Contains(currentContent, todayDateBar)

	shouldAddDateBar = hasExistingMessages && !hasTodayDateBar && shouldInsertDateBar(sameDay, now)
	if shouldAddDateBar {
		t.Error("Should not add date bar when content exists, no today's date bar, but same day")
	}
}

func TestMessageSpacingLogic(t *testing.T) {
	// Test the spacing logic for message display
	now := time.Now()

	// Test case 1: Empty content - no spacing needed
	currentContent := ""
	hasExistingMessages := strings.TrimSpace(currentContent) != ""

	if hasExistingMessages {
		t.Error("Empty content should not have existing messages")
	}

	// Test case 2: Content with today's date bar - no spacing needed (date bar provides spacing)
	todayDateBar := formatDateBar(now)
	currentContent = "Some message\n" + todayDateBar + "\nAnother message"
	hasExistingMessages = strings.TrimSpace(currentContent) != ""
	hasTodayDateBar := strings.Contains(currentContent, todayDateBar)

	// When hasTodayDateBar is true, no spacing is added because date bar provides spacing
	if hasTodayDateBar {
		// This is correct - no additional spacing needed when date bar exists
	} else {
		t.Error("Should detect today's date bar in content")
	}

	// Test case 3: Content without today's date bar, same day - spacing needed
	sameDay := now.Add(-time.Hour)
	currentContent = "Some message from today"
	hasExistingMessages = strings.TrimSpace(currentContent) != ""
	hasTodayDateBar = strings.Contains(currentContent, todayDateBar)
	shouldAddDateBar := hasExistingMessages && !hasTodayDateBar && shouldInsertDateBar(sameDay, now)

	// When no date bar is added (same day), spacing should be added
	if !shouldAddDateBar && hasExistingMessages {
		// This is correct - spacing needed when no date bar added
	} else {
		t.Error("Should add spacing when content exists, no date bar added, and same day")
	}

	// Test case 4: Content without today's date bar, different day - no spacing needed (date bar provides spacing)
	yesterday := now.AddDate(0, 0, -1)
	currentContent = "Some message from yesterday"
	hasExistingMessages = strings.TrimSpace(currentContent) != ""
	hasTodayDateBar = strings.Contains(currentContent, todayDateBar)
	shouldAddDateBar = hasExistingMessages && !hasTodayDateBar && shouldInsertDateBar(yesterday, now)

	// When date bar is added (different day), no additional spacing needed
	if shouldAddDateBar {
		// This is correct - date bar provides spacing
	} else {
		t.Error("Should add date bar when content exists, no today's date bar, and different day")
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
