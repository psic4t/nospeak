package cache

import (
	"time"
)

type MessageEntry struct {
	ID            int64     `json:"id"`
	RecipientNpub string    `json:"recipient_npub"`
	Message       string    `json:"message"`
	SentAt        time.Time `json:"sent_at"`
	EventID       string    `json:"event_id"`
	Direction     string    `json:"direction"` // "sent" or "received"
	CreatedAt     time.Time `json:"created_at"`
}

type UsernameEntry struct {
	ID        int64     `json:"id"`
	Npub      string    `json:"npub"`
	Username  string    `json:"username"`
	CachedAt  time.Time `json:"cached_at"`
	ExpiresAt time.Time `json:"expires_at"`
	CreatedAt time.Time `json:"created_at"`
}

type CacheStats struct {
	TotalMessages    int
	TotalUsernames   int
	ExpiredUsernames int
	DatabaseSize     int64
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

	// Username methods
	GetUsername(npub string) (string, bool)
	SetUsername(npub, username string, ttl time.Duration) error
	ClearExpiredUsernames() error

	// Maintenance methods
	Clear() error
	Vacuum() error
	GetStats() CacheStats
}
