package cache

import (
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
	ID          int64     `json:"id"`
	Npub        string    `json:"npub"`
	Name        string    `json:"name"`
	DisplayName string    `json:"display_name"`
	About       string    `json:"about"`
	Picture     string    `json:"picture"`
	NIP05       string    `json:"nip05"`
	LUD16       string    `json:"lud16"`
	Website     string    `json:"website"`
	Banner      string    `json:"banner"`
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
	SearchMessages(recipientNpub, query string) []MessageEntry
	GetMessagesByDateRange(recipientNpub string, start, end time.Time) []MessageEntry
	GetMessageStats(recipientNpub string) (sent, received int, err error)
	HasMessage(eventID string) bool

	// Contact methods
	GetSortedPartners(partners []string) []string

	// Profile methods
	GetProfile(npub string) (ProfileEntry, bool)
	SetProfile(npub string, profile ProfileMetadata, ttl time.Duration) error
	ClearExpiredProfiles() error

	// Maintenance methods
	Clear() error
	Vacuum() error
	GetStats() CacheStats
}
