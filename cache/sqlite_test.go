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

	err = cache.SetProfileWithRelayList(npub, profile, nil, nil, "", time.Hour)
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

	err = cache.SetProfileWithRelayList(npub, profile, nil, nil, "", time.Millisecond)
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
	err = cache.SetProfileWithRelayList("npub1...", profile, nil, nil, "", time.Hour)
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
	err = cache.SetProfileWithRelayList("npub1...", profile, nil, nil, "", time.Hour)
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

// Test relay list caching functionality
func TestRelayListCaching(t *testing.T) {
	tempDir := testutils.CreateTempDir(t)
	originalCacheHome := os.Getenv("XDG_CACHE_HOME")
	os.Setenv("XDG_CACHE_HOME", tempDir)
	defer os.Setenv("XDG_CACHE_HOME", originalCacheHome)

	cache, err := NewSQLiteCache()
	testutils.AssertNoError(t, err)
	defer cache.Close()

	// Test data
	npub := "npub1test..."
	profile := ProfileMetadata{
		Name:        "Test User",
		DisplayName: "Test Display",
		About:       "Test profile for relay list caching",
	}
	relayList := []string{"wss://relay1.com", "wss://relay2.com", "wss://relay3.com"}
	relayListEventID := "event12345"

	// Test SetProfileWithRelayList
	err = cache.SetProfileWithRelayList(npub, profile, relayList, relayList, relayListEventID, 24*time.Hour)
	testutils.AssertNoError(t, err)

	// Test GetProfile includes relay list
	cachedProfile, found := cache.GetProfile(npub)
	if !found {
		t.Fatalf("Expected to find cached profile")
	}

	// Verify profile metadata
	if cachedProfile.Name != profile.Name {
		t.Errorf("Expected name '%s', got '%s'", profile.Name, cachedProfile.Name)
	}

	// Verify relay list
	if !cachedProfile.HasRelayList() {
		t.Errorf("Expected profile to have relay list")
	}

	cachedRelays := cachedProfile.GetRelayList()
	if len(cachedRelays) != len(relayList) {
		t.Errorf("Expected %d relays, got %d", len(relayList), len(cachedRelays))
	}

	for i, relay := range relayList {
		if cachedRelays[i] != relay {
			t.Errorf("Expected relay '%s' at index %d, got '%s'", relay, i, cachedRelays[i])
		}
	}

	if cachedProfile.RelayListEventID != relayListEventID {
		t.Errorf("Expected relay list event ID '%s', got '%s'", relayListEventID, cachedProfile.RelayListEventID)
	}
}

func TestUpdateRelayList(t *testing.T) {
	tempDir := testutils.CreateTempDir(t)
	originalCacheHome := os.Getenv("XDG_CACHE_HOME")
	os.Setenv("XDG_CACHE_HOME", tempDir)
	defer os.Setenv("XDG_CACHE_HOME", originalCacheHome)

	cache, err := NewSQLiteCache()
	testutils.AssertNoError(t, err)
	defer cache.Close()

	// Test data
	npub := "npub1updaterelay..."
	profile := ProfileMetadata{
		Name: "Update Test",
	}
	initialRelays := []string{"wss://initial.com"}
	updatedRelays := []string{"wss://updated1.com", "wss://updated2.com"}
	initialEventID := "initial123"
	updatedEventID := "updated456"

	// Set initial profile with relay list
	err = cache.SetProfileWithRelayList(npub, profile, initialRelays, initialRelays, initialEventID, 24*time.Hour)
	testutils.AssertNoError(t, err)

	// Verify initial state
	cachedProfile, _ := cache.GetProfile(npub)
	cachedRelays := cachedProfile.GetRelayList()
	if len(cachedRelays) != 1 || cachedRelays[0] != initialRelays[0] {
		t.Errorf("Initial relay list incorrect: expected %v, got %v", initialRelays, cachedRelays)
	}

	// Update only the relay list by updating profile with existing metadata but new relay list
	cachedProfile, _ = cache.GetProfile(npub)
	existingProfile := cachedProfile.ToProfileMetadata()
	err = cache.SetProfileWithRelayList(npub, existingProfile, updatedRelays, updatedRelays, updatedEventID, 24*time.Hour)
	testutils.AssertNoError(t, err)

	// Verify updated relay list
	cachedProfile, _ = cache.GetProfile(npub)
	cachedRelays = cachedProfile.GetRelayList()
	if len(cachedRelays) != len(updatedRelays) {
		t.Errorf("Expected %d updated relays, got %d", len(updatedRelays), len(cachedRelays))
	}

	for i, relay := range updatedRelays {
		if cachedRelays[i] != relay {
			t.Errorf("Expected updated relay '%s' at index %d, got '%s'", relay, i, cachedRelays[i])
		}
	}

	// Verify profile metadata is preserved
	if cachedProfile.Name != profile.Name {
		t.Errorf("Expected profile name to be preserved as '%s', got '%s'", profile.Name, cachedProfile.Name)
	}

	// Verify event ID is updated
	if cachedProfile.RelayListEventID != updatedEventID {
		t.Errorf("Expected updated event ID '%s', got '%s'", updatedEventID, cachedProfile.RelayListEventID)
	}
}

