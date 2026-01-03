# Nospeak

nospeak is a decentralized Nostr chat client for secure, private messaging. It is easy to
use but has state of the art end-to-end encryption without metadata leakage. 

Use https://nospeak.chat or download the APK for Android

## Features

- **Decentralized Chat**: Uses Nostr relays without central servers
- **Private Messaging**: End-to-end encrypted conversations
- **Encrypted Media Upload**: Share images and videos in chat
- **Responsive Design**: Works seamlessly on desktop and mobile
- **Rich Text**: Support for markdown formatting and emojis

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
NOSPEAK_ROBOHASH_BASE_URL=https://robohash.org
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
      NOSPEAK_ROBOHASH_BASE_URL: "https://robohash.org"
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
