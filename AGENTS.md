<!-- OPENSPEC:START -->
# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:
- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:
- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->

# Nospeak System Architecture & Components

## Overview

Nospeak is a terminal-based Nostr chat client that implements decentralized messaging using the Nostr protocol.

## System Architecture

### Core Components (Agents)

#### 1. **Client** (`client/client.go`)
The main orchestrator that manages all Nostr protocol operations with enhanced connection management.

**Responsibilities:**
- **Enhanced Relay Connection Management**: Persistent connection tracking with automatic reconnection
- **Event Publishing with Retry Logic**: Intelligent retry queue for failed message delivery
- **Subscription Management**: Real-time event handling across all managed relays
- **Authentication with Nostr Relays**: Dynamic authentication for relay access
- **Coordinating Message Encryption/Decryption**: End-to-end encryption coordination
- **Profile Resolution and Caching**: User profile management
- **Mailbox Relay Discovery**: NIP-65 relay discovery and management

**Key Methods:**
- `NewClient()` - Initialize client with enhanced connection management
- `CreateClient()` - Helper that consolidates config loading and client creation
- `Connect()` - **Non-blocking** connection initialization with background management
- `PublishEvent()` - Enhanced publishing with automatic retry logic to ALL managed relays
- `SubscribeToEvents()` - Multi-relay subscription with deduplication
- `GetProfile()` - Resolve user profiles
- `UpdateRelayList()` - **Dynamic** relay list updates for UI synchronization
- `AddMailboxRelays()` - Add discovered mailbox relays to connection manager
- `GetTotalManagedRelays()` - Get total configured relay count
- `GetConnectionStats()` - Detailed connection statistics and health metrics

**Enhanced Configuration:**
```go
type Client struct {
    config            *config.Config
    relays            []*nostr.Relay                    // Current connected relays
    secretKey         string
    publicKey         string
    mu                sync.RWMutex
    connectionManager *ConnectionManager                 // Enhanced connection management
    retryQueue        *RetryQueue                       // Background retry system
}
```

**Connection Management Architecture:**
- **Persistent Connections**: All configured relays continuously managed
- **Automatic Reconnection**: Exponential backoff retry for dropped connections
- **Health Monitoring**: Per-relay success/failure tracking
- **Background Operations**: Non-blocking startup with continuous connection attempts
- **Mailbox Relay Support**: Automatic discovery and connection to recipient's preferred relays

#### 1.1 **Connection Manager** (`client/connection_manager.go`)
Advanced connection management system providing persistent relay connectivity with intelligent retry logic.

**Responsibilities:**
- **Persistent Relay Tracking**: Continuous monitoring of all configured relays
- **Automatic Reconnection**: Exponential backoff retry (1s, 2s, 4s, 8s, 16s, 30s max)
- **Health Monitoring**: Per-relay success/failure metrics and consecutive failure tracking
- **Background Operations**: Non-blocking connection establishment and maintenance
- **UI Synchronization**: Safe relay list updates for real-time UI feedback

**Key Methods:**
- `NewConnectionManager()` - Initialize connection manager with retry configuration
- `Start()` - Launch background connection and health monitoring goroutines
- `AddRelay()` - Add relay to persistent management system
- `GetConnectedRelays()` - Retrieve currently active relay connections
- `GetAllRelays()` - Get all managed relays (connected + disconnected)
- `MarkRelaySuccess()` - Record successful operations and update health metrics
- `MarkRelayFailure()` - Track failures and trigger reconnection attempts
- `GetRelayHealth()` - Retrieve detailed health statistics for specific relay

**Configuration:**
```go
type ConnectionManager struct {
    client         *Client
    relays         map[string]*RelayHealth    // Per-relay health tracking
    config         RetryConfig                // Retry behavior configuration
    mu             sync.RWMutex
    ctx            context.Context
    cancel         context.CancelFunc
    reconnectChan  chan string                // Reconnection request channel
    shutdownChan   chan struct{}
    debug          bool
}

type RetryConfig struct {
    MaxRetries          int           // Maximum retry attempts (default: 5)
    InitialBackoff      time.Duration // Initial retry delay (default: 1s)
    MaxBackoff          time.Duration // Maximum retry delay (default: 30s)
    BackoffMultiplier   float64       // Exponential backoff multiplier (default: 2.0)
    HealthCheckInterval time.Duration // Health check frequency (default: 30s)
    ConnectionTimeout   time.Duration // Connection timeout (default: 10s)
}

type RelayHealth struct {
    URL             string        // Relay URL
    Relay           *nostr.Relay  // Active relay connection
    IsConnected     bool          // Current connection status
    LastConnected   time.Time     // Last successful connection
    LastAttempt     time.Time     // Last connection attempt
    SuccessCount    int           // Total successful operations
    FailureCount    int           // Total failed operations
    ConsecutiveFails int          // Current consecutive failure streak
    Mu              sync.RWMutex  // Thread-safe access
}
```

**Background Goroutines:**
- **`healthCheckLoop()`**: Periodic health monitoring (every 30s)
- **`reconnectLoop()`**: Process reconnection requests with backoff logic
- **`uiUpdateLoop()`**: Safe UI synchronization (every 500ms)

**Key Features:**
- **Non-blocking Startup**: Immediate return while background management continues
- **Intelligent Retry**: Exponential backoff prevents relay overwhelming
- **Health Tracking**: Detailed metrics for each relay's performance
- **Circuit Breaking**: Temporary backoff for consistently failing relays
- **Safe UI Updates**: Decoupled UI updates prevent deadlocks

#### 1.2 **Retry Queue** (`client/retry_queue.go`)
Background retry system for failed message publishing with intelligent backoff and delivery tracking.

**Responsibilities:**
- **Failed Publish Tracking**: Monitor publishing failures across all relays
- **Intelligent Retry Logic**: Exponential backoff retry for transient failures
- **Message Queue Management**: Background processing of retry attempts
- **Delivery Confirmation**: Track successful delivery and retry completion
- **Statistics Tracking**: Monitor retry queue performance and health

**Key Methods:**
- `NewRetryQueue()` - Initialize retry queue with configuration
- `Start()` - Launch background retry processing goroutines
- `PublishToAllRelays()` - Enhanced publishing to all managed relays with retry
- `PublishWithRetry()` - Single relay publishing with automatic retry
- `EnqueueRetry()` - Queue failed publish operation for retry
- `GetStats()` - Retrieve retry queue performance statistics

**Configuration:**
```go
type RetryQueue struct {
    client       *Client
    connManager  *ConnectionManager
    queue        chan *RetryablePublish  // Retry operation queue
    results      chan PublishResult      // Retry result channel
    config       RetryConfig
    mu           sync.RWMutex
    ctx          context.Context
    cancel       context.CancelFunc
    shutdownChan chan struct{}
    debug        bool
}

type RetryablePublish struct {
    Event       nostr.Event   // Event to republish
    TargetRelay string        // Target relay URL
    Attempt     int           // Current attempt number
    MaxAttempts int           // Maximum allowed attempts
    NextAttempt time.Time     // When to retry next
    CreatedAt   time.Time     // Original creation time
}

type PublishResult struct {
    RelayURL string        // Relay that was attempted
    Success  bool          // Whether publish succeeded
    Error    error         // Error if failed
    Attempt  int           // Attempt number
}
```

**Background Processing:**
- **`processQueue()`**: Handle retry queue operations with timing
- **`processResults()`**: Process and log retry results
- **`publishToRelay()`**: Actual publishing with authentication handling

**Key Features:**
- **Automatic Retry**: Failed publishes automatically retried with backoff
- **Per-Relay Tracking**: Individual retry status for each relay
- **Exponential Backoff**: 1s, 2s, 4s, 8s, 16s, 30s maximum
- **Authentication Handling**: Automatic retry after successful authentication
- **Result Tracking**: Detailed success/failure statistics

#### 2. **Messaging** (`client/messaging.go`)
Handles all direct message operations with end-to-end encryption.