func TestProfileEntryRelayListHelpers(t *testing.T) {
	// Test GetRelayList with empty data
	emptyProfile := ProfileEntry{}
	if relays := emptyProfile.GetRelayList(); relays != nil {
		t.Errorf("Expected nil relays for empty profile, got %v", relays)
	}

	if emptyProfile.HasRelayList() {
		t.Errorf("Expected HasRelayList to return false for empty profile")
	}

	// Test GetRelayList with JSON data
	profileWithRelays := ProfileEntry{
		RelayList:          `["wss://relay1.com", "wss://relay2.com"]`,
		RelayListUpdatedAt: time.Now(),
	}

	if !profileWithRelays.HasRelayList() {
		t.Errorf("Expected HasRelayList to return true for profile with relays")
	}

	relays := profileWithRelays.GetRelayList()
	expectedRelays := []string{"wss://relay1.com", "wss://relay2.com"}
	if len(relays) != len(expectedRelays) {
		t.Errorf("Expected %d relays, got %d", len(expectedRelays), len(relays))
	}

	for i, expected := range expectedRelays {
		if relays[i] != expected {
			t.Errorf("Expected relay '%s' at index %d, got '%s'", expected, i, relays[i])
		}
	}

	// Test GetRelayList with empty JSON array
	emptyJSONArrayProfile := ProfileEntry{
		RelayList:          `[]`,
		RelayListUpdatedAt: time.Now(),
	}

	relays = emptyJSONArrayProfile.GetRelayList()
	if relays != nil {
		t.Errorf("Expected nil relays for empty JSON array, got %v", relays)
	}
}

func TestRelayListMigration(t *testing.T) {
	tempDir := testutils.CreateTempDir(t)
	originalCacheHome := os.Getenv("XDG_CACHE_HOME")
	os.Setenv("XDG_CACHE_HOME", tempDir)
	defer os.Setenv("XDG_CACHE_HOME", originalCacheHome)

	// Test that new cache instances have the relay list columns
	cache, err := NewSQLiteCache()
	testutils.AssertNoError(t, err)
	defer cache.Close()

	// Verify we can use the new relay list methods without errors
	npub := "npub1migrationtest..."
	profile := ProfileMetadata{Name: "Migration Test"}
	relays := []string{"wss://migration.test"}

	err = cache.SetProfileWithRelayList(npub, profile, relays, relays, "migration123", 24*time.Hour)
	testutils.AssertNoError(t, err)

	// Verify the data was stored correctly
	cachedProfile, found := cache.GetProfile(npub)
	if !found {
		t.Fatalf("Expected to find migrated profile")
	}

	if !cachedProfile.HasRelayList() {
		t.Errorf("Expected migrated profile to have relay list")
	}

	cachedRelays := cachedProfile.GetRelayList()
	if len(cachedRelays) != 1 || cachedRelays[0] != relays[0] {
		t.Errorf("Migration test failed: expected %v, got %v", relays, cachedRelays)
	}
}

