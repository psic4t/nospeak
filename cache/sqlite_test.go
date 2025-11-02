package cache

import (
	"os"
	"testing"
	"time"

	"github.com/data.haus/nospeak/testutils"
)

func TestSQLiteCache(t *testing.T) {
	// Create temporary database
	tempDir := testutils.CreateTempDir(t)

	// Set environment variable to use temp database
	originalCacheHome := os.Getenv("XDG_CACHE_HOME")
	os.Setenv("XDG_CACHE_HOME", tempDir)
	defer os.Setenv("XDG_CACHE_HOME", originalCacheHome)

	// Initialize cache
	cache, err := NewSQLiteCache()
	testutils.AssertNoError(t, err)
	defer cache.Close()

	// Test AddMessage
	err = cache.AddMessage("npub1test...", "Hello, world!", "event123", "sent")
	testutils.AssertNoError(t, err)

	// Test GetMessages
	messages := cache.GetMessages("npub1test...", 10)
	if len(messages) != 1 {
		t.Errorf("Expected 1 message, got %d", len(messages))
	}

	if messages[0].Message != "Hello, world!" {
		t.Errorf("Expected 'Hello, world!', got '%s'", messages[0].Message)
	}

	if messages[0].Direction != "sent" {
		t.Errorf("Expected 'sent', got '%s'", messages[0].Direction)
	}
}

func TestSQLiteCacheMultipleMessages(t *testing.T) {
	tempDir := testutils.CreateTempDir(t)
	originalCacheHome := os.Getenv("XDG_CACHE_HOME")
	os.Setenv("XDG_CACHE_HOME", tempDir)
	defer os.Setenv("XDG_CACHE_HOME", originalCacheHome)

	cache, err := NewSQLiteCache()
	testutils.AssertNoError(t, err)
	defer cache.Close()

	recipientNpub := "npub1test..."

	// Add multiple messages
	for i := 0; i < 5; i++ {
		err := cache.AddMessage(recipientNpub, "Message "+string(rune(i)), "event"+string(rune(i)), "sent")
		testutils.AssertNoError(t, err)
	}

	// Test GetMessages with limit
	messages := cache.GetMessages(recipientNpub, 3)
	if len(messages) != 3 {
		t.Errorf("Expected 3 messages, got %d", len(messages))
	}

	// Test GetMessages without limit
	all := cache.GetMessages(recipientNpub, 0)
	if len(all) != 5 {
		t.Errorf("Expected 5 messages, got %d", len(all))
	}
}

func TestSQLiteCacheGetRecentMessages(t *testing.T) {
	tempDir := testutils.CreateTempDir(t)
	originalCacheHome := os.Getenv("XDG_CACHE_HOME")
	os.Setenv("XDG_CACHE_HOME", tempDir)
	defer os.Setenv("XDG_CACHE_HOME", originalCacheHome)

	cache, err := NewSQLiteCache()
	testutils.AssertNoError(t, err)
	defer cache.Close()

	recipientNpub := "npub1test..."

	// Add sent messages
	for i := 0; i < 3; i++ {
		err := cache.AddMessage(recipientNpub, "Sent message "+string(rune(i)), "sent"+string(rune(i)), "sent")
		testutils.AssertNoError(t, err)
	}

	// Add received messages
	for i := 0; i < 2; i++ {
		err := cache.AddMessage(recipientNpub, "Received message "+string(rune(i)), "recv"+string(rune(i)), "received")
		testutils.AssertNoError(t, err)
	}

	// Test GetRecentMessages
	recent := cache.GetRecentMessages(recipientNpub, 2, 1)
	if len(recent) != 3 {
		t.Errorf("Expected 3 messages (2 sent + 1 received), got %d", len(recent))
	}
}

func TestSQLiteCacheSearchMessages(t *testing.T) {
	tempDir := testutils.CreateTempDir(t)
	originalCacheHome := os.Getenv("XDG_CACHE_HOME")
	os.Setenv("XDG_CACHE_HOME", tempDir)
	defer os.Setenv("XDG_CACHE_HOME", originalCacheHome)

	cache, err := NewSQLiteCache()
	testutils.AssertNoError(t, err)
	defer cache.Close()

	recipientNpub := "npub1test..."

	// Add messages
	messages := []string{
		"Hello world",
		"Test message",
		"Another hello",
		"Final message",
	}

	for i, msg := range messages {
		err := cache.AddMessage(recipientNpub, msg, "event"+string(rune(i)), "sent")
		testutils.AssertNoError(t, err)
	}

	// Search for "hello"
	results := cache.SearchMessages(recipientNpub, "hello")
	if len(results) != 2 {
		t.Errorf("Expected 2 results for 'hello', got %d", len(results))
	}

	// Search for "test"
	results = cache.SearchMessages(recipientNpub, "test")
	if len(results) != 1 {
		t.Errorf("Expected 1 result for 'test', got %d", len(results))
	}

	// Search for non-existent term
	results = cache.SearchMessages(recipientNpub, "nonexistent")
	if len(results) != 0 {
		t.Errorf("Expected 0 results for 'nonexistent', got %d", len(results))
	}
}