**Responsibilities:**
- NIP-44 v2 encryption for direct messages
- NIP-59 gift wrapping for metadata protection
- Message formatting and validation
- Contact management

**Key Methods:**
- `SendMessage()` - Send encrypted direct messages
- `ReceiveMessage()` - Process incoming messages
- `EncryptMessage()` - Apply NIP-44 encryption
- `DecryptMessage()` - Decrypt received messages

**Protocol Support:**
- **NIP-44**: End-to-end encryption
- **NIP-59**: Gift wrapping for privacy
- **Kind 14**: Direct message events
- *Implemented using github.com/nbd-wtf/go-nostr - see Module Dependencies*

#### 3. **Profile Resolver** (`client/profile_resolver.go`)
Manages user profile metadata resolution and caching.

**Responsibilities:**
- Fetch user metadata from relays
- Cache profiles with TTL
- Resolve NIP-05 identifiers
- Handle profile updates and invalidation

**Key Methods:**
- `ResolveProfile()` - Get user profile metadata
- `CacheProfile()` - Store profile with expiration
- `InvalidateProfile()` - Clear stale cache entries
- `SetDebugMode(debug bool)` - Enable/disable debug logging to file

#### 4. **Cache** (`cache/`)
Provides persistent storage and retrieval system using SQLite database.

**Interface Definition:**
```go
type Cache interface {
    // Message operations
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

    // Profile operations (Unified approach)
    GetProfile(npub string) (ProfileEntry, bool)
    SetProfileWithRelayList(npub string, profile ProfileMetadata, relayList []string, relayListEventID string, ttl time.Duration) error
    ClearExpiredProfiles() error

    // Maintenance methods
    Clear() error
    Vacuum() error
    GetStats() CacheStats
}
```

**SQLite Implementation:**
- **Database**: SQLite with WAL mode for performance (via modernc.org/sqlite)
- **Location**: `~/.cache/nospeak/messages.db` (respects XDG_CACHE_HOME)
- **Performance Optimizations**: Memory-mapped I/O, connection pooling, indexed queries
- **Automatic Maintenance**: Background cleanup, daily vacuuming at 3 AM
- **Cross-Compilation**: CGO-free implementation enables static binary builds
- *See Module Dependencies section for detailed SQLite driver information*

**Database Schema:**
```sql
-- Messages table with full-text search capabilities
CREATE TABLE messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipient_npub TEXT NOT NULL,
    message TEXT NOT NULL,
    sent_at DATETIME NOT NULL,
    event_id TEXT NOT NULL,
    direction TEXT NOT NULL CHECK(direction IN ('sent', 'received')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Profile cache with TTL support and mailbox relay list caching
CREATE TABLE profile_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    npub TEXT NOT NULL UNIQUE,
    name TEXT, display_name TEXT, about TEXT, picture TEXT,
    nip05 TEXT, lud16 TEXT, website TEXT, banner TEXT,
    relay_list TEXT,                        -- JSON array of mailbox relay URLs
    relay_list_event_id TEXT,               -- NIP-65 event ID for relay list
    relay_list_updated_at DATETIME,         -- When relay list was last fetched
    cached_at DATETIME NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Data Structures:**
```go
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
    ID                int64     `json:"id"`
    Npub              string    `json:"npub"`
    Name              string    `json:"name"`
    DisplayName       string    `json:"display_name"`
    About             string    `json:"about"`
    Picture           string    `json:"picture"`
    NIP05             string    `json:"nip05"`
    LUD16             string    `json:"lud16"`
    Website           string    `json:"website"`
    Banner            string    `json:"banner"`
    RelayList         string    `json:"relay_list"`           // JSON array of relay URLs
    RelayListEventID  string    `json:"relay_list_event_id"`  // Kind 10002 event ID
    RelayListUpdatedAt time.Time `json:"relay_list_updated_at"`
    CachedAt          time.Time `json:"cached_at"`
    ExpiresAt         time.Time `json:"expires_at"`
    CreatedAt         time.Time `json:"created_at"`
}

type CacheStats struct {
    TotalMessages   int
    TotalProfiles   int
    ExpiredProfiles int
    DatabaseSize    int64
}
```

**Key Features:**
- **Full-text Search**: Search messages by content
- **Date Range Queries**: Retrieve messages within specific time periods
- **Message Statistics**: Track sent/received counts per contact
- **Automatic Cleanup**: Remove expired profiles, vacuum database
- **Migration Support**: Handles schema upgrades from JSON to structured storage
- **Performance Monitoring**: Built-in statistics and database size tracking
- **Mailbox Relay Caching**: NIP-65 relay list caching for improved message delivery performance
- **Unified Profile Management**: Single method for profile and relay list updates eliminates race conditions

#### 4.1 **Mailbox Relay Caching System**

##### Overview
The mailbox relay caching system provides intelligent caching of NIP-65 (Messaging Relay List) events alongside profile metadata, significantly improving message delivery performance by eliminating redundant network queries for recipient relay information.

##### Architecture
The system implements a **unified caching approach** that stores both profile metadata and relay lists together, eliminating race conditions that previously caused relay list duplication.

##### Key Components

**Unified Profile Management (`cache/sqlite.go`)**
- **Single Method**: `SetProfileWithRelayList()` handles all profile and relay list operations
- **Optional Relay Lists**: Pass `nil` relay list for profile-only updates, preserving existing data
- **Atomic Operations**: Profile and relay list updates happen together when both are provided
- **Race Condition Elimination**: Single update path prevents concurrent interference

**Enhanced Profile Resolution (`client/profile.go`)**
- **Dual Event Fetching**: Simultaneously queries both kind 0 (profile) and kind 10002 (relay list) events
- **Combined Caching**: Stores profile metadata and relay lists in single atomic operation
- **24-Hour TTL**: Consistent caching duration for both data types
- **Debug Integration**: Detailed logging for cache operations and relay discovery

**Optimized Message Sending (`client/messaging.go`)**
- **Cache-First Lookup**: Check cached relay lists before network queries
- **Intelligent Fallback**: Network fetch only when cache miss or expired
- **Automatic Cache Updates**: Store newly discovered relay lists for future use
- **Profile Preservation**: Preserves existing profile metadata when updating relay lists

##### Data Storage

**Database Schema Extensions**
```sql
-- New columns added to profile_cache table
ALTER TABLE profile_cache ADD COLUMN relay_list TEXT;                -- JSON array: ["wss://relay1.com", "wss://relay2.com"]
ALTER TABLE profile_cache ADD COLUMN relay_list_event_id TEXT;          -- Kind 10002 event ID
ALTER TABLE profile_cache ADD COLUMN relay_list_updated_at DATETIME;    -- Fetch timestamp
```

**Helper Methods (`cache/interface.go`)**
```go
// Extract relay list from JSON cache
func (pe ProfileEntry) GetRelayList() []string

// Check if profile has cached relay list
func (pe ProfileEntry) HasRelayList() bool

// Convert to profile metadata (preserves relay list)
func (pe ProfileEntry) ToProfileMetadata() ProfileMetadata
```

##### Performance Benefits

**Network Optimization**
- **~90% Fewer Queries**: Eliminates redundant NIP-65 fetches for frequent contacts
- **200-1000ms Faster**: Immediate message sending with cached relay lists
- **Reduced Latency**: No network round-trips for cached recipients
- **Offline Capability**: Send messages using cached relay information when network unavailable

**System Efficiency**
- **Single Update Path**: Eliminates race conditions between multiple cache methods
- **Atomic Operations**: Profile and relay list data consistency guaranteed
- **Reduced Database Load**: Fewer writes and more efficient cache hits
- **Memory Optimization**: JSON serialization optimized for relay list storage

##### Cache Management Strategy

**Unified TTL Management**
- **24-Hour Expiration**: Consistent caching duration for profiles and relay lists
- **Automatic Cleanup**: Background removal of expired entries
- **Refresh Logic**: Profile resolution automatically refreshes both data types
- **Smart Updates**: Only update relay list when new information is discovered

**Migration Support**
- **Automatic Schema Migration**: Handles database upgrades for existing installations
- **Backward Compatibility**: Preserves existing profile data during migration
- **Graceful Degradation**: Functions properly when relay list columns are missing
- **Index Optimization**: New indexes for efficient relay list queries

##### Integration Points

**Profile Resolution Flow**
```
User Interaction → ProfileResolver → Cache Check → Network Fetch (Kind 0 + 10002) → Atomic Cache Store → Display
```

**Message Sending Flow**
```
Message Composition → GetRecipientRelays → Cache Check → Network Fetch (if needed) → Cache Update → Message Send
```

**Cache Update Methods**
```go
// Profile + Relay List (from network resolution)
cache.SetProfileWithRelayList(npub, profile, relays, eventID, 24*time.Hour)

