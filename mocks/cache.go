package mocks

import (
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/data.haus/nospeak/cache"
)

// serializeRelayList converts a slice of relay URLs to JSON array format
func serializeRelayList(relayList []string) string {
	if len(relayList) == 0 {
		return ""
	}

	// Simple JSON array serialization
	var jsonParts []string
	for _, relay := range relayList {
		jsonParts = append(jsonParts, fmt.Sprintf(`"%s"`, relay))
	}

	return fmt.Sprintf("[%s]", strings.Join(jsonParts, ","))
}

// MockCache implements the Cache interface for testing
type MockCache struct {
	messages     map[string][]cache.MessageEntry
	profiles     map[string]cache.ProfileEntry
	userProfiles map[string]cache.UserProfileEntry
	stats        cache.CacheStats
	mu           sync.RWMutex
}

// NewMockCache creates a new mock cache instance
func NewMockCache() *MockCache {
	return &MockCache{
		messages:     make(map[string][]cache.MessageEntry),
		profiles:     make(map[string]cache.ProfileEntry),
		userProfiles: make(map[string]cache.UserProfileEntry),
		stats:        cache.CacheStats{},
	}
}

// Message methods

func (m *MockCache) AddMessage(recipientNpub, message, eventID, direction string) error {
	return m.AddMessageWithTimestamp(recipientNpub, message, eventID, direction, time.Now())
}

func (m *MockCache) AddMessageWithTimestamp(recipientNpub, message, eventID, direction string, sentAt time.Time) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	entry := cache.MessageEntry{
		ID:            int64(len(m.messages[recipientNpub]) + 1),
		RecipientNpub: recipientNpub,
		Message:       message,
		SentAt:        sentAt,
		EventID:       eventID,
		Direction:     direction,
		CreatedAt:     time.Now(),
	}

	m.messages[recipientNpub] = append(m.messages[recipientNpub], entry)
	m.stats.TotalMessages++
	return nil
}

func (m *MockCache) GetMessages(recipientNpub string, limit int) []cache.MessageEntry {
	m.mu.RLock()
	defer m.mu.RUnlock()

	messages, exists := m.messages[recipientNpub]
	if !exists {
		return []cache.MessageEntry{}
	}

	if limit > 0 && len(messages) > limit {
		return messages[:limit]
	}
	return messages
}

func (m *MockCache) GetRecentMessages(recipientNpub string, sentLimit, receivedLimit int) []cache.MessageEntry {
	m.mu.RLock()
	defer m.mu.RUnlock()

	messages, exists := m.messages[recipientNpub]
	if !exists {
		return []cache.MessageEntry{}
	}

	var sentMessages []cache.MessageEntry
	var receivedMessages []cache.MessageEntry

	for _, msg := range messages {
		if msg.Direction == "sent" && len(sentMessages) < sentLimit {
			sentMessages = append(sentMessages, msg)
		} else if msg.Direction == "received" && len(receivedMessages) < receivedLimit {
			receivedMessages = append(receivedMessages, msg)
		}
	}

	// Combine and sort chronologically
	allMessages := append(sentMessages, receivedMessages...)
	// Sort by timestamp (simple implementation)
	for i := 0; i < len(allMessages); i++ {
		for j := i + 1; j < len(allMessages); j++ {
			if allMessages[i].SentAt.After(allMessages[j].SentAt) {
				allMessages[i], allMessages[j] = allMessages[j], allMessages[i]
			}
		}
	}

	return allMessages
}

func (m *MockCache) SearchMessages(recipientNpub, query string) []cache.MessageEntry {
	m.mu.RLock()
	defer m.mu.RUnlock()

	messages, exists := m.messages[recipientNpub]
	if !exists {
		return []cache.MessageEntry{}
	}

	var results []cache.MessageEntry
	for _, msg := range messages {
		// Simple substring search
		if contains(msg.Message, query) {
			results = append(results, msg)
		}
	}
	return results
}

