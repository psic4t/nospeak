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

Create `.env` file for local development:

```env
# Optional: Custom relay configuration
NOSTR_RELAYS=wss://relay1.nostr.org,wss://relay2.nostr.org
```

### Relay Configuration

Default relays are configured, but users can add custom relays in settings. The app automatically:

- Connects to multiple relays for redundancy
- Handles connection failures with retry logic
- Manages subscription optimization

## Security

### Encryption

- All messages are end-to-end encrypted using Nostr's NIP-04
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
- **NIP-05**: Mapping Nostr keys to DNS-based internet identifiers
- **NIP-17**: Private Direct Messages 
- **NIP-19**: bech32-encoded entities for keys and identifiers

### Metadata & Profiles
- **NIP-40**: Reaction events for emoji responses

### Content & Media
- **NIP-44**: Encrypted Payloads
- **NIP-59**: Gift wrapper events for media sharing

### Advanced Features
- **NIP-07**: Windowed messages for rate limiting

## Support

- 🐛 [Issues](https://github.com/psic4t/nospeak/issues)

## License

GPL v3 License - see [LICENSE](LICENSE) file for details.