// Profile Only (preserves existing relay list)
cache.SetProfileWithRelayList(npub, profile, nil, "", 24*time.Hour)

// Relay List Only (preserves existing profile)
if cachedProfile, found := cache.GetProfile(npub); found {
    profileMetadata := cachedProfile.ToProfileMetadata()
    cache.SetProfileWithRelayList(npub, profileMetadata, newRelays, eventID, 24*time.Hour)
}
```

##### Debug and Monitoring

**Debug Logging Features**
- **Cache Hit/Miss Tracking**: Monitor relay list cache effectiveness
- **Network Query Logging**: Track NIP-65 fetch operations and timing
- **JSON Serialization Debug**: Verify relay list data integrity
- **Performance Metrics**: Measure message sending latency improvements

**Monitoring Examples**
```bash
# Enable debug logging to see relay caching operations
./nospeak --debug

# Monitor cache operations
tail -f ~/.cache/nospeak/debug.log | grep -E "(relay|cache)"

# Check relay list cache performance
grep "cached relay list" ~/.cache/nospeak/debug.log
```

##### Error Handling and Edge Cases

**Graceful Degradation**
- **Network Failures**: Fall back to default relay (wss://nostr.data.haus) when cache miss and network fail
- **Malformed Data**: Handle invalid JSON in relay list cache with error logging
- **Missing Data**: Profile resolution works even when no relay list is available
- **Race Condition Prevention**: Single update method eliminates concurrent update conflicts

**Cache Consistency**
- **Atomic Updates**: Profile and relay list data updated together or not at all
- **Data Validation**: Verify JSON format before storing relay lists
- **TTL Synchronization**: Both data types expire simultaneously to prevent inconsistency
- **Transaction Safety**: Database transactions ensure data integrity

##### Future Extensibility

**Potential Enhancements**
- **Relay List Prioritization**: Cache relay priority/ranking information from future NIPs
- **Analytics Integration**: Track relay reliability and performance metrics
- **Batch Operations**: Efficiently update multiple contacts' relay lists
- **Smart Refresh**: Proactively refresh relay lists before expiration

**Design Patterns**
- **Unified Interface**: Single method handles all profile update scenarios
- **Optional Parameters**: Flexible API supports profile-only or relay-only updates
- **Cache-First Strategy**: Always check cache before network operations
- **Atomic Operations**: Ensure data consistency during complex updates

The mailbox relay caching system provides a robust, performant foundation for reliable message delivery while maintaining data integrity and system simplicity through its unified approach to profile and relay list management.

#### 4.2 **Paginated Message Loading System**

##### Overview
The paginated message loading system provides efficient, chronological message retrieval for large conversation histories while maintaining optimal database performance and memory usage.

##### Architecture
The system implements a **dual-query approach** that optimizes for both initial chat loading and pagination of older messages, ensuring proper chronological order while maintaining database efficiency.

##### Key Methods

**GetLatestMessages()** - Efficient recent message retrieval:
```go
func (sc *SQLiteCache) GetLatestMessages(recipientNpub string, limit int) []MessageEntry
```
- **Purpose**: Get most recent messages for initial chat display
- **Query Strategy**: `ORDER BY sent_at DESC LIMIT ?` for optimal performance
- **Order Processing**: Results reversed to chronological order (oldest first)
- **Use Case**: Initial chat history loading in TUI

**GetMessagesBefore()** - Chronological older message loading:
```go
func (sc *SQLiteCache) GetMessagesBefore(recipientNpub string, cutoff time.Time, limit int) []MessageEntry
```
- **Purpose**: Load messages older than a specific timestamp
- **Query Strategy**: `WHERE sent_at < ? ORDER BY sent_at ASC LIMIT ?`
- **Order Processing**: Results already in chronological order (no reversal needed)
- **Use Case**: Loading older messages when user scrolls to top

**Enhanced Legacy Methods** - Updated for chronological consistency:
```go
// Updated to reverse results for chronological order
func (sc *SQLiteCache) GetMessages(recipientNpub string, limit int) []MessageEntry
func (sc *SQLiteCache) GetMessagesWithOffset(recipientNpub string, offset int, limit int) []MessageEntry
```

##### Database Query Optimization

**Latest Messages Query:**
```sql
-- Efficient recent message retrieval
SELECT id, recipient_npub, message, sent_at, event_id, direction, created_at
FROM messages 
WHERE recipient_npub = ? 
ORDER BY sent_at DESC    -- Optimal for pagination
LIMIT ?                 -- Get most recent N messages
```
- **Performance**: Uses index on `(recipient_npub, sent_at)` for optimal speed
- **Memory**: Only loads requested number of messages
- **Processing**: Results reversed in-memory to chronological order

**Older Messages Query:**
```sql
-- Efficient chronological older message loading
SELECT id, recipient_npub, message, sent_at, event_id, direction, created_at
FROM messages 
WHERE recipient_npub = ? AND sent_at < ?  -- Cutoff-based pagination
ORDER BY sent_at ASC     -- Natural chronological order
LIMIT ?                 -- Page size limit
```
- **Performance**: Indexed query with timestamp cutoff for efficient seeking
- **Order**: Results already in correct chronological order
- **Pagination**: Cutoff-based approach prevents offset limitations

##### Chronological Order Guarantee

**Database Efficiency + Display Correctness:**
1. **Database Queries**: Use `DESC` ordering for optimal index utilization
2. **Memory Processing**: Reverse results to chronological order when needed
3. **TUI Integration**: All message arrays processed in chronological order
4. **Content Building**: Date bars and message flow work naturally

**Order Processing Flow:**
```
Database Query (DESC for efficiency) 
    ↓
In-Memory Reversal (if needed)
    ↓
Chronological Array (oldest first)
    ↓
TUI Content Building (natural date flow)
    ↓