func (m *MockCache) GetMessagesByDateRange(recipientNpub string, start, end time.Time) []cache.MessageEntry {
	m.mu.RLock()
	defer m.mu.RUnlock()

	messages, exists := m.messages[recipientNpub]
	if !exists {
		return []cache.MessageEntry{}
	}

	var results []cache.MessageEntry
	for _, msg := range messages {
		if msg.SentAt.After(start) && msg.SentAt.Before(end) {
			results = append(results, msg)
		}
	}
	return results
}

func (m *MockCache) GetMessageStats(recipientNpub string) (sent, received int, err error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	messages, exists := m.messages[recipientNpub]
	if !exists {
		return 0, 0, nil
	}

	for _, msg := range messages {
		if msg.Direction == "sent" {
			sent++
		} else if msg.Direction == "received" {
			received++
		}
	}
	return sent, received, nil
}

func (m *MockCache) HasMessage(eventID string) bool {
	m.mu.RLock()
	defer m.mu.RUnlock()

	for _, messages := range m.messages {
		for _, msg := range messages {
			if msg.EventID == eventID {
				return true
			}
		}
	}
	return false
}

// Profile methods

func (m *MockCache) GetProfile(npub string) (cache.ProfileEntry, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	profile, exists := m.profiles[npub]
	if !exists {
		return cache.ProfileEntry{}, false
	}

	// Check if expired
	if time.Now().After(profile.ExpiresAt) {
		delete(m.profiles, npub)
		m.stats.ExpiredProfiles++
		return cache.ProfileEntry{}, false
	}

	return profile, true
}

func (m *MockCache) SetProfile(npub string, profile cache.ProfileMetadata, ttl time.Duration) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	entry := cache.ProfileEntry{
		ID:          int64(len(m.profiles) + 1),
		Npub:        npub,
		Name:        profile.Name,
		DisplayName: profile.DisplayName,
		About:       profile.About,
		Picture:     profile.Picture,
		NIP05:       profile.NIP05,
		LUD16:       profile.LUD16,
		Website:     profile.Website,
		Banner:      profile.Banner,
		CachedAt:    time.Now(),
		ExpiresAt:   time.Now().Add(ttl),
		CreatedAt:   time.Now(),
	}

	m.profiles[npub] = entry
	m.stats.TotalProfiles++
	return nil
}

// User profile methods
func (m *MockCache) GetUserProfile(npub string) (cache.UserProfileEntry, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	profile, exists := m.userProfiles[npub]
	return profile, exists
}

func (m *MockCache) SetUserProfile(npub string, readRelays, writeRelays []string, ttl time.Duration) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	entry := cache.UserProfileEntry{
		Npub:         npub,
		ReadRelays:   serializeRelayList(readRelays),
		WriteRelays:  serializeRelayList(writeRelays),
		DiscoveredAt: time.Now(),
		ExpiresAt:    time.Now().Add(ttl),
		CreatedAt:    time.Now(),
	}

	m.userProfiles[npub] = entry
	return nil
}

func (m *MockCache) GetCachedReadRelays(npub string) []string {
	if profile, found := m.GetUserProfile(npub); found && !profile.IsExpired() {
		return profile.GetReadRelays()
	}
	return nil
}

func (m *MockCache) GetCachedWriteRelays(npub string) []string {
	if profile, found := m.GetUserProfile(npub); found && !profile.IsExpired() {
		return profile.GetWriteRelays()
	}
	return nil
}

func (m *MockCache) ClearExpiredUserProfiles() error {
	m.mu.Lock()
	defer m.mu.Unlock()

	for npub, profile := range m.userProfiles {
		if profile.IsExpired() {
			delete(m.userProfiles, npub)
		}
	}

	return nil
}

func (m *MockCache) ClearExpiredProfiles() error {
	m.mu.Lock()
	defer m.mu.Unlock()

	now := time.Now()
	for npub, profile := range m.profiles {
		if now.After(profile.ExpiresAt) {
			delete(m.profiles, npub)
			m.stats.ExpiredProfiles++
		}
	}
	return nil
}

// Maintenance methods

func (m *MockCache) Clear() error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.messages = make(map[string][]cache.MessageEntry)
	m.profiles = make(map[string]cache.ProfileEntry)
	m.stats = cache.CacheStats{}
	return nil
}