func TestSQLiteCacheGetMessageStats(t *testing.T) {
	tempDir := testutils.CreateTempDir(t)
	originalCacheHome := os.Getenv("XDG_CACHE_HOME")
	os.Setenv("XDG_CACHE_HOME", tempDir)
	defer os.Setenv("XDG_CACHE_HOME", originalCacheHome)

	cache, err := NewSQLiteCache()
	testutils.AssertNoError(t, err)
	defer cache.Close()

	recipientNpub := "npub1test..."

	// Add sent messages
	for i := 0; i < 3; i++ {
		err := cache.AddMessage(recipientNpub, "Sent message "+string(rune(i)), "sent"+string(rune(i)), "sent")
		testutils.AssertNoError(t, err)
	}

	// Add received messages
	for i := 0; i < 2; i++ {
		err := cache.AddMessage(recipientNpub, "Received message "+string(rune(i)), "recv"+string(rune(i)), "received")
		testutils.AssertNoError(t, err)
	}

	// Get stats
	sent, received, err := cache.GetMessageStats(recipientNpub)
	testutils.AssertNoError(t, err)

	if sent != 3 {
		t.Errorf("Expected 3 sent messages, got %d", sent)
	}

	if received != 2 {
		t.Errorf("Expected 2 received messages, got %d", received)
	}
}

func TestSQLiteCacheHasMessage(t *testing.T) {
	tempDir := testutils.CreateTempDir(t)
	originalCacheHome := os.Getenv("XDG_CACHE_HOME")
	os.Setenv("XDG_CACHE_HOME", tempDir)
	defer os.Setenv("XDG_CACHE_HOME", originalCacheHome)

	cache, err := NewSQLiteCache()
	testutils.AssertNoError(t, err)
	defer cache.Close()

	recipientNpub := "npub1test..."

	// Add a message
	err = cache.AddMessage(recipientNpub, "Test message", "event123", "sent")
	testutils.AssertNoError(t, err)

	// Test HasMessage
	if !cache.HasMessage("event123") {
		t.Error("Expected HasMessage to return true for existing event")
	}

	if cache.HasMessage("nonexistent") {
		t.Error("Expected HasMessage to return false for non-existent event")
	}
}

func TestSQLiteCacheProfile(t *testing.T) {
	tempDir := testutils.CreateTempDir(t)
	originalCacheHome := os.Getenv("XDG_CACHE_HOME")
	os.Setenv("XDG_CACHE_HOME", tempDir)
	defer os.Setenv("XDG_CACHE_HOME", originalCacheHome)

	cache, err := NewSQLiteCache()
	testutils.AssertNoError(t, err)
	defer cache.Close()

	npub := "npub1test..."

	// Test GetProfile on non-existent profile
	_, exists := cache.GetProfile(npub)
	if exists {
		t.Error("Expected GetProfile to return false for non-existent profile")
	}

	// Set a profile
	profile := ProfileMetadata{
		Name:        "Test User",
		DisplayName: "Test Display Name",
		About:       "Test about",
		Picture:     "https://example.com/pic.jpg",
		NIP05:       "test@example.com",
		LUD16:       "test@ln.example.com",
	}

	err = cache.SetProfile(npub, profile, time.Hour)
	testutils.AssertNoError(t, err)

	// Get the profile
	entry, exists := cache.GetProfile(npub)
	if !exists {
		t.Error("Expected GetProfile to return true for existing profile")
	}

	if entry.Npub != npub {
		t.Errorf("Expected npub %s, got %s", npub, entry.Npub)
	}
}

func TestSQLiteCacheProfileExpiration(t *testing.T) {
	tempDir := testutils.CreateTempDir(t)
	originalCacheHome := os.Getenv("XDG_CACHE_HOME")
	os.Setenv("XDG_CACHE_HOME", tempDir)
	defer os.Setenv("XDG_CACHE_HOME", originalCacheHome)

	cache, err := NewSQLiteCache()
	testutils.AssertNoError(t, err)
	defer cache.Close()

	npub := "npub1test..."

	// Set a profile with very short TTL
	profile := ProfileMetadata{
		Name: "Test User",
	}

	err = cache.SetProfile(npub, profile, time.Millisecond)
	testutils.AssertNoError(t, err)

	// Wait for expiration
	time.Sleep(10 * time.Millisecond)

	// Profile should be expired
	_, exists := cache.GetProfile(npub)
	if exists {
		t.Error("Expected GetProfile to return false for expired profile")
	}
}

