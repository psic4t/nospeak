package cache

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"

	_ "modernc.org/sqlite"
)

type SQLiteCache struct {
	db *sql.DB
	mu sync.RWMutex
}

// debugLog logs debug messages if DEBUG environment variable is set
func debugLog(format string, args ...interface{}) {
	if debug := os.Getenv("DEBUG"); debug != "" {
		log.Printf("[CACHE-DEBUG] "+format, args...)
	}
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

	// Create tables and migrate if needed
	if err := sc.createTables(); err != nil {
		return err
	}

	// Migrate from JSON blob to structured columns if needed
	if err := sc.migrateProfileStorage(); err != nil {
		return err
	}

	// Add relay list columns if they don't exist
	if err := sc.migrateRelayListColumns(); err != nil {
		return err
	}

	// Add NIP-65 columns if they don't exist
	if err := sc.migrateNIP65Columns(); err != nil {
		return err
	}

	// Clean up redundant relay_list columns after migration
	if err := sc.migrateRelayListCleanup(); err != nil {
		return err
	}

	// Drop legacy relay list columns
	if err := sc.migrateDropLegacyRelayListColumns(); err != nil {
		return err
	}

	return nil
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
			name TEXT,
			display_name TEXT,
			about TEXT,
			picture TEXT,
			nip05 TEXT,
			lud16 TEXT,
			website TEXT,
			banner TEXT,
			relay_list TEXT,
			read_relays TEXT,
			write_relays TEXT,
			cached_at DATETIME NOT NULL,
			expires_at DATETIME NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)
	`)
	if err != nil {
		return fmt.Errorf("failed to create profile_cache table: %w", err)
	}

	// User profile table for NIP-65 relay discovery
	_, err = sc.db.Exec(`
		CREATE TABLE IF NOT EXISTS user_profile (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			npub TEXT NOT NULL UNIQUE,
			read_relays TEXT,
			write_relays TEXT,
			discovered_at DATETIME NOT NULL,
			expires_at DATETIME NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)
	`)
	if err != nil {
		return fmt.Errorf("failed to create user_profile table: %w", err)
	}

	// Create indexes
	indexes := []string{
		"CREATE INDEX IF NOT EXISTS idx_recipient_npub ON messages(recipient_npub)",
		"CREATE INDEX IF NOT EXISTS idx_sent_at ON messages(sent_at)",
		"CREATE INDEX IF NOT EXISTS idx_direction ON messages(direction)",
		"CREATE INDEX IF NOT EXISTS idx_recipient_sent ON messages(recipient_npub, sent_at DESC)",
		"CREATE INDEX IF NOT EXISTS idx_profile_npub ON profile_cache(npub)",
		"CREATE INDEX IF NOT EXISTS idx_profile_expires_at ON profile_cache(expires_at)",
		"CREATE INDEX IF NOT EXISTS idx_user_profile_npub ON user_profile(npub)",
		"CREATE INDEX IF NOT EXISTS idx_user_profile_expires_at ON user_profile(expires_at)",
	}

	for _, idx := range indexes {
		if _, err := sc.db.Exec(idx); err != nil {
			return fmt.Errorf("failed to create index: %w", err)
		}
	}

	return nil
}

// migrateProfileStorage handles migration from JSON blob to structured columns
func (sc *SQLiteCache) migrateProfileStorage() error {
	// Check if profile_json column exists
	var exists bool
	err := sc.db.QueryRow(`
		SELECT COUNT(*) > 0
		FROM pragma_table_info('profile_cache')
		WHERE name = 'profile_json'
	`).Scan(&exists)

	if err != nil || !exists {
		// Column doesn't exist or error occurred, no migration needed
		return nil
	}

	// Get all profiles with JSON data
	rows, err := sc.db.Query(`
		SELECT npub, profile_json, cached_at, expires_at, created_at
		FROM profile_cache
		WHERE profile_json IS NOT NULL AND profile_json != ''
	`)
	if err != nil {
		return fmt.Errorf("failed to query profiles for migration: %w", err)
	}
	defer rows.Close()

	tx, err := sc.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin migration transaction: %w", err)
	}
	defer tx.Rollback()

	for rows.Next() {
		var npub, profileJSON string
		var cachedAt, expiresAt, createdAt time.Time

		if err := rows.Scan(&npub, &profileJSON, &cachedAt, &expiresAt, &createdAt); err != nil {
			continue // Skip problematic rows
		}

		// Parse JSON and migrate to structured columns
		var metadata ProfileMetadata
		if json.Unmarshal([]byte(profileJSON), &metadata) == nil {
			// Insert new structured record
			_, err = tx.Exec(`
				INSERT OR REPLACE INTO profile_cache
				(npub, name, display_name, about, picture, nip05, lud16, website, banner, cached_at, expires_at, created_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			`, npub, metadata.Name, metadata.DisplayName, metadata.About, metadata.Picture,
				metadata.NIP05, metadata.LUD16, "", metadata.Banner, cachedAt, expiresAt, createdAt)

			if err != nil {
				// Log error but continue with other profiles
				continue
			}
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit migration: %w", err)
	}

	// Drop the profile_json column now that migration is complete
	_, err = sc.db.Exec(`ALTER TABLE profile_cache DROP COLUMN profile_json`)
	if err != nil {
		// If we can't drop the column, that's okay - it's no longer being used
	}

	return nil
}

// migrateRelayListColumns adds relay list columns to existing profile_cache table if they don't exist
func (sc *SQLiteCache) migrateRelayListColumns() error {
	// Check if relay_list column exists
	var relayListExists bool
	err := sc.db.QueryRow(`
		SELECT COUNT(*) > 0
		FROM pragma_table_info('profile_cache')
		WHERE name = 'relay_list'
	`).Scan(&relayListExists)

	if err != nil {
		return fmt.Errorf("failed to check relay_list column: %w", err)
	}

	if relayListExists {
		// Columns already exist, no migration needed
		return nil
	}

	debugLog("Migrating profile_cache table to add relay list columns")

	// Add relay list columns
	alterStatements := []string{
		"ALTER TABLE profile_cache ADD COLUMN relay_list TEXT",
	}

	for _, stmt := range alterStatements {
		if _, err := sc.db.Exec(stmt); err != nil {
			// Column might already exist, which is fine
			debugLog("Failed to execute migration statement %s: %v (ignoring)", stmt, err)
		}
	}

	// Create index for relay_list_updated_at if it doesn't exist
	// NO-OP: Index no longer needed as column is removed

	debugLog("Completed relay list columns migration")
	return nil
}

// migrateNIP65Columns adds NIP-65 relay columns to existing profile_cache table if they don't exist
func (sc *SQLiteCache) migrateNIP65Columns() error {
	// Check if read_relays column exists
	var readRelaysExists bool
	err := sc.db.QueryRow(`
		SELECT COUNT(*) > 0 
		FROM pragma_table_info('profile_cache') 
		WHERE name = 'read_relays'
	`).Scan(&readRelaysExists)

	if err != nil {
		return fmt.Errorf("failed to check read_relays column: %w", err)
	}

	if readRelaysExists {
		// Columns already exist, migrate data from relay_list if needed
		return sc.migrateRelayListToNIP65()
	}

	debugLog("Migrating profile_cache table to add NIP-65 relay columns")

	// Add NIP-65 relay columns
	alterStatements := []string{
		"ALTER TABLE profile_cache ADD COLUMN read_relays TEXT",
		"ALTER TABLE profile_cache ADD COLUMN write_relays TEXT",
	}

	for _, stmt := range alterStatements {
		if _, err := sc.db.Exec(stmt); err != nil {
			// Column might already exist, which is fine
			debugLog("Failed to execute NIP-65 migration statement %s: %v (ignoring)", stmt, err)
		}
	}

	// Create indexes for NIP-65 columns
	indexStatements := []string{
		"CREATE INDEX IF NOT EXISTS idx_profile_read_relays ON profile_cache(read_relays)",
		"CREATE INDEX IF NOT EXISTS idx_profile_write_relays ON profile_cache(write_relays)",
	}

	for _, stmt := range indexStatements {
		if _, err := sc.db.Exec(stmt); err != nil {
			debugLog("Failed to create NIP-65 index: %v", err)
		}
	}

	debugLog("Completed NIP-65 columns migration")
	return nil
}

// migrateRelayListCleanup removes redundant relay_list columns after migration to NIP-65
func (sc *SQLiteCache) migrateRelayListCleanup() error {
	// Check if relay_list column still exists before trying to drop it
	var relayListExists bool
	err := sc.db.QueryRow(`
		SELECT COUNT(*) > 0 
		FROM pragma_table_info('profile_cache') 
		WHERE name = 'relay_list'
	`).Scan(&relayListExists)

	if err != nil {
		return fmt.Errorf("failed to check relay_list columns: %w", err)
	}

	if !relayListExists {
		// Columns already removed, no cleanup needed
		debugLog("Redundant relay_list columns already removed")
		return nil
	}

	debugLog("Starting cleanup of redundant relay_list columns")

	// Drop redundant columns - keep event_id and updated_at for metadata
	dropStatements := []string{
		"ALTER TABLE profile_cache DROP COLUMN relay_list",
	}

	for _, stmt := range dropStatements {
		if _, err := sc.db.Exec(stmt); err != nil {
			// Column might not exist, which is fine
			debugLog("Failed to execute cleanup statement %s: %v (ignoring)", stmt, err)
		} else {
			debugLog("Dropped column: %s", stmt)
		}
	}

	// Drop index if it exists
	if _, err := sc.db.Exec("DROP INDEX IF EXISTS idx_profile_relay_list_updated_at"); err != nil {
		debugLog("Failed to drop relay list index: %v (ignoring)", err)
	} else {
		debugLog("Dropped relay list index")
	}

	debugLog("Completed cleanup of redundant relay_list columns")
	return nil
}

// migrateDropLegacyRelayListColumns removes relay_list_event_id and relay_list_updated_at columns
func (sc *SQLiteCache) migrateDropLegacyRelayListColumns() error {
	debugLog("Starting cleanup of legacy relay list columns")

	// Check if columns exist before trying to drop them
	// We check one of them
	var columnExists bool
	err := sc.db.QueryRow(`
		SELECT COUNT(*) > 0 
		FROM pragma_table_info('profile_cache') 
		WHERE name = 'relay_list_event_id'
	`).Scan(&columnExists)

	if err != nil {
		return fmt.Errorf("failed to check relay_list_event_id column: %w", err)
	}

	if !columnExists {
		debugLog("Legacy relay list columns already removed")
		return nil
	}

	dropStatements := []string{
		"ALTER TABLE profile_cache DROP COLUMN relay_list_event_id",
		"ALTER TABLE profile_cache DROP COLUMN relay_list_updated_at",
	}

	for _, stmt := range dropStatements {
		if _, err := sc.db.Exec(stmt); err != nil {
			debugLog("Failed to execute drop statement %s: %v (ignoring)", stmt, err)
		} else {
			debugLog("Dropped column: %s", stmt)
		}
	}

	return nil
}

// migrateRelayListToNIP65 migrates existing relay_list data to NIP-65 read/write columns
func (sc *SQLiteCache) migrateRelayListToNIP65() error {
	debugLog("Starting migration of relay_list data to NIP-65 columns")

	// Check if relay_list column exists
	var relayListExists bool
	err := sc.db.QueryRow(`
		SELECT COUNT(*) > 0
		FROM pragma_table_info('profile_cache')
		WHERE name = 'relay_list'
	`).Scan(&relayListExists)

	if err != nil {
		return fmt.Errorf("failed to check relay_list column: %w", err)
	}

	if !relayListExists {
		debugLog("relay_list column does not exist, skipping data migration")
		return nil
	}

	// Get profiles with relay_list data but empty NIP-65 columns
	rows, err := sc.db.Query(`
		SELECT npub, relay_list 
		FROM profile_cache 
		WHERE relay_list IS NOT NULL AND relay_list != '' 
		AND (read_relays IS NULL OR read_relays = '') 
		AND (write_relays IS NULL OR write_relays = '')
	`)
	if err != nil {
		return fmt.Errorf("failed to query profiles for migration: %w", err)
	}
	defer rows.Close()

	var migratedCount int
	for rows.Next() {
		var npub, relayList string
		if err := rows.Scan(&npub, &relayList); err != nil {
			debugLog("Failed to scan migration row: %v", err)
			continue
		}

		// For migration, we'll move relay_list data to read_relays only
		// We leave write_relays empty to force a fresh discovery which will correctly separate them
		// This avoids the issue where we blindly copy legacy mixed relays into write_relays
		_, err := sc.db.Exec(`
			UPDATE profile_cache 
			SET read_relays = ?, write_relays = '[]'
			WHERE npub = ?
		`, relayList, npub)

		if err != nil {
			debugLog("Failed to migrate relays for %s: %v", npub[:8]+"...", err)
			continue
		}

		migratedCount++
	}

	if err := rows.Err(); err != nil {
		return fmt.Errorf("error during migration rows iteration: %w", err)
	}

	debugLog("Completed migration of %d profiles to NIP-65 columns", migratedCount)
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

	// Reverse to chronological order (oldest first) for proper display
	// Database returns DESC for pagination efficiency, but display needs ASC
	for i, j := 0, len(messages)-1; i < j; i, j = i+1, j-1 {
		messages[i], messages[j] = messages[j], messages[i]
	}

	return messages
}

func (sc *SQLiteCache) GetMessagesBefore(recipientNpub string, cutoff time.Time, limit int) []MessageEntry {
	sc.mu.RLock()
	defer sc.mu.RUnlock()

	query := `
		SELECT id, recipient_npub, message, sent_at, event_id, direction, created_at
		FROM messages 
		WHERE recipient_npub = ? AND sent_at < ?
		ORDER BY sent_at ASC
	`
	if limit > 0 {
		query += " LIMIT ?"
	}

	rows, err := sc.db.Query(query, recipientNpub, cutoff, limit)
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

func (sc *SQLiteCache) GetMessagesWithOffset(recipientNpub string, offset int, limit int) []MessageEntry {
	sc.mu.RLock()
	defer sc.mu.RUnlock()

	query := `
		SELECT id, recipient_npub, message, sent_at, event_id, direction, created_at
		FROM messages 
		WHERE recipient_npub = ?
		ORDER BY sent_at DESC
		LIMIT ? OFFSET ?
	`

	rows, err := sc.db.Query(query, recipientNpub, limit, offset)
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

	// Reverse to chronological order (oldest first) for proper display
	// Database returns DESC for pagination efficiency, but display needs ASC
	for i, j := 0, len(messages)-1; i < j; i, j = i+1, j-1 {
		messages[i], messages[j] = messages[j], messages[i]
	}

	return messages
}

func (sc *SQLiteCache) GetLatestMessages(recipientNpub string, limit int) []MessageEntry {
	sc.mu.RLock()
	defer sc.mu.RUnlock()

	query := `
		SELECT id, recipient_npub, message, sent_at, event_id, direction, created_at
		FROM messages 
		WHERE recipient_npub = ? 
		ORDER BY sent_at DESC
		LIMIT ?
	`

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

	// Reverse to chronological order (oldest first) for proper display
	for i, j := 0, len(messages)-1; i < j; i, j = i+1, j-1 {
		messages[i], messages[j] = messages[j], messages[i]
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

// GetSortedPartners returns partners sorted by most recent message activity
func (sc *SQLiteCache) GetSortedPartners(partners []string) []string {
	debugLog("GetSortedPartners called with %d partners: %v", len(partners), partners)

	sc.mu.RLock()
	defer sc.mu.RUnlock()

	if len(partners) == 0 {
		debugLog("Empty partners list, returning as-is")
		return partners
	}

	// First, let's check what's actually in the database for these partners
	debugLog("Checking message database for these partners...")
	for i, partner := range partners {
		var count int
		var latestTimeStr string
		err := sc.db.QueryRow(`
			SELECT COUNT(*), MAX(sent_at)
			FROM messages
			WHERE recipient_npub = ?
		`, partner).Scan(&count, &latestTimeStr)

		if err != nil {
			debugLog("Partner %d (%s): Database error: %v", i, partner[:8]+"...", err)
		} else {
			if latestTimeStr != "" {
				debugLog("Partner %d (%s): %d messages, latest: %s", i, partner[:8]+"...", count, latestTimeStr)
			} else {
				debugLog("Partner %d (%s): %d messages, latest: (no messages)", i, partner[:8]+"...", count)
			}
		}
	}

	// Single optimized query instead of N+1 queries
	placeholders := strings.Repeat("?,", len(partners)-1) + "?"
	query := `
		SELECT recipient_npub, MAX(sent_at) as latest_time
		FROM messages
		WHERE recipient_npub IN (` + placeholders + `)
		GROUP BY recipient_npub
		ORDER BY latest_time DESC
	`

	debugLog("Executing SQL query: %s", query)
	debugLog("Query parameters: %v", partners)

	// Prepare arguments
	args := make([]interface{}, len(partners))
	for i, partner := range partners {
		args[i] = partner
	}

	// Execute query
	rows, err := sc.db.Query(query, args...)
	if err != nil {
		debugLog("SQL query failed: %v, falling back to original order", err)
		return partners
	}
	defer rows.Close()

	// Map to store latest times and maintain order
	latestTimes := make(map[string]time.Time)
	partnersWithMessages := make([]string, 0)

	debugLog("Processing query results...")
	for rows.Next() {
		var partner string
		var latestTimeStr string
		if err := rows.Scan(&partner, &latestTimeStr); err != nil {
			debugLog("Error scanning row: %v", err)
			continue
		}
		if latestTimeStr != "" {
			// Remove monotonic clock information (m=+...) as it's not parseable
			// Example: "2025-11-06 14:18:08.086438893 +0100 CET m=+13.832688068"
			// becomes: "2025-11-06 14:18:08.086438893 +0100 CET"
			cleanTimeStr := regexp.MustCompile(`\s+m=\+[\d\.]+$`).ReplaceAllString(latestTimeStr, "")

			// Try multiple time formats to handle different database timestamp formats
			timeFormats := []string{
				time.RFC3339,
				time.RFC3339Nano,
				"2006-01-02 15:04:05.999999999 -0700 MST",
				"2006-01-02 15:04:05 -0700 MST",
			}

			var latestTime time.Time
			var err error
			parsed := false

			for _, format := range timeFormats {
				latestTime, err = time.Parse(format, cleanTimeStr)
				if err == nil {
					parsed = true
					break
				}
			}

			if !parsed {
				debugLog("Error parsing time '%s' (cleaned: '%s') for partner %s: %v", latestTimeStr, cleanTimeStr, partner[:8]+"...", err)
				continue
			}
			latestTimes[partner] = latestTime
			partnersWithMessages = append(partnersWithMessages, partner)
			debugLog("Found partner %s with latest time: %v", partner[:8]+"...", latestTime)
		} else {
			debugLog("Partner %s has empty latest time, skipping", partner[:8]+"...")
		}
	}

	// Check for any query errors
	if err = rows.Err(); err != nil {
		debugLog("Row iteration error: %v", err)
	}

	debugLog("Partners with messages: %v", partnersWithMessages)

	// Separate partners with and without messages (maintain original order)
	partnersWithoutMessages := make([]string, 0)
	for _, partner := range partners {
		if _, hasMessages := latestTimes[partner]; !hasMessages {
			partnersWithoutMessages = append(partnersWithoutMessages, partner)
			debugLog("Partner %s has no messages", partner[:8]+"...")
		}
	}

	// Combine: partners with messages (already sorted by DB) + partners without messages (original order)
	result := append(partnersWithMessages, partnersWithoutMessages...)

	debugLog("Final sorted partners: %v", result)
	debugLog("GetSortedPartners completed")

	return result
}

// Profile methods
func (sc *SQLiteCache) GetProfile(npub string) (ProfileEntry, bool) {
	sc.mu.RLock()
	defer sc.mu.RUnlock()

	var profile ProfileEntry
	var expiresAt time.Time
	var relayList string

	// Try to query with NIP-65 columns first (new schema)
	err := sc.db.QueryRow(`
		SELECT id, npub, name, display_name, about, picture, nip05, lud16, website, banner,
		       read_relays, write_relays, cached_at, expires_at, created_at
		FROM profile_cache
		WHERE npub = ?
	`, npub).Scan(&profile.ID, &profile.Npub, &profile.Name, &profile.DisplayName, &profile.About,
		&profile.Picture, &profile.NIP05, &profile.LUD16, &profile.Website, &profile.Banner,
		&profile.ReadRelays, &profile.WriteRelays, &profile.CachedAt, &expiresAt, &profile.CreatedAt)

	if err != nil {
		// Fallback to legacy schema with relay_list columns
		// Note: If columns are dropped, this fallback will fail, which is expected behavior after migration
		err = sc.db.QueryRow(`
			SELECT id, npub, name, display_name, about, picture, nip05, lud16, website, banner,
			       relay_list, cached_at, expires_at, created_at
			FROM profile_cache
			WHERE npub = ?
		`, npub).Scan(&profile.ID, &profile.Npub, &profile.Name, &profile.DisplayName, &profile.About,
			&profile.Picture, &profile.NIP05, &profile.LUD16, &profile.Website, &profile.Banner,
			&relayList, &profile.CachedAt, &expiresAt, &profile.CreatedAt)

		if err != nil {
			return ProfileEntry{}, false
		}

		// Convert legacy relay_list to NIP-65 format for backward compatibility
		if relayList != "" {
			profile.ReadRelays = relayList
			profile.WriteRelays = relayList
		}
		profile.RelayList = relayList
	}

	profile.ExpiresAt = expiresAt
	return profile, true
}

// SetProfileWithRelayList caches both profile metadata and relay list together
// If readRelays and writeRelays are nil or empty, only profile metadata is updated, preserving existing relay list
func (sc *SQLiteCache) SetProfileWithRelayList(npub string, profile ProfileMetadata, readRelays []string, writeRelays []string, ttl time.Duration) error {
	sc.mu.Lock()
	defer sc.mu.Unlock()

	expiresAt := time.Now().Add(ttl)
	hasRelays := len(readRelays) > 0 || len(writeRelays) > 0

	tx, err := sc.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	if hasRelays {
		// Insert or replace with both profile and relay list data
		readRelaysJSON := sc.serializeRelayList(readRelays)
		writeRelaysJSON := sc.serializeRelayList(writeRelays)

		_, err = tx.Exec(`
			INSERT OR REPLACE INTO profile_cache
			(npub, name, display_name, about, picture, nip05, lud16, website, banner,
			 read_relays, write_relays, cached_at, expires_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`, npub, profile.Name, profile.DisplayName, profile.About, profile.Picture,
			profile.NIP05, profile.LUD16, profile.Website, profile.Banner,
			readRelaysJSON, writeRelaysJSON, time.Now(), expiresAt)
	} else {
		// Update only profile metadata, preserving existing relay list data
		_, err = tx.Exec(`
			UPDATE profile_cache
			SET name = ?, display_name = ?, about = ?, picture = ?, nip05 = ?, lud16 = ?,
			    website = ?, banner = ?, cached_at = ?, expires_at = ?
			WHERE npub = ?
		`, profile.Name, profile.DisplayName, profile.About, profile.Picture,
			profile.NIP05, profile.LUD16, profile.Website, profile.Banner, time.Now(), expiresAt, npub)

		// If no existing profile, insert one without relay list
		result, err2 := tx.Exec(`SELECT changes()`)
		if err2 == nil {
			changes, _ := result.RowsAffected()
			if changes == 0 {
				// No existing profile, insert new one
				_, err = tx.Exec(`
					INSERT INTO profile_cache
					(npub, name, display_name, about, picture, nip05, lud16, website, banner,
					 read_relays, write_relays, cached_at, expires_at)
					VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '', '', ?, ?)
				`, npub, profile.Name, profile.DisplayName, profile.About, profile.Picture,
					profile.NIP05, profile.LUD16, profile.Website, profile.Banner, time.Now(), expiresAt)
			}
		}
	}

	if err != nil {
		return fmt.Errorf("failed to cache profile: %w", err)
	}

	return tx.Commit()
}

// serializeRelayList converts a slice of relay URLs to JSON array format
func (sc *SQLiteCache) serializeRelayList(relayList []string) string {
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

// SetNIP65Relays caches NIP-65 read/write relay information for a user
func (sc *SQLiteCache) SetNIP65Relays(npub string, readRelays, writeRelays []string, ttl time.Duration) error {
	sc.mu.Lock()
	defer sc.mu.Unlock()

	expiresAt := time.Now().Add(ttl)
	readRelaysJSON := sc.serializeRelayList(readRelays)
	writeRelaysJSON := sc.serializeRelayList(writeRelays)

	_, err := sc.db.Exec(`
		UPDATE profile_cache 
		SET read_relays = ?, write_relays = ?, cached_at = ?, expires_at = ?
		WHERE npub = ?
	`, readRelaysJSON, writeRelaysJSON, time.Now(), expiresAt, npub)

	return err
}

func (sc *SQLiteCache) startCleanupRoutine() {
	ticker := time.NewTicker(6 * time.Hour)
	defer ticker.Stop()

	for range ticker.C {
		sc.ClearExpiredProfiles()
		// Vacuum daily
		if time.Now().Hour() == 3 { // 3 AM
			sc.Vacuum()
		}
	}
}

// migrateToUserProfileTable migrates existing relay list data to user_profile table
func (sc *SQLiteCache) migrateToUserProfileTable() error {
	// Check if user_profile table has data
	var count int
	err := sc.db.QueryRow("SELECT COUNT(*) FROM user_profile").Scan(&count)
	if err != nil {
		return fmt.Errorf("failed to check user_profile table: %w", err)
	}

	// Skip migration if user_profile already has data
	if count > 0 {
		return nil
	}

	// Get profiles with relay lists from profile_cache
	rows, err := sc.db.Query(`
		SELECT npub, relay_list, relay_list_updated_at, cached_at
		FROM profile_cache 
		WHERE relay_list IS NOT NULL AND relay_list != ''
	`)
	if err != nil {
		return fmt.Errorf("failed to query profiles for migration: %w", err)
	}
	defer rows.Close()

	tx, err := sc.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin migration transaction: %w", err)
	}
	defer tx.Rollback()

	for rows.Next() {
		var npub, relayList string
		var relayListUpdatedAt, cachedAt time.Time

		if err := rows.Scan(&npub, &relayList, &relayListUpdatedAt, &cachedAt); err != nil {
			continue // Skip problematic rows
		}

		// Use 24-hour TTL from cached time
		expiresAt := cachedAt.Add(24 * time.Hour)

		// Insert into user_profile table
		_, err = tx.Exec(`
			INSERT OR REPLACE INTO user_profile 
			(npub, read_relays, write_relays, discovered_at, expires_at, created_at)
			VALUES (?, ?, ?, ?, ?, ?)
		`, npub, relayList, relayList, // Use same list for both read and write initially
			relayListUpdatedAt, expiresAt, cachedAt)

		if err != nil {
			// Log error but continue with other profiles
			continue
		}
	}

	return tx.Commit()
}

func (sc *SQLiteCache) Close() error {
	return sc.db.Close()
}

// SetCache is a no-op for SQLiteCache as it doesn't need to be replaced
func (sc *SQLiteCache) SetCache(cache interface{}) {
	// No-op - SQLiteCache doesn't need to be replaced
}