func (m *MockCache) Vacuum() error {
	// No-op for mock cache
	return nil
}

func (m *MockCache) GetStats() cache.CacheStats {
	m.mu.RLock()
	defer m.mu.RUnlock()

	// Update current stats
	m.stats.TotalProfiles = len(m.profiles)

	expiredCount := 0
	now := time.Now()
	for _, profile := range m.profiles {
		if now.After(profile.ExpiresAt) {
			expiredCount++
		}
	}
	m.stats.ExpiredProfiles = expiredCount

	return m.stats
}

// GetMessagesWithOffset returns messages with offset (mock implementation)
func (m *MockCache) GetMessagesWithOffset(recipientNpub string, offset, limit int) []cache.MessageEntry {
	m.mu.RLock()
	defer m.mu.RUnlock()

	messages, exists := m.messages[recipientNpub]
	if !exists {
		return nil
	}

	if offset >= len(messages) {
		return nil
	}

	end := offset + limit
	if end > len(messages) {
		end = len(messages)
	}

	result := make([]cache.MessageEntry, end-offset)
	copy(result, messages[offset:end])
	return result
}

// GetLatestMessages returns most recent messages (mock implementation)
func (m *MockCache) GetLatestMessages(recipientNpub string, limit int) []cache.MessageEntry {
	m.mu.RLock()
	defer m.mu.RUnlock()

	messages, exists := m.messages[recipientNpub]
	if !exists {
		return nil
	}

	// Return last 'limit' messages
	if len(messages) <= limit {
		result := make([]cache.MessageEntry, len(messages))
		copy(result, messages)
		return result
	}

	start := len(messages) - limit
	result := make([]cache.MessageEntry, limit)
	copy(result, messages[start:])
	return result
}

// GetMessagesBefore returns messages before cutoff time (mock implementation)
func (m *MockCache) GetMessagesBefore(recipientNpub string, cutoff time.Time, limit int) []cache.MessageEntry {
	m.mu.RLock()
	defer m.mu.RUnlock()

	messages, exists := m.messages[recipientNpub]
	if !exists {
		return nil
	}

	var result []cache.MessageEntry
	for _, message := range messages {
		if message.SentAt.Before(cutoff) {
			result = append(result, message)
			if len(result) >= limit {
				break
			}
		}
	}

	return result
}

// GetSortedPartners returns sorted list of partners (mock implementation)
func (m *MockCache) GetSortedPartners(partners []string) []string {
	// Simple implementation - return as-is
	return partners
}

// SetProfileWithRelayList sets profile with relay list (mock implementation)
func (m *MockCache) SetProfileWithRelayList(npub string, profile cache.ProfileMetadata, relayList []string, relayListEventID string, ttl time.Duration) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	entry := cache.ProfileEntry{
		Npub:               npub,
		Name:               profile.Name,
		DisplayName:        profile.DisplayName,
		About:              profile.About,
		Picture:            profile.Picture,
		NIP05:              profile.NIP05,
		LUD16:              profile.LUD16,
		Website:            profile.Website,
		Banner:             profile.Banner,
		RelayList:          serializeRelayList(relayList),
		RelayListEventID:   relayListEventID,
		RelayListUpdatedAt: time.Now(),
		CachedAt:           time.Now(),
		ExpiresAt:          time.Now().Add(ttl),
		CreatedAt:          time.Now(),
	}

	m.profiles[npub] = entry
	m.stats.TotalProfiles++
	return nil
}

// SetCache is a no-op for MockCache
func (m *MockCache) SetCache(cache interface{}) {
	// No-op for mock
}

// Helper function for substring search
func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(substr) == 0 ||
		(len(s) > len(substr) && indexOf(s, substr) >= 0))
}

func indexOf(s, substr string) int {
	n := len(substr)
	if n == 0 {
		return 0
	}
	if n > len(s) {
		return -1
	}
	for i := 0; i <= len(s)-n; i++ {
		if s[i:i+n] == substr {
			return i
		}
	}
	return -1
}
