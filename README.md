# Nospeak

A decentralized Nostr chat client for secure, private messaging built with SvelteKit.

## Features

- 🚀 **Decentralized Chat**: Connect directly to Nostr relays without central servers
- 🔐 **Private Messaging**: End-to-end encrypted conversations
- 👤 **Profile Management**: Nostr native profile system with metadata
- 📱 **Responsive Design**: Works seamlessly on desktop and mobile
- 🖼️ **Media Upload**: Share images and videos in chat
- 🎨 **Dark Mode**: Built-in dark/light theme support
- 📝 **Rich Text**: Support for markdown formatting and emojis
- 🔗 **Universal URLs**: Media files accessible across Nostr clients

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

The application will be available at `http://localhost:5173`.

## Development

### Available Scripts

```bash
# Start development server with hot reload
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run type checking and linting
npm run check

# Run tests
npm run vitest
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

## Media Upload

Nospeak supports uploading images and videos to enhance chat conversations:

### Supported Formats

**Images**: JPEG, PNG, GIF, WebP (max 10MB)
**Videos**: MP4, WebM, MOV (max 50MB)

### How It Works

1. Click the upload button (📎) next to message input
2. Select "Image" or "Video" from dropdown
3. Choose file from your device
4. File uploads with progress indicator
5. Full URL inserted into message (works in any Nostr client)
6. Media displays inline in chat bubbles

### File Storage

- Files stored with UUID names in `static/user_media/`
- Served via full URLs for cross-client compatibility
- Automatic cleanup and optimization in production

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
- Automatic cleanup of old cache data

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

## Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Development Guidelines

- Follow TypeScript strict mode
- Use 4-space indentation
- Write tests for new features
- Keep components small and focused
- Follow existing code patterns

## Nostr Integration

Nospeak Web implements the following NIPs (Nostr Implementation Proposals):

### Core Protocol
- **NIP-01**: Basic protocol flow and event structure
- **NIP-05**: Mapping Nostr keys to DNS-based internet identifiers (nip05)
- **NIP-19**: bech32-encoded entities for keys and identifiers

### Metadata & Profiles
- **NIP-28**: Relay list metadata for server discovery
- **NIP-40**: Reaction events for emoji responses

### Content & Media
- **NIP-44**: Outbox model for draft message management
- **NIP-59**: Gift wrapper events for media sharing
- **NIP-65**: Relay list filtering and management

### Advanced Features
- **NIP-07**: Windowed messages for rate limiting
- **NIP-09**: Event delegation for key management
- **NIP-26**: Parameterized replaceable events

## Support

- 🐛 [Issues](https://github.com/psic4t/nospeak/issues)

## License

GPL v3 License - see [LICENSE](LICENSE) file for details.