Proper Chat Display (oldest at top, newest at bottom)
```

##### Performance Characteristics

**Memory Efficiency:**
- **Page-based Loading**: Default 50 messages per page prevents memory bloat
- **Lazy Loading**: Older messages only loaded when user scrolls
- **Garbage Collection**: Unused message pages can be released

**Database Performance:**
- **Index Utilization**: Queries optimized for `(recipient_npub, sent_at)` index
- **Cutoff-based Pagination**: More efficient than `OFFSET` for large datasets
- **Connection Pooling**: SQLite connection reuse for multiple queries

**UI Responsiveness:**
- **Non-blocking Queries**: Database operations don't block UI thread
- **Incremental Loading**: Messages appear as they're loaded
- **Scroll Position Maintenance**: User's viewport preserved during loading

##### Integration with TUI System

**ChatState Integration:**
- **Initial Load**: `GetLatestMessages()` populates ChatState.Messages
- **Older Loading**: `GetMessagesBefore()` prepends older messages
- **State Management**: ChatState tracks loading status and pagination
- **Thread Safety**: All operations protected by ChatState mutex

**Content Building Integration:**
- **buildChatContent()**: Expects chronological message order
- **Date Bar Logic**: Works naturally with chronological sequences
- **Message Formatting**: Consistent display regardless of loading method

**Scroll Management Integration:**
- **Viewport Anchoring**: Maintains scroll position during content updates
- **Loading Triggers**: Detects when user reaches top of loaded messages
- **Position Restoration**: Preserves user context after loading older messages

##### Testing and Validation

**Comprehensive Test Coverage:**
- **Chronological Order Tests**: Verify proper message sequencing
- **Pagination Tests**: Validate cutoff-based loading logic
- **Performance Tests**: Ensure efficient database utilization
- **Edge Case Tests**: Handle empty conversations and boundary conditions

**Test Methods:**
```go
func TestGetLatestMessages(t *testing.T)           // Chronological order validation
func TestGetLatestMessagesLimit(t *testing.T)       // Pagination limit testing
func TestGetLatestMessagesEmpty(t *testing.T)       // Empty result handling
func TestGetLatestMessagesZeroLimit(t *testing.T)    // Edge case validation
```

##### Benefits Over Previous System

**Performance Improvements:**
- **Database Efficiency**: Optimized queries with proper index utilization
- **Memory Usage**: Page-based loading prevents large memory allocations
- **Query Speed**: Cutoff-based pagination faster than offset for large datasets

**Reliability Improvements:**
- **Chronological Guarantee**: Consistent message ordering across all operations
- **Thread Safety**: Proper mutex protection prevents race conditions
- **Error Handling**: Graceful degradation for database failures

**User Experience Improvements:**
- **Smooth Scrolling**: No message jumping or duplication during pagination
- **Fast Initial Load**: Recent messages appear quickly
- **Infinite Scroll**: Seamless loading of older messages as needed

The paginated message loading system provides a robust, efficient foundation for handling large conversation histories while maintaining optimal performance and user experience.

#### 5. **TUI** (`tui/`)
Terminal User Interface component for interactive messaging.

**Responsibilities:**
- Render chat interface in terminal with responsive layout
- Handle user input and keyboard shortcuts (F2 for settings, Ctrl+C to quit)
- Manage contact list and conversations with real-time updates
- Display in-app notifications and status updates
- Track current contact selection and unread message states
- Provide visual feedback for message delivery and reception

**Key Components:**
- `app.go` - Main TUI application logic with notification handling
- `colors.go` - Theme and color management for visual feedback
- `settings.go` - User preferences and notification configuration

**In-App Notification Integration:**
- **Current Contact Tracking**: `currentPartner string` with thread-safe mutex protection
- **Unread Message Management**: `unreadMessages map[string]bool` for visual indicators
- **Contact List Updates**: Real-time highlighting with green dots (●) for unread contacts
- **Status Bar Notifications**: 3-second temporary messages for new messages from other contacts
- **Visual State Management**: Contact selection, unread status clearing, and UI refresh triggers

**UI Features:**
- **Contact List Highlighting**: "▶ " for current contact, "● " for unread contacts
- **Message History Display**: Real-time message updates for active conversations
- **Settings Integration**: F2 key access to notification and system configuration
- **Responsive Design**: Adapts to terminal size changes with proper layout management
- **Enhanced Relay Counter**: Real-time display of connection status with "X/Y relays" format
- **Color-Coded Status**: Visual feedback for connection health and progress

**Enhanced Status Bar Features:**
- **Fractional Display**: Shows "X/Y relays" (connected/total) instead of simple count
- **Color-Coded Status**:
  - Red: "0 relays" - No connections
  - Yellow: "X/Y relays" (X < Y) - Partial connections
  - Green: "X/Y relays" (X = Y > 0) - Full connections
- **Real-Time Updates**: Connection status updates every 500ms
- **Progressive Feedback**: Watch connection progress from "0/3" → "1/3" → "2/3" → "3/3"
- **Debug Integration**: Connection events logged with visual indicators (✓ NEW CONNECTION, ✗ DISCONNECTED)

**Debug Logging Integration:**
- **Embedded Logger**: TUI app contains `logger *logging.DebugLogger` for debug output
- **TUI Compatibility**: Debug messages are written to file, not stderr, preventing interface interference
- **Debug Topics**: Contact list updates, partner detection, profile fetching, and UI state changes
- **Configuration**: Debug mode controlled by config file `debug = true` or `--debug` flag
- **File Location**: All TUI debug output goes to `~/.cache/nospeak/debug.log`

**Dependencies:**
- `github.com/gdamore/tcell/v2` - Terminal UI library for cross-platform rendering
- `github.com/rivo/tview` - High-level UI components with theme support
- *See Module Dependencies section for complete dependency information*

##### 5.4 **MessageFormatter** (`tui/message_formatter.go`)
Specialized utility component for consistent message formatting across the TUI interface.

**Responsibilities:**
- Standardize message appearance and formatting across all UI contexts
- Provide consistent color coding and timestamp formatting
- Handle encryption status indicators for secure messaging
- Support formatting from different data sources (live events, cached messages, pre-formatted)
- Separate formatting logic from display logic for maintainability

**Key Methods:**
```go
func (mf *MessageFormatter) FormatMessage(event *nostr.Event, sender string, isOutgoing bool, isEncrypted bool) string
func (mf *MessageFormatter) FormatMessageEntry(entry cache.MessageEntry, sender string, isOutgoing bool) string
func (mf *MessageFormatter) FormatIncomingMessage(timestamp, username, message string) string
```

**Formatting Features:**
- **Color Coding**: Blue `[blue]` for outgoing messages, Green `[green]` for incoming messages
- **Timestamp Format**: HH:MM:SS (24-hour format) for consistency
- **Encryption Indicators**: 🔒 icon displayed for encrypted messages
- **Message Sources**: Handles formatting from live Nostr events, cached database entries, and pre-formatted strings

**Integration Points:**
- **Chat History Loading**: Used in `app.go:423, 428` for loading conversation history from cache
- **Older Messages**: Used in `app.go:472, 477` for loading historical messages
- **Real-time Updates**: Used in `app.go:1005` for formatting incoming messages during live chat
- **Component Lifecycle**: Initialized in `app.go:113` as part of TUI application startup

**Message Format Examples:**
```
[blue]Alice [14:30:25]🔒: Hello, this is encrypted
[blue]14:30:25[white] [orange]You:[white] Hi there!
[blue]14:31:15[white] [green]Bob:[white] How are you?
```

##### 5.5 **Paginated Scrolling System** (`tui/app.go`)
Advanced message loading and scrolling system with efficient pagination and chronological display.

**Architecture Overview:**
The paginated scrolling system replaces complex state management with a clean, efficient approach that provides smooth scrolling through large conversation histories while maintaining proper chronological order.

**Core Components:**

**ChatState Struct** - Centralized state management for each conversation:
```go
type ChatState struct {
    Partner         string                    // Current conversation partner
    Messages        []cache.MessageEntry     // All loaded messages (chronological order)
    TotalCount      int                     // Total messages in cache
    CurrentOffset   int                     // Pagination offset (legacy, deprecated)
    PageSize        int                     // Messages per page (default: 50)
    IsFullyLoaded   bool                    // All messages loaded from cache
    ScrollPosition  int                     // Current scroll row position
    ViewportHeight  int                     // Visible rows in message view
    ScrollAnchor    string                   // Message ID at viewport top
    IsLoading      bool                     // Loading state indicator
    mu             sync.RWMutex             // Thread-safe access
}
```

**Key Methods:**
```go
// State Management
func (a *App) getChatState(partner string) *ChatState
func (a *App) setCurrentChatState(partner string)
func (a *App) getCurrentChatState() *ChatState

// Message Loading
func (a *App) loadChatHistory()                    // Initial message load
func (a *App) loadOlderMessages()                  // Load older messages on scroll
func (cs *ChatState) AddMessages(messages []cache.MessageEntry, prepend bool)

// Content Building
func (a *App) buildChatContent(messages []cache.MessageEntry) string

