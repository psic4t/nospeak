# Project Context

## Purpose
Nospeak is a terminal-based Nostr chat client that provides decentralized, end-to-end encrypted messaging using the Nostr protocol. The project aims to offer a privacy-focused, censorship-resistant communication platform that operates without centralized servers, leveraging the Nostr network's distributed relay architecture.

**Key Goals:**
- Provide secure, end-to-end encrypted messaging via NIP-44 v2
- Support both terminal UI (TUI) and CLI interfaces for different use cases
- Implement reliable message delivery with intelligent retry mechanisms
- Offer cross-platform compatibility with static binary builds
- Maintain user privacy through metadata protection (NIP-59 gift wrapping)
- Support offline-capable messaging through intelligent caching

## Tech Stack
- **Language**: Go 1.21+
- **Nostr Protocol**: github.com/nbd-wtf/go-nostr v0.52.1
- **Database**: modernc.org/sqlite v1.40.0 (CGO-free for cross-compilation)
- **Terminal UI**: github.com/rivo/tview v0.42.1 + github.com/gdamore/tcell/v2 v2.8.1
- **Configuration**: github.com/pelletier/go-toml/v2 v2.2.4
- **Build System**: Standard Go toolchain with Makefile
- **Cross-compilation**: CGO_ENABLED=0 builds for Linux, macOS, Windows

## Project Conventions

### Code Style
- **Formatting**: Standard Go formatting (`go fmt`)
- **Naming**: Go conventions - PascalCase for exported, camelCase for unexported
- **Package Structure**: One main responsibility per package (client, cache, tui, config, etc.)
- **Comments**: No inline comments unless explicitly requested
- **Error Handling**: Explicit error handling with proper error propagation
- **Concurrency**: Extensive use of mutexes for thread safety in concurrent operations

### Architecture Patterns
- **Agent-Based Architecture**: Each major component is an "agent" with clear responsibilities
- **Interface-Driven Design**: All major components implement interfaces for testability
- **Dependency Injection**: Components receive dependencies through constructors
- **Background Goroutines**: Persistent connection management, retry queues, and health monitoring
- **Unified Caching**: Single-method approach for profile and relay list updates to prevent race conditions
- **Non-blocking Operations**: Connection establishment and message processing happen in background

### Testing Strategy
- **Unit Tests**: Comprehensive coverage for all packages using Go's testing package
- **Mock Infrastructure**: Mock implementations for client, cache, and config interfaces
- **Integration Tests**: End-to-end testing through normal application execution paths
- **Cross-platform Testing**: Pure Go dependencies enable testing on any platform
- **SQLite Testing**: In-memory databases with temporary files for isolated testing
- **CLI Testing**: Mock-based testing for command validation and client interactions

### Git Workflow
- **No Automatic Git Operations**: AI assistants must never perform git operations without explicit user instruction
- **Commit Requirements**: All commits require explicit user direction and consent
- **Branch Strategy**: Main development on main branch, feature branches for significant changes
- **Change Proposals**: Use OpenSpec system for architectural changes and new features

## Domain Context

### Nostr Protocol Implementation
Nospeak implements the Nostr (Notes and Other Stuff Transmitted by Relays) protocol, a decentralized communication network. Key protocol features:

**Supported NIPs:**
- NIP-01: Basic protocol functionality
- NIP-04: Legacy encryption (deprecated but supported)
- NIP-19: Bech32 encoding (nsec/npub formats)
- NIP-44: End-to-end encryption v2 (primary encryption method)
- NIP-59: Gift wrapping for metadata protection
- NIP-65: Messaging relay list discovery and caching
- NIP-05: DNS-based identifier verification

**Event Types:**
- Kind 0: Profile metadata
- Kind 4: Encrypted direct messages
- Kind 10002: Messaging relay list (NIP-65)
- Kind 1059: Gift wrap events
- Kind 1062: Sealed direct events

### Message Flow Architecture
- **Enhanced Connection Management**: Persistent relay connections with automatic reconnection
- **Intelligent Retry System**: Background retry queue with exponential backoff
- **Mailbox Relay Discovery**: NIP-65 relay discovery with 24-hour caching
- **Dual Notification System**: External system notifications + in-app TUI notifications
- **Paginated Message Loading**: Efficient chronological message retrieval with pagination

### Security Model
- **End-to-End Encryption**: NIP-44 v2 encryption for all direct messages
- **Metadata Protection**: NIP-59 gift wrapping for privacy
- **Key Management**: Bech32-encoded keys (nsec/npub) with secure generation
- **Authentication**: Nostr signature verification for all events

## Important Constraints

### Technical Constraints
- **CGO-Free Operation**: Must use modernc.org/sqlite instead of CGO-based alternatives for cross-compilation
- **Terminal Compatibility**: TUI must work across Linux, macOS, and Windows terminals
- **Memory Efficiency**: Minimal memory footprint for terminal-based operation
- **Offline Capability**: Core functionality must work with cached data during network outages
- **Thread Safety**: All concurrent operations must be properly synchronized

### Protocol Constraints
- **Nostr Compliance**: Must remain compatible with standard Nostr relays and clients
- **Encryption Standards**: Must use NIP-44 v2 for new messages, support NIP-04 for legacy
- **Event Format**: Must follow Nostr event structure and signing requirements
- **Rate Limiting**: Must respect relay rate limits and implement backoff strategies

### User Experience Constraints
- **Terminal-First Design**: Primary interface must be fully functional in terminal
- **Non-blocking Operations**: UI must remain responsive during background operations
- **Graceful Degradation**: Must function with partial relay connectivity
- **XDG Compliance**: Must respect XDG Base Directory specification for config/cache locations

## External Dependencies

### Nostr Network Infrastructure
- **Public Relays**: Default relay list includes wss://nostr.data.haus and other public relays
- **Relay Discovery**: Dynamic discovery of recipient's preferred relays via NIP-65
- **Network Resilience**: Must handle relay failures and network partitions gracefully

### System Integration
- **Notification Systems**: Platform-specific notification commands (notify-send, osascript, PowerShell)
- **File System**: XDG-compliant configuration and cache directory management
- **Terminal Environment**: Must handle various terminal sizes, color capabilities, and input methods

### Build and Deployment
- **Go Toolchain**: Requires Go 1.21+ for building and testing
- **Cross-compilation**: Support for Linux (amd64/arm64), macOS (amd64/arm64), Windows (amd64)
- **Static Binaries**: All builds must be static binaries with no external dependencies
