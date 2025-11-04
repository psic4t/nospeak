# Nospeak System Architecture & Components

## Overview

Nospeak is a terminal-based Nostr chat client that implements decentralized messaging using the Nostr protocol.

## System Architecture

### Core Components (Agents)

#### 1. **Client** (`client/client.go`)
The main orchestrator that manages all Nostr protocol operations.

**Responsibilities:**
- Relay connection management and load balancing
- Event publishing and subscription management
- Authentication with Nostr relays
- Coordinating message encryption/decryption
- Profile resolution and caching

**Key Methods:**
- `NewClient()` - Initialize client with configuration
- `CreateClient()` - Helper that consolidates config loading and client creation
- `Connect()` - Establish connections to relays
- `PublishEvent()` - Send events to relays
- `SubscribeToEvents()` - Listen for incoming events
- `GetProfile()` - Resolve user profiles

**Configuration:**
```go
type Client struct {
    config    *config.Config
    relays    []*nostr.Relay
    secretKey string
    publicKey string
    mu        sync.RWMutex
}
```

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
    SearchMessages(recipientNpub, query string) []MessageEntry
    GetMessagesByDateRange(recipientNpub string, start, end time.Time) []MessageEntry
    GetMessageStats(recipientNpub string) (sent, received int, err error)
    HasMessage(eventID string) bool

    // Profile operations
    GetProfile(npub string) (ProfileEntry, bool)
    SetProfile(npub string, profile ProfileMetadata, ttl time.Duration) error
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

-- Profile cache with TTL support
CREATE TABLE profile_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    npub TEXT NOT NULL UNIQUE,
    name TEXT, display_name TEXT, about TEXT, picture TEXT,
    nip05 TEXT, lud16 TEXT, website TEXT, banner TEXT,
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
CLI/TUI → Client Agent → Messaging Agent → Encryption → Client Agent → Relays
```

### Message Receiving Flow
```
Relays → Client Agent → Messaging Agent → Decryption → Cache → Dual Notification System
                                                               ├── External Notification (Always)
                                                               └── In-App Notification (Context-aware)
```

### Profile Resolution Flow
```
TUI/CLI → Profile Resolver → Cache Check → Relay Fetch → Cache Store → Display
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
- **NIP-59**: Gift wrapped events
- **NIP-05**: DNS-based identifier verification
- *Implemented via github.com/nbd-wtf/go-nostr - see Module Dependencies for details*

### Event Types
- **Kind 0**: Profile metadata
- **Kind 14**: Direct messages (deprecated)
- **Kind 4**: Encrypted direct messages
- **Kind 10050**: Messaging relay list
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
1. **Relay Connection Failures**: Check network connectivity and relay availability
2. **Decryption Errors**: Verify key format and compatibility
3. **Cache Corruption**: Delete cache file and restart
4. **Notification Failures**: Check system notification permissions

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

This architecture document provides a comprehensive overview of the nospeak system's components and their interactions.
