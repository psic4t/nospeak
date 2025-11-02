package mocks

import (
	"fmt"
	"sync"
	"time"

	"github.com/data.haus/nospeak/cache"
)

// MockCache implements the Cache interface for testing
type MockCache struct {
	messages map[string][]cache.MessageEntry
	profiles map[string]cache.ProfileEntry
	stats    cache.CacheStats
	mu       sync.RWMutex
}

// NewMockCache creates a new mock cache instance
func NewMockCache() *MockCache {
	return &MockCache{
		messages: make(map[string][]cache.MessageEntry),
		profiles: make(map[string]cache.ProfileEntry),
		stats:    cache.CacheStats{},
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

	profileJSON := fmt.Sprintf(`{"name":"%s","display_name":"%s","about":"%s","picture":"%s","nip05":"%s","lud16":"%s"}`,
		profile.Name, profile.DisplayName, profile.About, profile.Picture, profile.NIP05, profile.LUD16)

	entry := cache.ProfileEntry{
		ID:        int64(len(m.profiles) + 1),
		Npub:      npub,
		Profile:   profileJSON,
		CachedAt:  time.Now(),
		ExpiresAt: time.Now().Add(ttl),
		CreatedAt: time.Now(),
	}

	m.profiles[npub] = entry
	m.stats.TotalProfiles++
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
