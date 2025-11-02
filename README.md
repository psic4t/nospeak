# Nospeak

nospeak is a terminal-based Nostr chat client built with Go. Nospeak provides a secure, decentralized messaging experience through the Nostr protocol with both TUI and CLI interfaces.

## Features

- **Terminal User Interface (TUI)** - Interactive chat interface with contact list and message history
- **Command Line Interface (CLI)** - Scriptable commands for sending/receiving messages
- **Modern Nostr Private Messaging** - Implements NIP-44 encryption and NIP-59 gift wraps for secure communication
- **End-to-end encryption** - Private messaging using NIP-44 v2 encryption protocol
- **Sealed direct messages** - NIP-59 gift wraps provide metadata protection and sender verification
- **Message caching** - SQLite or in-memory caching for message persistence

## Installation

### From Source

```bash
git clone https://github.com/data.haus/nospeak.git
cd nospeak
make install
```

### Using Go

```bash
go install github.com/data.haus/nospeak@latest
```

## Quick Start

1. **Initialize configuration and create a new keypair:**
   ```bash
   nospeak
   # Edit ~/.config/nospeak/config.toml to add existing keys
   ```

2. **Set your mailbox relays from config if needed**
   ```bash
   nospeak set-messaging-relays
   ```

3. **Add some npubs to chat in config file**
   ```bash
   (this will be easier in the future)

4. **Start the TUI interface:**
   ```bash
   nospeak
   ```

## Usage

### TUI Mode (Default)

Launch the interactive terminal interface:
```bash
nospeak
```

**TUI Keyboard Shortcuts:**
- `Ctrl+C` / `Ctrl+Q` - Quit application
- `Tab` - Switch between contact list and input
- `Enter` - Send message (when in input field)
- `PgUp` / `PgDn` - Scroll message pane up/down
- `Ctrl+k` / `Ctrl+j` - Switch between contacts (k=up, j=down)
- `Ctrl+p` - Show profile information for current contact
- `F3` - Toggle contacts pane
- `↑` / `↓` - Navigate contact list

### CLI Commands

**Send a message:**
```bash
nospeak send <npub> "Your message here"
```

**Listen for messages:**
```bash
nospeak receive
```

**Set your profile name:**
```bash
nospeak set-name "Your Name"
```

**Set messaging relays from config:**
```bash
nospeak set-messaging-relays
```

**Initialize configuration file:**
```bash
nospeak init
```

**Generate new Nostr identity:**
```bash
nospeak new-identity
```

## Development

### Building

```bash
# Development build
make dev

# Production build with SQLite support
make release

# Static build without SQLite
make release-static

# Install to system
make install
```

### Message Flow

1. **Message Creation**: Content is encrypted using NIP-44 v2 with a conversation key derived from sender and recipient keys
2. **Gift Wrapping**: The encrypted message (kind 14) is sealed in a NIP-59 gift wrap (kind 1059/62)
3. **Transport**: Gift wrapped messages are published to configured relays
4. **Reception**: Clients subscribe to gift wrap events, unwrap them to reveal the inner rumor, then decrypt the content

## About 
Questions? Ideas? File bugs and TODOs through the issue tracker!