func TestSQLiteCacheClear(t *testing.T) {
	tempDir := testutils.CreateTempDir(t)
	originalCacheHome := os.Getenv("XDG_CACHE_HOME")
	os.Setenv("XDG_CACHE_HOME", tempDir)
	defer os.Setenv("XDG_CACHE_HOME", originalCacheHome)

	cache, err := NewSQLiteCache()
	testutils.AssertNoError(t, err)
	defer cache.Close()

	// Add some data
	err = cache.AddMessage("npub1...", "Test message", "event123", "sent")
	testutils.AssertNoError(t, err)

	profile := ProfileMetadata{Name: "Test User"}
	err = cache.SetProfile("npub1...", profile, time.Hour)
	testutils.AssertNoError(t, err)

	// Verify data exists
	messages := cache.GetMessages("npub1...", 0)
	if len(messages) != 1 {
		t.Error("Expected 1 message before clear")
	}

	// Clear cache
	err = cache.Clear()
	testutils.AssertNoError(t, err)

	// Verify data is cleared
	messages = cache.GetMessages("npub1...", 0)
	if len(messages) != 0 {
		t.Error("Expected 0 messages after clear")
	}

	_, exists := cache.GetProfile("npub1...")
	if exists {
		t.Error("Expected no profiles after clear")
	}
}

func TestSQLiteCacheGetStats(t *testing.T) {
	tempDir := testutils.CreateTempDir(t)
	originalCacheHome := os.Getenv("XDG_CACHE_HOME")
	os.Setenv("XDG_CACHE_HOME", tempDir)
	defer os.Setenv("XDG_CACHE_HOME", originalCacheHome)

	cache, err := NewSQLiteCache()
	testutils.AssertNoError(t, err)
	defer cache.Close()

	// Add some data
	for i := 0; i < 5; i++ {
		err := cache.AddMessage("npub1...", "Message "+string(rune(i)), "event"+string(rune(i)), "sent")
		testutils.AssertNoError(t, err)
	}

	profile := ProfileMetadata{Name: "Test User"}
	err = cache.SetProfile("npub1...", profile, time.Hour)
	testutils.AssertNoError(t, err)

	// Get stats
	stats := cache.GetStats()

	if stats.TotalMessages != 5 {
		t.Errorf("Expected 5 total messages, got %d", stats.TotalMessages)
	}

	if stats.TotalProfiles != 1 {
		t.Errorf("Expected 1 total profile, got %d", stats.TotalProfiles)
	}
}

func TestSQLiteCacheVacuum(t *testing.T) {
	tempDir := testutils.CreateTempDir(t)
	originalCacheHome := os.Getenv("XDG_CACHE_HOME")
	os.Setenv("XDG_CACHE_HOME", tempDir)
	defer os.Setenv("XDG_CACHE_HOME", originalCacheHome)

	cache, err := NewSQLiteCache()
	testutils.AssertNoError(t, err)
	defer cache.Close()

	// Vacuum should not error
	err = cache.Vacuum()
	testutils.AssertNoError(t, err)
}

func TestSQLiteCacheAddMessageWithTimestamp(t *testing.T) {
	tempDir := testutils.CreateTempDir(t)
	originalCacheHome := os.Getenv("XDG_CACHE_HOME")
	os.Setenv("XDG_CACHE_HOME", tempDir)
	defer os.Setenv("XDG_CACHE_HOME", originalCacheHome)

	cache, err := NewSQLiteCache()
	testutils.AssertNoError(t, err)
	defer cache.Close()

	recipientNpub := "npub1test..."

	// Add message with specific timestamp
	specificTime := time.Date(2023, 1, 1, 12, 0, 0, 0, time.UTC)
	err = cache.AddMessageWithTimestamp(recipientNpub, "Test message", "event123", "sent", specificTime)
	testutils.AssertNoError(t, err)

	// Verify timestamp
	messages := cache.GetMessages(recipientNpub, 1)
	if len(messages) != 1 {
		t.Fatal("Expected 1 message")
	}

	if !messages[0].SentAt.Equal(specificTime) {
		t.Errorf("Expected timestamp %v, got %v", specificTime, messages[0].SentAt)
	}
}

func TestSQLiteCacheGetMessagesByDateRange(t *testing.T) {
	tempDir := testutils.CreateTempDir(t)
	originalCacheHome := os.Getenv("XDG_CACHE_HOME")
	os.Setenv("XDG_CACHE_HOME", tempDir)
	defer os.Setenv("XDG_CACHE_HOME", originalCacheHome)

	cache, err := NewSQLiteCache()
	testutils.AssertNoError(t, err)
	defer cache.Close()

	recipientNpub := "npub1test..."

	// Add messages at different times
	baseTime := time.Date(2023, 1, 1, 12, 0, 0, 0, time.UTC)

	for i := 0; i < 5; i++ {
		msgTime := baseTime.Add(time.Duration(i) * time.Hour)
		err := cache.AddMessageWithTimestamp(recipientNpub, "Message "+string(rune(i)), "event"+string(rune(i)), "sent", msgTime)
		testutils.AssertNoError(t, err)
	}

	// Get messages in date range (exclusive of start, inclusive of end)
	start := baseTime.Add(1 * time.Hour).Add(time.Minute) // Just after 1 hour
	end := baseTime.Add(3 * time.Hour)

	messages := cache.GetMessagesByDateRange(recipientNpub, start, end)

	// Should get messages 2 and 3 (indices 1 and 2)
	if len(messages) != 2 {
		t.Errorf("Expected 2 messages in date range, got %d", len(messages))
	}
}