func TestProfileUpdatePreservesRelayList(t *testing.T) {
	tempDir := testutils.CreateTempDir(t)
	originalCacheHome := os.Getenv("XDG_CACHE_HOME")
	os.Setenv("XDG_CACHE_HOME", tempDir)
	defer os.Setenv("XDG_CACHE_HOME", originalCacheHome)

	cache, err := NewSQLiteCache()
	testutils.AssertNoError(t, err)
	defer cache.Close()

	// Test data
	npub := "npub1preservetest..."
	profile := ProfileMetadata{
		Name:        "Original Name",
		DisplayName: "Original Display",
		About:       "Original about",
	}
	relayList := []string{"wss://relay1.com", "wss://relay2.com", "wss://relay3.com"}
	relayListEventID := "relay123"

	// First, set profile with NIP-65 relay data
	err = cache.SetProfileWithRelayList(npub, profile, relayList, relayList, relayListEventID, 24*time.Hour)
	testutils.AssertNoError(t, err)

	// Verify initial state
	cachedProfile, found := cache.GetProfile(npub)
	if !found {
		t.Error("Expected to find cached profile")
	}

	if cachedProfile.Name != profile.Name {
		t.Errorf("Expected name '%s', got '%s'", profile.Name, cachedProfile.Name)
	}

	// Verify NIP-65 relay list (new unified approach)
	cachedReadRelays := cachedProfile.GetReadRelays()
	cachedWriteRelays := cachedProfile.GetWriteRelays()

	// Check if we have either read or write relays
	if len(cachedReadRelays) == 0 && len(cachedWriteRelays) == 0 {
		t.Error("Expected either read or write relays to be cached")
	}

	// For backward compatibility, also check legacy relay list
	cachedRelays := cachedProfile.GetRelayList()
	if len(cachedRelays) != len(relayList) {
		t.Errorf("Initial relay list incorrect: expected %v, got %v", relayList, cachedRelays)
	}

	if cachedProfile.Name != profile.Name {
		t.Errorf("Expected name '%s', got '%s'", profile.Name, cachedProfile.Name)
	}

	initialRelays := cachedProfile.GetRelayList()
	if len(initialRelays) != len(relayList) {
		t.Fatalf("Initial relay list incorrect: expected %d relays, got %d", len(relayList), len(initialRelays))
	}

	// Now update just the profile metadata using SetProfile (should preserve relay list)
	updatedProfile := ProfileMetadata{
		Name:        "Updated Name",
		DisplayName: "Updated Display",
		About:       "Updated about",
	}

	err = cache.SetProfileWithRelayList(npub, updatedProfile, nil, nil, "", 24*time.Hour)
	testutils.AssertNoError(t, err)

	// Verify that relay list is preserved
	updatedCachedProfile, found := cache.GetProfile(npub)
	if !found {
		t.Fatalf("Expected to find cached profile after update")
	}

	// Check that profile metadata was updated
	if updatedCachedProfile.Name != updatedProfile.Name {
		t.Errorf("Expected profile name to be updated to '%s', got '%s'", updatedProfile.Name, updatedCachedProfile.Name)
	}

	if updatedCachedProfile.DisplayName != updatedProfile.DisplayName {
		t.Errorf("Expected display name to be updated to '%s', got '%s'", updatedProfile.DisplayName, updatedCachedProfile.DisplayName)
	}

	if updatedCachedProfile.About != updatedProfile.About {
		t.Errorf("Expected about to be updated to '%s', got '%s'", updatedProfile.About, updatedCachedProfile.About)
	}

	// Check that relay list is preserved
	preservedRelays := updatedCachedProfile.GetRelayList()
	if len(preservedRelays) != len(initialRelays) {
		t.Errorf("Relay list not preserved: expected %d relays, got %d", len(initialRelays), len(preservedRelays))
	}

	for i, expected := range initialRelays {
		if preservedRelays[i] != expected {
			t.Errorf("Relay %d not preserved: expected '%s', got '%s'", i, expected, preservedRelays[i])
		}
	}

	// Verify other relay list metadata is preserved
	if updatedCachedProfile.RelayListEventID != relayListEventID {
		t.Errorf("Expected relay list event ID to be preserved as '%s', got '%s'", relayListEventID, updatedCachedProfile.RelayListEventID)
	}

	if updatedCachedProfile.RelayListUpdatedAt.IsZero() {
		t.Errorf("Expected relay list updated timestamp to be preserved")
	}
}