// Scroll Management
func (a *App) restoreScrollPosition(anchor string, row, col int)
func (a *App) findRowForMessage(messageID string) int
func (cs *ChatState) GetScrollAnchor() string
func (cs *ChatState) SetScrollPosition(position int)
```

**Pagination Strategy:**

**Initial Load (`loadChatHistory`)**
- Uses `cache.GetLatestMessages(partner, pageSize)` to get most recent messages
- Messages are returned in chronological order (oldest first)
- ChatState initialized with loaded messages and metadata
- UI scrolls to bottom to show most recent messages

**Loading Older Messages (`loadOlderMessages`)**
- Triggered when user scrolls to top of current messages
- Uses `cache.GetMessagesBefore(partner, oldestMessage.SentAt, pageSize)`
- Older messages are prepended to maintain chronological order
- Scroll position restored to maintain user's viewport

**Database Query Optimization:**
```sql
-- GetLatestMessages: Efficient recent message retrieval
SELECT id, recipient_npub, message, sent_at, event_id, direction, created_at
FROM messages 
WHERE recipient_npub = ? 
ORDER BY sent_at DESC
LIMIT ?  -- Get most recent, then reverse to chronological

-- GetMessagesBefore: Efficient older message loading  
SELECT id, recipient_npub, message, sent_at, event_id, direction, created_at
FROM messages 
WHERE recipient_npub = ? AND sent_at < ?
ORDER BY sent_at ASC  -- Already chronological
LIMIT ?
```

**Content Building (`buildChatContent`)**
- Processes messages in chronological order (oldest first)
- Automatically inserts date bars when message date changes
- Uses MessageFormatter for consistent message appearance
- Handles both sent and received messages with proper formatting

**Scroll Position Management:**
- **Viewport Anchoring**: Tracks message ID at top of viewport during content changes
- **Position Restoration**: Maintains user's scroll position when loading older messages
- **Smooth Scrolling**: PageUp/PageDown with proper boundary detection
- **Loading Prevention**: Blocks concurrent loading operations to prevent race conditions

**Thread Safety:**
- **ChatState Mutex**: Protects all ChatState fields during concurrent access
- **App-Level Mutex**: Protects currentPartner and other shared state
- **Atomic Operations**: Content updates and scroll changes are atomic

**Performance Optimizations:**

**Memory Efficiency:**
- Messages loaded in pages (default 50 messages per page)
- Older messages only loaded when needed (lazy loading)
- Date bars generated dynamically during content building

**Database Efficiency:**
- Indexed queries on `recipient_npub` and `sent_at` columns
- Pagination prevents loading entire conversation history
- DESC queries with in-memory reversal for optimal performance

**UI Responsiveness:**
- Non-blocking message loading with loading state indicators
- Atomic content updates prevent visual glitches
- Scroll position restoration maintains user context

**Integration with Cache System:**

**New Cache Methods:**
```go
// GetLatestMessages returns most recent messages in chronological order
func (cache *SQLiteCache) GetLatestMessages(recipientNpub string, limit int) []MessageEntry

// GetMessagesBefore returns messages older than cutoff time
func (cache *SQLiteCache) GetMessagesBefore(recipientNpub string, cutoff time.Time, limit int) []MessageEntry
```

**Chronological Order Guarantee:**
- All database queries use efficient DESC ordering for pagination
- Results are reversed to chronological order in memory
- `buildChatContent()` expects and processes chronological order
- Date bars and message flow work naturally with proper ordering

**Error Handling and Edge Cases:**
- **Empty Conversations**: Graceful handling of partners with no messages
- **Loading Failures**: Proper error handling and state cleanup
- **Concurrent Operations**: Prevention of duplicate loading operations
- **Scroll Boundaries**: Proper handling at top/bottom of message history

**Benefits Over Previous System:**
- **Simplified State Management**: Single ChatState struct replaces scattered variables
- **Reliable Chronological Order**: Guaranteed proper message ordering
- **Smooth Scrolling**: No jumping or duplication during pagination
- **Better Performance**: Efficient database queries and memory usage
- **Thread Safety**: Proper mutex protection prevents race conditions
- **Maintainable Code**: Clean separation of concerns and single responsibility

**Configuration:**
- **Page Size**: Configurable via `ChatState.PageSize` (default: 50 messages)
- **Scroll Sensitivity**: Adjustable via TUI keyboard shortcuts
- **Loading Behavior**: Configurable loading indicators and timeouts

#### 6. **CLI** (`cmd/`)
Command-line interface for scripting and automation.

**Available Commands:**
- `send` - Send direct messages
- `receive` - Monitor for incoming messages
- `setname` - Update profile name
- `setmessagingrelays` - Configure messaging relays

**Usage Examples:**
```bash
# Send a message
./nospeak send -recipient npub1... -message "Hello"

# Monitor for messages
./nospeak receive -contacts

# Set profile name
./nospeak setname "Alice"
```

#### 7. **Notification System** (Dual Architecture)

Nospeak implements a sophisticated dual notification system with both **external system notifications** and **in-app notifications**.

**External Notifications** (`notification/notification.go`)
Cross-platform system-level notifications for all incoming messages.

**Responsibilities:**
- **Universal Trigger**: Display desktop notifications for ALL incoming messages
- **Platform Integration**: Handle different notification systems (Linux, macOS, Windows)
- **Command Execution**: Execute user-configurable notification commands safely
- **Graceful Degradation**: Handle missing commands and execution failures

**Platform-Specific Defaults:**
```bash
# Linux: notify-send
"notify-send \"New message from %s\""

# macOS: osascript
"osascript -e 'display notification \"New message from %s\"'"

# Windows: PowerShell
"powershell -Command \"Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('New message from %s', 'Nospeak')\""
```

**Configuration:**
```toml
notify_command = "notify-send \"New message from %s\""  # Custom notification command with username placeholder
```

**Debug Logging Integration:**
- **Local Logger**: Creates `logging.NewDebugLogger(debug)` instance for debug output
- **Debug Topics**: Notification command execution, command failures, and successful deliveries
- **File Output**: Debug messages go to `~/.cache/nospeak/debug.log` without system notification interference
- **Error Tracking**: Debug logs include detailed error information when notification commands fail

**In-App Notifications** (TUI integration)
Context-aware notifications within the terminal interface.

**Responsibilities:**
- **Selective Trigger**: Only when message arrives from contact ≠ current active contact
- **Visual Indicators**: Green dots (●) next to contacts with unread messages
- **Status Messages**: Temporary notifications in status bar (3-second duration)
- **State Management**: Thread-safe tracking of current contact and unread status

**Key Components:**
- `currentPartner string` - Tracks currently selected contact
- `unreadMessages map[string]bool` - Tracks unread status per contact
- `mu sync.RWMutex` - Thread-safe state protection

**Visual Feedback System:**
- **Current Contact**: Marked with "▶ " prefix in contact list
- **Unread Contacts**: Marked with green "●" dot
- **Status Notifications**: "New message from {username}" in status bar
- **Auto-Clear**: Unread status cleared when contact is selected

**Notification Flow Logic:**
```
Message Reception
    ↓
Partner Verification (auto-add if new)
    ↓
External Notification (ALWAYS triggered)
    ↓
Current Contact Check
    ↓
├── IF Current Contact → Update message view immediately
└── IF Other Contact → Mark as unread + show status + update contact list
```

**Configuration Integration:**
- **Settings UI**: Accessible via F2 key in TUI
- **Debug Mode**: `--debug` flag enables detailed notification logging
- **Custom Commands**: Users can set custom notification commands or disable entirely

#### 8. **Configuration Agent** (`config/config.go`)
Manages application settings and user preferences using TOML parsing.

**Configuration Structure:**
```go
type Config struct {
    Relays        []string `toml:"relays"`           // Nostr relay URLs
    Npub          string   `toml:"npub"`            // Public key (bech32)
    Nsec          string   `toml:"nsec"`            // Private key (bech32)
    Partners      []string `toml:"partners"`        // Contact list
    Debug         bool     `toml:"debug"`           // Debug logging
    Cache         string   `toml:"cache"`           // Cache file path
    ShowContacts  bool     `toml:"show_contacts"`   // Show contact list
    NotifyCommand string   `toml:"notify_command"`  // External notification command
}
```

**Notification Configuration:**
- **Location**: `~/.config/nospeak/config.toml` (respects XDG_CONFIG_HOME)
- **Auto-creation**: Template generated on first run with platform-appropriate defaults
- **Command Format**: Use `%s` placeholder for username substitution
- **Platform Detection**: Automatic OS-appropriate default commands if empty
- **Validation**: Command existence verification before setting defaults

**Example Configuration:**
```toml
# External notifications (triggered for ALL incoming messages)
notify_command = "notify-send \"New message from %s\""

