package cache

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"sync"
	"time"

	_ "modernc.org/sqlite"
)

type SQLiteCache struct {
	db *sql.DB
	mu sync.RWMutex
}

func NewSQLiteCache() (*SQLiteCache, error) {
	dbPath := getCacheDBPath()

	// Ensure cache directory exists
	if err := os.MkdirAll(filepath.Dir(dbPath), 0755); err != nil {
		return nil, fmt.Errorf("failed to create cache directory: %w", err)
	}

	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open cache database: %w", err)
	}

	cache := &SQLiteCache{db: db}
	if err := cache.init(); err != nil {
		return nil, fmt.Errorf("failed to initialize cache database: %w", err)
	}

	// Start cleanup goroutine
	go cache.startCleanupRoutine()

	return cache, nil
}

func (sc *SQLiteCache) init() error {
	// Performance pragmas
	pragmas := []string{
		"PRAGMA journal_mode = WAL",
		"PRAGMA synchronous = NORMAL",
		"PRAGMA cache_size = 10000",
		"PRAGMA temp_store = MEMORY",
		"PRAGMA mmap_size = 268435456",
		"PRAGMA foreign_keys = ON",
	}

	for _, pragma := range pragmas {
		if _, err := sc.db.Exec(pragma); err != nil {
			return fmt.Errorf("failed to set pragma %s: %w", pragma, err)
		}
	}

	// Create tables
	return sc.createTables()
}

func (sc *SQLiteCache) createTables() error {
	// Messages table
	_, err := sc.db.Exec(`
		CREATE TABLE IF NOT EXISTS messages (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			recipient_npub TEXT NOT NULL,
			message TEXT NOT NULL,
			sent_at DATETIME NOT NULL,
			event_id TEXT NOT NULL,
			direction TEXT NOT NULL CHECK(direction IN ('sent', 'received')),
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)
	`)
	if err != nil {
		return fmt.Errorf("failed to create messages table: %w", err)
	}

	// Profile cache table
	_, err = sc.db.Exec(`
		CREATE TABLE IF NOT EXISTS profile_cache (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			npub TEXT NOT NULL UNIQUE,
			profile TEXT NOT NULL,
			cached_at DATETIME NOT NULL,
			expires_at DATETIME NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)
	`)
	if err != nil {
		return fmt.Errorf("failed to create profile_cache table: %w", err)
	}

	// Create indexes
	indexes := []string{
		"CREATE INDEX IF NOT EXISTS idx_recipient_npub ON messages(recipient_npub)",
		"CREATE INDEX IF NOT EXISTS idx_sent_at ON messages(sent_at)",
		"CREATE INDEX IF NOT EXISTS idx_direction ON messages(direction)",
		"CREATE INDEX IF NOT EXISTS idx_recipient_sent ON messages(recipient_npub, sent_at DESC)",
		"CREATE INDEX IF NOT EXISTS idx_profile_npub ON profile_cache(npub)",
		"CREATE INDEX IF NOT EXISTS idx_profile_expires_at ON profile_cache(expires_at)",
	}

	for _, idx := range indexes {
		if _, err := sc.db.Exec(idx); err != nil {
			return fmt.Errorf("failed to create index: %w", err)
		}
	}

	return nil
}

func getCacheDBPath() string {
	xdgCacheHome := os.Getenv("XDG_CACHE_HOME")
	if xdgCacheHome == "" {
		home, err := os.UserHomeDir()
		if err != nil {
			panic(fmt.Sprintf("failed to get user home directory: %v", err))
		}
		xdgCacheHome = filepath.Join(home, ".cache")
	}
	return filepath.Join(xdgCacheHome, "nospeak", "messages.db")
}

// Message methods
func (sc *SQLiteCache) AddMessage(recipientNpub, message, eventID, direction string) error {
	return sc.AddMessageWithTimestamp(recipientNpub, message, eventID, direction, time.Now())
}

func (sc *SQLiteCache) AddMessageWithTimestamp(recipientNpub, message, eventID, direction string, sentAt time.Time) error {
	sc.mu.Lock()
	defer sc.mu.Unlock()

	tx, err := sc.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	_, err = tx.Exec(`
		INSERT INTO messages (recipient_npub, message, sent_at, event_id, direction)
		VALUES (?, ?, ?, ?, ?)
	`, recipientNpub, message, sentAt, eventID, direction)

	if err != nil {
		return fmt.Errorf("failed to insert message: %w", err)
	}

	return tx.Commit()
}

