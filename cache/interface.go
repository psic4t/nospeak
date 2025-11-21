package cache

import (
	"strings"
	"time"
)

// ProfileMetadata represents a Nostr profile metadata structure
type ProfileMetadata struct {
	Name        string `json:"name"`
	DisplayName string `json:"display_name"`
	About       string `json:"about"`
	Picture     string `json:"picture"`
	NIP05       string `json:"nip05"`
	LUD16       string `json:"lud16"`
	Website     string `json:"website"`
	Banner      string `json:"banner"`
}

type MessageEntry struct {
	ID            int64     `json:"id"`
	RecipientNpub string    `json:"recipient_npub"`
	Message       string    `json:"message"`
	SentAt        time.Time `json:"sent_at"`
	EventID       string    `json:"event_id"`
	Direction     string    `json:"direction"` // "sent" or "received"
	CreatedAt     time.Time `json:"created_at"`
}

type ProfileEntry struct {
	ID          int64  `json:"id"`
	Npub        string `json:"npub"`
	Name        string `json:"name"`
	DisplayName string `json:"display_name"`
	About       string `json:"about"`
	Picture     string `json:"picture"`
	NIP05       string `json:"nip05"`
	LUD16       string `json:"lud16"`
	Website     string `json:"website"`
	Banner      string `json:"banner"`
	// Legacy relay list (will be removed after migration)
	RelayList string `json:"relay_list"` // JSON array of relay URLs
	// NIP-65 relay information (from user_profile consolidation)
	ReadRelays  string    `json:"read_relays"`  // JSON array of read relay URLs
	WriteRelays string    `json:"write_relays"` // JSON array of write relay URLs
	CachedAt    time.Time `json:"cached_at"`
	ExpiresAt   time.Time `json:"expires_at"`
	CreatedAt   time.Time `json:"created_at"`
}

// ToProfileMetadata converts ProfileEntry to ProfileMetadata
func (pe ProfileEntry) ToProfileMetadata() ProfileMetadata {
	return ProfileMetadata{
		Name:        pe.Name,
		DisplayName: pe.DisplayName,
		About:       pe.About,
		Picture:     pe.Picture,
		NIP05:       pe.NIP05,
		LUD16:       pe.LUD16,
		Website:     pe.Website,
		Banner:      pe.Banner,
	}
}

// GetRelayList parses and returns the relay list as a string slice
// Deprecated: Use GetReadRelays or GetWriteRelays instead
func (pe ProfileEntry) GetRelayList() []string {
	// Prefer NIP-65 read relays as the default "relay list"
	if pe.ReadRelays != "" {
		return parseRelayJSON(pe.ReadRelays)
	}
	// Fallback to legacy relay list
	if pe.RelayList != "" {
		return parseRelayJSON(pe.RelayList)
	}
	return nil
}

// HasRelayList returns true if the profile has a cached relay list
// Deprecated: Use HasReadRelays or HasWriteRelays instead
func (pe ProfileEntry) HasRelayList() bool {
	return pe.ReadRelays != "" || pe.RelayList != ""
}

// GetReadRelays parses and returns read relays as a string slice
func (pe ProfileEntry) GetReadRelays() []string {
	return parseRelayJSON(pe.ReadRelays)
}

// GetWriteRelays parses and returns write relays as a string slice
func (pe ProfileEntry) GetWriteRelays() []string {
	return parseRelayJSON(pe.WriteRelays)
}

// HasReadRelays returns true if profile has cached read relays
func (pe ProfileEntry) HasReadRelays() bool {
	return pe.ReadRelays != ""
}

// HasWriteRelays returns true if profile has cached write relays
func (pe ProfileEntry) HasWriteRelays() bool {
	return pe.WriteRelays != ""
}

type UserProfileEntry struct {
	ID           int64     `json:"id"`
	Npub         string    `json:"npub"`
	ReadRelays   string    `json:"read_relays"`  // JSON array of read relay URLs
	WriteRelays  string    `json:"write_relays"` // JSON array of write relay URLs
	DiscoveredAt time.Time `json:"discovered_at"`
	ExpiresAt    time.Time `json:"expires_at"`
	CreatedAt    time.Time `json:"created_at"`
}

// GetReadRelays parses and returns read relays as a string slice
func (upe UserProfileEntry) GetReadRelays() []string {
	return parseRelayJSON(upe.ReadRelays)
}

// GetWriteRelays parses and returns write relays as a string slice
func (upe UserProfileEntry) GetWriteRelays() []string {
	return parseRelayJSON(upe.WriteRelays)
}

// HasReadRelays returns true if user profile has cached read relays
func (upe UserProfileEntry) HasReadRelays() bool {
	return upe.ReadRelays != ""
}

// HasWriteRelays returns true if user profile has cached write relays
func (upe UserProfileEntry) HasWriteRelays() bool {
	return upe.WriteRelays != ""
}

// IsExpired returns true if the cache entry has expired
func (upe UserProfileEntry) IsExpired() bool {
	return time.Now().After(upe.ExpiresAt)
}

// parseRelayJSON parses JSON array of relay URLs
func parseRelayJSON(relayJSON string) []string {
	if relayJSON == "" {
		return nil
	}

	// Simple JSON parsing for relay array
	var relays []string
	if relayJSON[0] == '[' && relayJSON[len(relayJSON)-1] == ']' {
		// Remove brackets and split by comma
		content := relayJSON[1 : len(relayJSON)-1]
		if content == "" {
			return nil
		}

		// Parse JSON array elements (strip quotes)
		parts := strings.Split(content, ",")
		for _, part := range parts {
			relay := strings.TrimSpace(part)
			if len(relay) >= 2 && relay[0] == '"' && relay[len(relay)-1] == '"' {
				relay = relay[1 : len(relay)-1]
			}
			if relay != "" {
				relays = append(relays, relay)
			}
		}
	}

	return relays
}

type CacheStats struct {
	TotalMessages   int
	TotalProfiles   int
	ExpiredProfiles int
	DatabaseSize    int64
}

type Cache interface {
	// Message methods
	AddMessage(recipientNpub, message, eventID, direction string) error
	AddMessageWithTimestamp(recipientNpub, message, eventID, direction string, sentAt time.Time) error
	GetMessages(recipientNpub string, limit int) []MessageEntry
	GetRecentMessages(recipientNpub string, sentLimit, receivedLimit int) []MessageEntry
	GetMessagesBefore(recipientNpub string, cutoff time.Time, limit int) []MessageEntry
	GetMessagesWithOffset(recipientNpub string, offset int, limit int) []MessageEntry
	GetLatestMessages(recipientNpub string, limit int) []MessageEntry
	SearchMessages(recipientNpub, query string) []MessageEntry
	GetMessagesByDateRange(recipientNpub string, start, end time.Time) []MessageEntry
	GetMessageStats(recipientNpub string) (sent, received int, err error)
	HasMessage(eventID string) bool

	// Contact methods
	GetSortedPartners(partners []string) []string

	// Profile methods
	GetProfile(npub string) (ProfileEntry, bool)
	SetProfileWithRelayList(npub string, profile ProfileMetadata, readRelays []string, writeRelays []string, ttl time.Duration) error
	SetNIP65Relays(npub string, readRelays, writeRelays []string, ttl time.Duration) error
	ClearExpiredProfiles() error

	// Maintenance methods
	Clear() error
	Vacuum() error
	GetStats() CacheStats

	// Testing support
	SetCache(cache interface{}) // For testing purposes
}