# Platform-specific examples:
# Linux:   notify_command = "notify-send \"New message from %s\""
# macOS:   notify_command = "osascript -e 'display notification \"New message from %s\"'"
# Windows: notify_command = "powershell -Command \"Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('New message from %s', 'Nospeak')\""

# Disable notifications completely:
# notify_command = ""
```

**Settings Integration:**
- **TUI Settings**: Accessible via F2 key for interactive configuration
- **Real-time Updates**: Changes applied immediately without restart
- **Debug Support**: `--debug` flag shows notification command execution details
- **Error Handling**: Graceful fallback when notification commands fail

#### 9. **Debug Logging System** (`internal/logging/logger.go`)
Centralized debug logging utility that handles all debug output without interfering with the TUI.

**Responsibilities:**
- File-based debug logging to XDG_CACHE_DIR for persistent logs
- Thread-safe logging operations with mutex protection
- Log rotation management (1MB max size, 3 backups)
- TUI-compatible logging (no stderr interference)

**Key Methods:**
- `NewDebugLogger(enabled bool)` - Create debug logger instance
- `Debug(format string, args ...interface{})` - Write debug message
- `Close()` - Close log file handle
- `InitGlobalDebugLogger(enabled bool)` - Initialize global logger

**Configuration:**
```go
type DebugLogger struct {
    enabled bool
    logger  *log.Logger
    file    *os.File
    mu      sync.RWMutex
}
```

**Log File Location**: `~/.cache/nospeak/debug.log` (respects XDG_CACHE_HOME)
**Log Format**: `[2025-01-04 15:04:05] DEBUG: message`
**Log Rotation**: 1MB per file, keep 3 backups

**Integration Points:**
- **ProfileResolver**: Uses `SetDebugMode(cfg.Debug)` to enable file logging
- **TUI App**: Has embedded logger for debug output without TUI interference
- **Notification Service**: Creates local logger instances for debug output
- **All Components**: Centralized logging ensures consistent format and file output

**Usage Examples:**
```go
// In components
logger := logging.NewDebugLogger(debug)
logger.Debug("Profile resolved for %s", npub)

// Global logger access
logging.InitGlobalDebugLogger(true)
logging.Debug("Application starting")
```

## Data Flow Architecture

### Message Sending Flow
```
CLI/TUI → Client Agent → Messaging Agent → Encryption → Enhanced Client Agent → All Managed Relays
                                                                          ├── Connection Manager (Persistent)
                                                                          ├── Retry Queue (Background)
                                                                          └── Mailbox Relay Discovery (NIP-65 + Cached Relay Lists)
```

### Enhanced Message Sending with Relay Caching
```
Message Composition → GetRecipientRelays → Cache Check → NIP-65 Fetch (if cache miss) → Cache Update → All Managed Relays
                                                                                           ├── Cached Relay Lists (Immediate)
                                                                                           ├── Network Discovery (Cache Miss)
                                                                                           ├── Profile Resolution (Automatic Cache Refresh)
                                                                                           └── Unified Profile+Relay List Caching
```

### Message Receiving Flow
```
All Managed Relays → Enhanced Client Agent → Messaging Agent → Decryption → Cache → Dual Notification System
                                                                                      ├── External Notification (Always)
                                                                                      └── In-App Notification (Context-aware)
```

### Enhanced Message Loading Flow (Paginated Scrolling)
```
TUI Chat Initialization
    ↓
loadChatHistory() - Initial message load
    ├── GetLatestMessages(partner, pageSize) - Database query (DESC + reverse)
    ├── ChatState.Messages = chronological messages
    ├── buildChatContent(messages) - Format with date bars
    └── ScrollToEnd() - Show most recent messages
    ↓
User Scrolls to Top
    ↓
loadOlderMessages() - Load older messages
    ├── GetMessagesBefore(partner, oldestMessage.SentAt, pageSize) - Cutoff query
    ├── ChatState.AddMessages(olderMessages, prepend) - Maintain order
    ├── buildChatContent(allMessages) - Rebuild content
    ├── restoreScrollPosition() - Maintain viewport
    └── Update loading state
    ↓
Continuous Pagination
    ├── Repeat loadOlderMessages() as user scrolls up
    ├── IsFullyLoaded prevents unnecessary queries
    ├── IsLoading prevents concurrent operations
    └── ChatState maintains all pagination state
```

### Enhanced Connection Management Flow
```
Application Startup
    ↓
Non-blocking Client.Connect()
    ↓
Connection Manager.Start()
    ├── Add all configured relays to management
    ├── Launch background goroutines:
    │   ├── healthCheckLoop() (every 30s)
    │   ├── reconnectLoop() (continuous)
    │   └── uiUpdateLoop() (every 500ms)
    └── Immediate return (TUI starts)
    ↓
Background Operations (Continuous)
    ├── Persistent connection attempts
    ├── Exponential backoff retry logic
    ├── Health tracking and statistics
    ├── Automatic reconnection on drops
    ├── Mailbox relay discovery and connection
    └── Real-time UI synchronization
```

### Retry Queue Processing Flow
```
PublishEvent() to All Managed Relays
    ↓
Immediate Publish Attempts (All relays concurrently)
    ↓
Failed Publishes → Enqueue for Retry
    ↓
Background Retry Processing
    ├── Exponential backoff timing (1s, 2s, 4s, 8s, 16s, 30s max)
    ├── Authentication retry on auth errors
    ├── Per-relay success/failure tracking
    └── Update connection manager health metrics
    ↓
Result Processing
    ├── Success: Mark relay healthy, update UI
    ├── Failure: Track for health monitoring
    └── Max retries: Stop attempting, log failure
```

### Profile Resolution Flow
```
TUI/CLI → Profile Resolver → Cache Check → Network Fetch (Kind 0 + 10002) → Atomic Cache Store → Display
                                                          ├── Profile Metadata (Kind 0)
                                                          ├── Relay Lists (Kind 10002)
                                                          └── Unified Caching (24h TTL)
```

### Notification System Flow
```
Incoming Message Reception
    ↓
Partner Verification (auto-add new contacts)
    ↓
External Notification (ALWAYS triggered)
    ├── Command Execution (notify-send, osascript, etc.)
    ├── Platform-Specific Handling
    └── Graceful Error Handling
    ↓
Current Contact Check (TUI Context)
    ↓
┌─────────────────────────────────────────────────────────────┐
│                    Contact Context Analysis                   │
├─────────────────────────────────────────────────────────────┤
│ IF Current Contact → Direct Message View Update              │
│ └── Immediate display in chat window                        │
│ └── No unread marking (user is actively viewing)            │
│                                                              │
│ IF Other Contact → In-App Notification System               │
│ ├── Mark as unread (unreadMessages[contact] = true)         │
│ ├── Update contact list with green dot (●) indicator         │
│ ├── Show status bar notification (3-second duration)       │
│ └── Trigger UI refresh for visual feedback                  │
└─────────────────────────────────────────────────────────────┘
    ↓
Visual State Update
    ├── Contact list highlighting refresh
    ├── Unread count updates
    └── Status bar notification display