func (sc *SQLiteCache) GetMessages(recipientNpub string, limit int) []MessageEntry {
	sc.mu.RLock()
	defer sc.mu.RUnlock()

	query := `
		SELECT id, recipient_npub, message, sent_at, event_id, direction, created_at
		FROM messages 
		WHERE recipient_npub = ? 
		ORDER BY sent_at DESC
	`
	if limit > 0 {
		query += " LIMIT ?"
	}

	rows, err := sc.db.Query(query, recipientNpub, limit)
	if err != nil {
		return nil
	}
	defer rows.Close()

	var messages []MessageEntry
	for rows.Next() {
		var msg MessageEntry
		err := rows.Scan(&msg.ID, &msg.RecipientNpub, &msg.Message, &msg.SentAt, &msg.EventID, &msg.Direction, &msg.CreatedAt)
		if err != nil {
			continue
		}
		messages = append(messages, msg)
	}

	return messages
}

func (sc *SQLiteCache) GetRecentMessages(recipientNpub string, sentLimit, receivedLimit int) []MessageEntry {
	sc.mu.RLock()
	defer sc.mu.RUnlock()

	var allMessages []MessageEntry

	// Get recent sent messages
	sentRows, err := sc.db.Query(`
		SELECT id, recipient_npub, message, sent_at, event_id, direction, created_at
		FROM messages 
		WHERE recipient_npub = ? AND direction = 'sent' 
		ORDER BY sent_at DESC 
		LIMIT ?
	`, recipientNpub, sentLimit)
	if err == nil {
		defer sentRows.Close()
		for sentRows.Next() {
			var msg MessageEntry
			if err := sentRows.Scan(&msg.ID, &msg.RecipientNpub, &msg.Message, &msg.SentAt, &msg.EventID, &msg.Direction, &msg.CreatedAt); err == nil {
				allMessages = append(allMessages, msg)
			}
		}
	}

	// Get recent received messages
	receivedRows, err := sc.db.Query(`
		SELECT id, recipient_npub, message, sent_at, event_id, direction, created_at
		FROM messages 
		WHERE recipient_npub = ? AND direction = 'received' 
		ORDER BY sent_at DESC 
		LIMIT ?
	`, recipientNpub, receivedLimit)
	if err == nil {
		defer receivedRows.Close()
		for receivedRows.Next() {
			var msg MessageEntry
			if err := receivedRows.Scan(&msg.ID, &msg.RecipientNpub, &msg.Message, &msg.SentAt, &msg.EventID, &msg.Direction, &msg.CreatedAt); err == nil {
				allMessages = append(allMessages, msg)
			}
		}
	}

	// Sort chronologically (oldest first for natural chat flow)
	sort.Slice(allMessages, func(i, j int) bool {
		return allMessages[i].SentAt.Before(allMessages[j].SentAt)
	})

	return allMessages
}

func (sc *SQLiteCache) SearchMessages(recipientNpub, query string) []MessageEntry {
	sc.mu.RLock()
	defer sc.mu.RUnlock()

	rows, err := sc.db.Query(`
		SELECT id, recipient_npub, message, sent_at, event_id, direction, created_at
		FROM messages 
		WHERE recipient_npub = ? AND message LIKE ? 
		ORDER BY sent_at DESC
	`, recipientNpub, "%"+query+"%")
	if err != nil {
		return nil
	}
	defer rows.Close()

	var messages []MessageEntry
	for rows.Next() {
		var msg MessageEntry
		err := rows.Scan(&msg.ID, &msg.RecipientNpub, &msg.Message, &msg.SentAt, &msg.EventID, &msg.Direction, &msg.CreatedAt)
		if err != nil {
			continue
		}
		messages = append(messages, msg)
	}

	return messages
}

func (sc *SQLiteCache) GetMessagesByDateRange(recipientNpub string, start, end time.Time) []MessageEntry {
	sc.mu.RLock()
	defer sc.mu.RUnlock()

	rows, err := sc.db.Query(`
		SELECT id, recipient_npub, message, sent_at, event_id, direction, created_at
		FROM messages 
		WHERE recipient_npub = ? AND sent_at BETWEEN ? AND ?
		ORDER BY sent_at DESC
	`, recipientNpub, start, end)
	if err != nil {
		return nil
	}
	defer rows.Close()

	var messages []MessageEntry
	for rows.Next() {
		var msg MessageEntry
		err := rows.Scan(&msg.ID, &msg.RecipientNpub, &msg.Message, &msg.SentAt, &msg.EventID, &msg.Direction, &msg.CreatedAt)
		if err != nil {
			continue
		}
		messages = append(messages, msg)
	}

	return messages
}

func (sc *SQLiteCache) GetMessageStats(recipientNpub string) (sent, received int, err error) {
	sc.mu.RLock()
	defer sc.mu.RUnlock()

	rows, err := sc.db.Query(`
		SELECT direction, COUNT(*) 
		FROM messages 
		WHERE recipient_npub = ? 
		GROUP BY direction
	`, recipientNpub)
	if err != nil {
		return 0, 0, err
	}
	defer rows.Close()

	for rows.Next() {
		var direction string
		var count int
		if err := rows.Scan(&direction, &count); err != nil {
			continue
		}
		if direction == "sent" {
			sent = count
		} else if direction == "received" {
			received = count
		}
	}

	return sent, received, nil
}

