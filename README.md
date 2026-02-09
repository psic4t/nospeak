# Nospeak

nospeak is a decentralized Nostr chat client for secure, private messaging. It is easy to
use but has state of the art end-to-end encryption without metadata leakage. 

Install on Android over [F-Droid](https://fdroid.org), [Obtainium](https://github.com/ImranR98/Obtainium) or [Zapstore](https://github.com/zapstore/zapstore/releases) or use the Progressive Web App on https://nospeak.chat

## Features

### Private Messaging
- **1-on-1 Conversations** — End-to-end encrypted direct messages using the NIP-17 gift-wrap protocol with no metadata leakage
- **Group Chats** — Create named group conversations with multiple participants, all fully encrypted
- **Emoji Reactions** — React to messages with emoji; reactions are privacy-wrapped just like messages
- **Reply & Quote** — Reply to specific messages in a conversation
- **Message Search** — Search through your chat history

### Always-On Notifications
- **Background Messaging Service (Android)** — A permanent foreground service stays connected to your relays so you never miss a message, even when the app is closed
- **Survives Reboots** — The service restarts automatically after device reboots or app updates
- **Web Push Notifications** — Get notified of new messages in the browser via PWA notifications

### Encrypted Media & Sharing
- **Encrypted Images & Videos** — Media is encrypted client-side with AES-256-GCM before upload to Blossom servers
- **Voice Messages** — Record and send voice messages with waveform visualization (up to 3 minutes)
- **Location Sharing** — Share your GPS location as an interactive map
- **File Attachments** — Send any file type, fully encrypted
- **Link Previews & YouTube Embeds** — Rich URL previews with Open Graph metadata
- **Android Share Target** — Share images, videos, and text directly from other apps into nospeak

### Privacy & Security
- **NIP-17 Gift Wrap Protocol** — Triple-layer encryption (Gift Wrap, Seal, Rumor) with randomized timestamps to prevent timing analysis
- **NIP-44 Encryption** — State-of-the-art versioned encryption for all message content
- **Encrypted Contact Lists** — Your contact list is encrypted before syncing to relays
- **Android Keystore** — When using nsec to login, secret keys stored in hardware-backed secure storage on Android
- **No Central Server** — All data lives locally on your device and on Nostr relays you choose

### Multi-Platform
- **Android App** — Native Android app with OS integration (background service, share targets, haptics)
- **Progressive Web App** — Use in any modern browser with offline support
- **External Signer Support** — Login with NIP-07 browser extensions (nos2x, Alby) or NIP-55 Android signers (Amber)

### Contacts & Discovery
- **Search & Add Contacts** — Find users by name, npub, or NIP-05 address
- **QR Code Sharing** — Share your profile or scan others via QR codes
- **NIP-05 Verification** — Verified identity badges on profiles

### Chat Organization
- **Favorites** — Star important messages, synced across devices
- **Archives** — Archive old conversations to keep your inbox clean
- **Unread Badges** — Per-conversation unread message counts

### Relay Management
- **Custom Relay Configuration** — Choose which relays you send and receive messages on
- **Relay Health Monitoring** — Real-time connection status and auth state per relay
- **Auto-Reconnect** — Automatic reconnection with exponential backoff

### Personalization
- **6 Languages** — English, Deutsch, Español, Português, Français, Italiano
- **Theme Support** — System, light, and dark mode
- **Profile Customization** — Set your name, avatar, banner, bio, and Lightning address

## Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn package manager

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/nospeak.git
cd nospeak

# Install dependencies
npm install

# Start development server
npm run dev
```

### Project Structure

```
src/
├── lib/
│   ├── components/          # Svelte components
│   ├── core/              # Core business logic
│   ├── db/                # Database layer (Dexie)
│   ├── stores/            # State management
│   └── utils/             # Utility functions
├── routes/                # SvelteKit pages and API routes
└── app.html              # Main HTML template
```

## Architecture

### Core Components

- **ConnectionManager**: Handles Nostr relay connections and subscriptions
- **MessagingService**: Manages message sending/receiving with encryption
- **AuthService**: Handles user authentication with Nostr keys
- **ProfileService**: Manages user profiles and metadata
- **MessageRepository**: Local database storage for messages

### Key Technologies

- **SvelteKit**: Modern web framework with SSR support
- **TypeScript**: Type-safe development
- **Dexie**: IndexedDB wrapper for local storage
- **Nostr Tools**: Nostr protocol implementation
- **Tailwind CSS**: Utility-first CSS framework



## Configuration

### Environment Variables

Create `.env` file for local development (restart the server to apply changes):

```env
# Runtime-configurable defaults (served to clients via GET /api/runtime-config)
# Relays MUST use wss:// and servers MUST use https://
NOSPEAK_DISCOVERY_RELAYS=wss://nostr.data.haus,wss://relay.damus.io,wss://nos.lol,wss://relay.primal.net,wss://purplepag.es
NOSPEAK_DEFAULT_MESSAGING_RELAYS=wss://nostr.data.haus,wss://nos.lol,wss://relay.damus.io
NOSPEAK_SEARCH_RELAY=wss://relay.nostr.band
NOSPEAK_BLASTER_RELAY=wss://sendit.nosflare.com
NOSPEAK_DEFAULT_BLOSSOM_SERVERS=https://blossom.data.haus,https://blossom.primal.net
NOSPEAK_WEB_APP_BASE_URL=https://nospeak.chat
```

### Docker Compose runtime configuration

The Node server reads these values from `process.env` at startup and serves the effective config to the web client via `GET /api/runtime-config` (same-origin). Update the environment values and recreate the container to apply changes.

```yaml
services:
  nospeak:
    image: nospeak:latest
    environment:
      NOSPEAK_DISCOVERY_RELAYS: "wss://nostr.data.haus,wss://relay.damus.io,wss://nos.lol,wss://relay.primal.net,wss://purplepag.es"
      NOSPEAK_DEFAULT_MESSAGING_RELAYS: "wss://nostr.data.haus,wss://nos.lol,wss://relay.damus.io"
      NOSPEAK_SEARCH_RELAY: "wss://relay.nostr.band"
      NOSPEAK_BLASTER_RELAY: "wss://sendit.nosflare.com"
      NOSPEAK_DEFAULT_BLOSSOM_SERVERS: "https://blossom.data.haus,https://blossom.primal.net"
      NOSPEAK_WEB_APP_BASE_URL: "https://nospeak.chat"
```

Apply changes:

```bash
docker compose up -d --force-recreate
```

### Relay Configuration

Default relays are configured, but users can add custom relays in settings. The app automatically:

- Connects to multiple relays for redundancy
- Handles connection failures with retry logic
- Manages subscription optimization

## Security

### Encryption

- All messages are end-to-end encrypted using Nostr's NIP-44
- Private keys never leave the user's device
- Profile metadata is publicly shared as per Nostr protocol

### Data Storage

- Local IndexedDB for message history and profiles
- No server-side storage of private data

## Android (Capacitor)

Nospeak can be packaged as a native Android application using Capacitor.

### Requirements

- Node.js 18+
- Java 17 (for recent Android Gradle plugin versions)
- At least one Android emulator or physical device (Android 8.0 / API 26 or newer)

### Setup and Build

```bash
# Install dependencies
npm install

# Build web assets and sync to Android project
npm run build:android

# Build an unsigned APK
cd android && ./gradlew clean :app:assembleDebug
```

The Capacitor configuration (`capacitor.config.ts`) is set to use the SvelteKit `build/android` directory as `webDir`, so the Android app loads the bundled nospeak UI from local assets.

## Deployment

### Docker

```dockerfile
# Build image
docker build -t nospeak .

# Run container
docker run -p 5173:5173 nospeak
```

### Static Hosting

```bash
# Build for production
npm run build

# Deploy build/ directory to your static host
rsync -av build/ user@server:/var/www/nospeak/
```


## Nostr Integration

Nospeak Web implements the following NIPs (Nostr Implementation Proposals):

### Core Protocol
- **NIP-01**: Basic Nostr event and client protocol
- **NIP-17**: Encrypted direct messages and messaging relays
- **NIP-19**: bech32-encoded entities for keys and identifiers

### Identity, Metadata & Discovery
- **NIP-05**: Mapping Nostr keys to DNS-based internet identifiers
- **NIP-50**: Search relays for contact discovery
- **NIP-65**: Relay list metadata for messaging/mailbox relays

### Reactions
- **NIP-25**: Reaction events for emoji responses on messages

### Content & Media
- **NIP-44**: Encrypted payloads for direct messages
- **NIP-59**: Gift wrapper events for DM and media delivery
- **NIP-98**: HTTP-authenticated media uploads

### Signer Integration
- **NIP-07**: Browser extension signer integration
- **NIP-55**: Android native signer integration (Amber and similar)

## License
Copyright (C) 2026 psic4t

This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. 