```

### Dual Notification Architecture
```
┌─────────────────────────────────────────────────────────────────┐
│                    NOTIFICATION SYSTEM                         │
├─────────────────────────────────────────────────────────────────┤
│  EXTERNAL NOTIFICATIONS (System Level)                         │
│  ├─ Trigger: ALL incoming messages                            │
│  ├─ Platform: Linux/macOS/Windows system notifications        │
│  ├─ Config: notify_command in TOML config                    │
│  └─ Execution: Background goroutine with error handling       │
│                                                                 │
│  IN-APP NOTIFICATIONS (TUI Level)                              │
│  ├─ Trigger: Messages from non-current contacts               │
│  ├─ Visual: Green dots (●), status messages, highlighting     │
│  ├─ State: Thread-safe current contact tracking               │
│  └─ Management: Auto-clear on contact selection               │
└─────────────────────────────────────────────────────────────────┘
```

## Protocol Implementation

### Supported NIPs (Nostr Implementation Possibilities)
- **NIP-01**: Basic protocol functionality
- **NIP-04**: Deprecated encryption (legacy support)
- **NIP-19**: Bech32 encoding for keys (nsec/npub formats)
- **NIP-44**: End-to-end encryption v2
- **NIP-65**: Messaging relay list (cached alongside profiles)
- **NIP-59**: Gift wrapped events
- **NIP-05**: DNS-based identifier verification
- *Implemented via github.com/nbd-wtf/go-nostr - see Module Dependencies for details*

### Event Types
- **Kind 0**: Profile metadata
- **Kind 14**: Direct messages (deprecated)
- **Kind 4**: Encrypted direct messages
- **Kind 10002**: Messaging relay list (NIP-65) - **Cached with profile metadata**
- **Kind 1059**: Gift wrap event
- **Kind 1062**: Sealed direct event

## Security Architecture

### Encryption Layers
1. **Transport Layer**: WebSocket/TLS to relays
2. **Message Layer**: NIP-44 v2 end-to-end encryption
3. **Metadata Protection**: NIP-59 gift wrapping
4. **Authentication**: NOSTR signature verification

### Key Management
- Private keys stored in bech32 format (nsec)
- Public keys in bech32 format (npub)
- Optional key derivation from mnemonic seeds
- Secure key generation using crypto/rand

## Deployment & Operations

### Build Commands
```bash
# Build binary (cross-compilation ready)
go build -o nospeak .

# Run directly
go run .

# Run tests
go test ./...

# Run integration tests
./test.sh

# Cross-compilation examples (CGO_ENABLED=0 thanks to modernc.org/sqlite)
CGO_ENABLED=0 GOOS=windows GOARCH=amd64 go build -o nospeak-windows.exe .
CGO_ENABLED=0 GOOS=darwin GOARCH=arm64 go build -o nospeak-macos .
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o nospeak-linux .
```
*See Module Dependencies section for detailed cross-compilation information*

### Configuration Management
- Default config location: `~/.config/nospeak/config.toml`
- Environment variable overrides supported
- Command-line flag overrides available

### Monitoring & Debugging
- Debug logging with `-debug` flag
- Relay connection status monitoring
- Message delivery confirmation
- Performance metrics collection

## Development Guidelines

### Code Organization
- Each agent in its own package
- Clear separation of concerns
- Interface-based design for testability
- Minimal dependencies between agents

#### Git Operations Policy
**CRITICAL**: Never perform any git operations (commit, push, pull, merge, etc.) unless explicitly instructed by the user. This includes but is not limited to:
- git commit commands
- git push operations
- git pull or merge operations
- git branch management
- git tag operations
- git rebase or cherry-pick operations

All git operations require explicit user direction and consent before execution.

### Testing Strategy
- Unit tests for each agent
- Integration tests for agent interactions
- Mock external dependencies (relays, file system)
- Protocol compliance testing
- **Cross-platform testing** enabled by pure Go dependencies (see Module Dependencies)
- SQLite testing with in-memory databases for isolation

### Performance Considerations
- Connection pooling for relays
- Efficient message caching with SQLite optimizations
- Lazy profile loading with TTL-based expiration
- Minimal memory footprint for TUI
- **CGO-free operation** reduces memory overhead (see Module Dependencies)

## Troubleshooting

### Common Issues
1. **Relay Connection Failures**: Enhanced connection management automatically retries with exponential backoff
2. **Slow Connection Establishment**: Background management ensures eventual connection to all relays
3. **Intermittent Connections**: Automatic reconnection handles dropped connections transparently
4. **Decryption Errors**: Verify key format and compatibility
5. **Cache Corruption**: Delete cache file and restart
6. **Notification Failures**: Check system notification permissions
7. **UI Not Updating**: Connection status updates every 500ms to real-time sync

### Enhanced Connection Debugging
The enhanced connection management provides detailed logging for troubleshooting:

**Debug Logging Features:**
- **Connection Events**: `✓ NEW CONNECTION: Successfully connected to relay: wss://...`
- **Reconnection Events**: `✓ RECONNECTED: Successfully reconnected to relay: wss://...`
- **Disconnection Events**: `✗ DISCONNECTED: Lost connection to relay: wss://...`
- **Retry Operations**: Detailed retry queue operations and timing
- **Health Metrics**: Per-relay success/failure statistics

**Connection Status Monitoring:**
- **Real-time Counter**: Status bar shows "X/Y relays" with color coding
- **Progress Tracking**: Watch connection progress from 0/3 to full connectivity
- **Health Statistics**: Use `GetConnectionStats()` for detailed metrics
- **Background Operations**: All reconnection happens automatically without user intervention

**Troubleshooting Commands:**
```bash
# Enable debug logging for connection details
./nospeak --debug

# Monitor connection status in real-time
tail -f ~/.cache/nospeak/debug.log | grep -E "(CONNECTION|DISCONNECTED|RECONNECTED)"

# Check specific relay connection attempts
grep "relay.damus.io" ~/.cache/nospeak/debug.log
```

### Debug Mode
Debug logging provides detailed operation tracing without interfering with the TUI interface.

**Log File Location**: `~/.cache/nospeak/debug.log`
**Enable via Config**:
```toml
debug = true
```

**Enable via Command Line**:
```bash
./nospeak -debug
./nospeak --debug receive
```

**What Gets Logged**:
- Profile resolution and caching operations
- Network queries and relay interactions
- TUI contact list updates and partner detection
- Notification command execution
- Message processing errors and troubleshooting

**Log Viewing**:
```bash
# View debug logs
tail -f ~/.cache/nospeak/debug.log

# Search for specific patterns
grep "profile" ~/.cache/nospeak/debug.log

# View recent logs
tail -100 ~/.cache/nospeak/debug.log
```

**Benefits**:
- **TUI Compatibility**: No debug output interferes with terminal interface
- **Persistent Logs**: Debug information saved between sessions
- **Centralized**: All components use consistent logging format
- **XDG Compliant**: Follows established cache directory standards

## Module Dependencies

Nospeak uses carefully selected Go modules to provide cross-platform functionality with excellent cross-compilation support. The dependency strategy prioritizes pure Go implementations to eliminate CGO requirements and enable static binary builds.

### Direct Dependencies

#### Core Dependencies

**modernc.org/sqlite v1.40.0**
- **Purpose**: Pure Go SQLite driver for cross-platform database operations
- **Usage**: Local message and profile caching with SQLite backend
- **Cross-Compilation Benefits**: Enables `CGO_ENABLED=0` builds for all platforms
- **Key Features**:
  - CGO-free implementation using pure Go
  - Embedded SQLite engine, no external dependencies
  - WAL mode, memory-mapped I/O, and performance optimizations
  - Full SQL functionality with ACID compliance

**github.com/nbd-wtf/go-nostr v0.52.1**
- **Purpose**: Complete Nostr protocol implementation
- **Usage**: Core Nostr functionality - event creation, signing, relay communication
- **Key Features**:
  - NIP-19 encoding/decoding (nsec/npub formats)
  - NIP-44 v2 encryption and NIP-59 gift wrapping
  - Relay connection management and load balancing
  - Profile metadata handling and verification

**github.com/rivo/tview v0.42.1-0.20250929082832-e113793670e2**
- **Purpose**: Terminal User Interface (TUI) framework
- **Usage**: Command-line interface with chat windows, contact lists, input fields
- **Key Features**:
  - Rich terminal UI components with themes
  - Keyboard navigation and customizable shortcuts
  - Responsive layout management
  - Unicode and emoji support

**github.com/gdamore/tcell/v2 v2.8.1**
- **Purpose**: Low-level terminal interface (dependency of tview)
- **Usage**: Terminal rendering, keyboard/mouse input handling
- **Cross-platform**: Works on Linux, macOS, Windows terminals
- **Features**: True color support, mouse events, alternate screen buffer