func (sc *SQLiteCache) HasMessage(eventID string) bool {
	sc.mu.RLock()
	defer sc.mu.RUnlock()

	var count int
	err := sc.db.QueryRow(`
		SELECT COUNT(*) 
		FROM messages 
		WHERE event_id = ?
	`, eventID).Scan(&count)

	if err != nil {
		return false
	}

	return count > 0
}

// Profile methods
func (sc *SQLiteCache) GetProfile(npub string) (ProfileEntry, bool) {
	sc.mu.RLock()
	defer sc.mu.RUnlock()

	var profile ProfileEntry
	var expiresAt time.Time

	err := sc.db.QueryRow(`
		SELECT id, npub, profile, cached_at, expires_at, created_at 
		FROM profile_cache 
		WHERE npub = ?
	`, npub).Scan(&profile.ID, &profile.Npub, &profile.Profile, &profile.CachedAt, &expiresAt, &profile.CreatedAt)

	if err != nil {
		return ProfileEntry{}, false
	}

	if time.Now().After(expiresAt) {
		// Expired, remove it
		go sc.deleteExpiredProfile(npub)
		return ProfileEntry{}, false
	}

	profile.ExpiresAt = expiresAt
	return profile, true
}

func (sc *SQLiteCache) SetProfile(npub string, profile ProfileMetadata, ttl time.Duration) error {
	sc.mu.Lock()
	defer sc.mu.Unlock()

	// Convert profile to JSON for profile_json column
	profileJSON, err := json.Marshal(profile)
	if err != nil {
		return fmt.Errorf("failed to marshal profile: %w", err)
	}

	expiresAt := time.Now().Add(ttl)

	tx, err := sc.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// UPSERT: Insert or replace with profile JSON
	_, err = tx.Exec(`
		INSERT OR REPLACE INTO profile_cache (npub, profile, cached_at, expires_at)
		VALUES (?, ?, ?, ?)
	`, npub, string(profileJSON), time.Now(), expiresAt)

	if err != nil {
		return fmt.Errorf("failed to cache profile: %w", err)
	}

	return tx.Commit()
}

func (sc *SQLiteCache) ClearExpiredProfiles() error {
	sc.mu.Lock()
	defer sc.mu.Unlock()

	_, err := sc.db.Exec(`
		DELETE FROM profile_cache 
		WHERE expires_at < ?
	`, time.Now())

	return err
}

func (sc *SQLiteCache) deleteExpiredProfile(npub string) {
	sc.mu.Lock()
	defer sc.mu.Unlock()

	sc.db.Exec(`DELETE FROM profile_cache WHERE npub = ?`, npub)
}

// Maintenance methods
func (sc *SQLiteCache) Clear() error {
	sc.mu.Lock()
	defer sc.mu.Unlock()

	_, err := sc.db.Exec(`DELETE FROM messages`)
	if err != nil {
		return err
	}

	_, err = sc.db.Exec(`DELETE FROM profile_cache`)
	return err
}

func (sc *SQLiteCache) Vacuum() error {
	sc.mu.Lock()
	defer sc.mu.Unlock()

	_, err := sc.db.Exec(`VACUUM`)
	return err
}

func (sc *SQLiteCache) GetStats() CacheStats {
	sc.mu.RLock()
	defer sc.mu.RUnlock()

	var stats CacheStats

	// Count messages
	sc.db.QueryRow(`SELECT COUNT(*) FROM messages`).Scan(&stats.TotalMessages)

	// Count profiles
	sc.db.QueryRow(`SELECT COUNT(*) FROM profile_cache`).Scan(&stats.TotalProfiles)

	// Count expired profiles
	sc.db.QueryRow(`
		SELECT COUNT(*) FROM profile_cache WHERE expires_at < ?
	`, time.Now()).Scan(&stats.ExpiredProfiles)

	// Get database size (this is approximate)
	var pageSize, pageCount int64
	sc.db.QueryRow(`PRAGMA page_size`).Scan(&pageSize)
	sc.db.QueryRow(`PRAGMA page_count`).Scan(&pageCount)
	stats.DatabaseSize = pageSize * pageCount

	return stats
}

func (sc *SQLiteCache) startCleanupRoutine() {
	ticker := time.NewTicker(1 * time.Hour)
	defer ticker.Stop()

	for range ticker.C {
		sc.ClearExpiredProfiles()
		// Vacuum daily
		if time.Now().Hour() == 3 { // 3 AM
			sc.Vacuum()
		}
	}
}

func (sc *SQLiteCache) Close() error {
	return sc.db.Close()
}