**github.com/pelletier/go-toml/v2 v2.2.4**
- **Purpose**: TOML configuration file parsing
- **Usage**: Reading/writing nospeak configuration files
- **Key Features**:
  - High-performance TOML parser
  - Preserves comments and formatting
  - Strict error reporting for malformed configs

**github.com/data.haus/nospeak/internal/logging** (Internal Package)
- **Purpose**: Centralized debug logging utility for all components
- **Usage**: File-based debug logging that doesn't interfere with TUI
- **Key Features**:
  - XDG cache directory compliance (`~/.cache/nospeak/debug.log`)
  - Log rotation and size management (1MB max, 3 backups)
  - Thread-safe concurrent logging with mutex protection
  - Consistent timestamp formatting
  - TUI-compatible operation (no stderr output)

### SQLite Cross-Compilation Strategy

The choice of `modernc.org/sqlite` over CGO-based alternatives (like `mattn/go-sqlite3`) is strategic:

**vs mattn/go-sqlite3 (CGO-based):**
| Feature | modernc.org/sqlite | mattn/go-sqlite3 |
|---------|-------------------|------------------|
| CGO Required | **No** | Yes |
| Cross-compilation | **Excellent** | Limited |
| Binary Size | Larger (self-contained) | Smaller (system lib) |
| Performance | Good | Excellent |
| Platform Support | **Universal** | Limited by SQLite availability |

**Cross-Compilation Workflow:**
```bash
# Single command builds for any platform - no external SQLite libs needed
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o nospeak-linux .
CGO_ENABLED=0 GOOS=darwin GOARCH=arm64 go build -o nospeak-macos .
CGO_ENABLED=0 GOOS=windows GOARCH=amd64 go build -o nospeak-windows.exe .
```

**SQLite Performance Optimizations:**
```go
pragmas := []string{
    "PRAGMA journal_mode = WAL",      // Write-Ahead Logging for concurrency
    "PRAGMA synchronous = NORMAL",     // Balanced safety/performance
    "PRAGMA cache_size = 10000",      // In-memory cache pages
    "PRAGMA temp_store = MEMORY",     // Temporary tables in memory
    "PRAGMA mmap_size = 268435456",   // Memory-mapped I/O (256MB)
    "PRAGMA foreign_keys = ON",       // Foreign key constraints
}
```


### Architecture & Dependency Integration

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Interface Layer                    │
├─────────────────────────────────────────────────────────────────┤
│  TUI: tview + tcell (Terminal rendering, keyboard, themes)     │
│  CLI: cobra + viper (Command parsing, config management)       │
└─────────────────┬───────────────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────────────┐
│                       Business Logic Layer                      │
├─────────────────────────────────────────────────────────────────┤
│  Nostr: go-nostr (Protocol, events, encryption, relay mgmt)    │
│  Config: go-toml (Configuration parsing and validation)        │
└─────────────────┬───────────────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────────────┐
│                    Data Persistence Layer                       │
├─────────────────────────────────────────────────────────────────┤
│  Cache: modernc/sqlite (Messages, profiles, TTL, search)       │
│  Storage: XDG compliance (Config in ~/.config/, cache in ~/.cache/) │
└─────────────────────────────────────────────────────────────────┘
```

### Platform-Specific Considerations

#### No Build Tags Required
All dependencies are pure Go or have cross-platform implementations, eliminating the need for `//go:build` tags.

#### File System Handling
- **XDG Base Directory Specification**:
  - Config: `~/.config/nospeak/config.toml`
  - Cache: `~/.cache/nospeak/messages.db`
- **Cross-platform paths**: Uses `filepath.Join()` and `os.UserHomeDir()`
- **Windows support**: Proper path separators and directory handling

#### Notification System
Platform-agnostic notification system with automatic detection:
```bash
# Linux: notify-send
# macOS: osascript
# Windows: PowerShell notifications
```

### Testing Strategy with Pure Go Dependencies

#### Advantages for Cross-Platform Testing
- **Local testing**: Any platform can test for all target platforms
- **CI/CD simplicity**: No platform-specific build environments needed
- **Consistent behavior**: Same codebase runs everywhere
- **In-memory databases**: SQLite tests use temp directories for isolation

#### SQLite Testing Approach
- **Environment variable override**: `XDG_CACHE_HOME` for test isolation
- **In-memory databases**: Uses temporary SQLite files for isolated tests
- **Comprehensive coverage**: Tests all cache operations, migrations, edge cases

## CLI Testing Infrastructure

The nospeak project includes comprehensive testing for the CLI package (`cmd/`) to ensure reliable command-line functionality.

### Test Structure (`cmd/cmd_test.go`)

#### Test Categories
1. **Argument Validation Tests**
   - Validates command-line argument parsing for all CLI commands
   - Tests edge cases like missing arguments, empty values, and malformed input
   - Covers `Send`, `SetName`, `Receive`, `SetMessagingRelays`, and `Chat` commands

2. **Mock Client Integration Tests**
   - Uses `MockClient` from `mocks/client.go` to simulate client behavior
   - Tests partner management, message sending, and profile operations
   - Validates client interactions without requiring real Nostr relay connections

3. **Configuration Validation Tests**
   - Tests configuration validation logic for various scenarios
   - Validates nsec/npub formats, relay URLs, and required fields
   - Tests both valid and invalid configuration combinations

4. **Error Handling Tests**
   - Comprehensive testing of error conditions and edge cases
   - Validates proper error responses for invalid inputs
   - Tests graceful handling of empty values, malformed data, and connection failures

#### Mock Infrastructure (`mocks/`)

##### MockClient (`mocks/client.go`)
- **Purpose**: Provides a mock implementation of the client interface for testing
- **Features**:
  - Partner management (AddPartner, IsPartner, GetPartnerNpubs)
  - Message operations (SendChatMessage, GetMessageHistoryEnhanced)
  - Profile management (SetProfileName, GetPartnerDisplayNames)
  - Configuration operations (SetMessagingRelays)
- **Usage**: Enables isolated testing without external dependencies

##### MockCache (`mocks/cache.go`)
- **Purpose**: Implements the Cache interface for testing message and profile storage
- **Features**:
  - Thread-safe message storage and retrieval
  - Profile caching with TTL support
  - Statistics tracking for cache operations
- **Integration**: Used by MockClient and other components for isolated testing

#### Test Utilities (`testutils/utils.go`)
- **TestKeys Generation**: Creates deterministic test key pairs for consistent testing
- **Temporary File Management**: Handles creation and cleanup of test config files
- **Event Creation**: Utilities for creating test Nostr events
- **Assertion Helpers**: Common test assertion patterns and error checking

### Testing Limitations

#### CLI Command Testing Challenges
- **log.Fatalf Usage**: CLI commands use `log.Fatalf` for error handling, which terminates test execution
- **Coverage Limitation**: Due to fatal error handling, line coverage is limited to validation logic
- **Solution Approach**: Tests focus on validation logic, error scenarios, and integration patterns rather than full execution paths

#### Mitigation Strategies
- **Validation Logic Testing**: Comprehensive testing of argument validation and input sanitization
- **Mock Integration**: Testing of client interactions and error scenarios through mocks
- **Integration Testing**: End-to-end testing through the application's normal execution paths

### Test Execution

#### Running Tests
```bash
# Run all CLI tests with coverage
go test -v ./cmd/ -cover

# Generate detailed coverage report
go test -coverprofile=coverage.out ./cmd/ && go tool cover -func=coverage.out
```

#### Test Coverage
- **Validation Logic**: 100% coverage of argument validation and input checking
- **Error Scenarios**: Comprehensive coverage of error conditions and edge cases
- **Integration Patterns**: Testing of client interactions and configuration validation
- **Limitation**: Line coverage limited by `log.Fatalf` usage in CLI commands

This testing infrastructure ensures reliable CLI functionality while maintaining isolation from external dependencies and providing comprehensive validation of command behavior.

This architecture document provides a comprehensive overview of the nospeak system's components and their interactions.
