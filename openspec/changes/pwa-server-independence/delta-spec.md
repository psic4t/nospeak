# Delta Specification: PWA Server Independence

## Overview
This change modifies the existing runtime configuration and PWA architecture to support server-independent operation.

## Changes to Existing Specifications

### Messaging Specification
No changes required. All messaging functionality is already client-side via Nostr relays and IndexedDB.

### URL Preview Specification
**Current behavior**: URL previews fetched from `/api/url-preview` endpoint  
**New behavior**: Same, but with graceful degradation when server unavailable

**Delta**:
- Add requirement: Preview requests fail silently without user-facing errors
- Preview card simply not shown when server unavailable
- Original URL remains clickable

### Runtime Configuration
**Current behavior**: Fetched from `/api/runtime-config` on app startup  
**New behavior**: Baked into client bundle at build time

**Delta**:
- Remove: `initRuntimeConfig()` call in layout
- Remove: Runtime config server endpoint dependency
- Add: Build-time configuration injection via Vite define
- Add: Default configuration exported from client-side module

## Implementation Areas

### 1. Build Configuration (svelte.config.js)
**Current**:
```javascript
adapter: isAndroid 
  ? staticAdapter({...})
  : nodeAdapter({...})
```

**New**:
```javascript
adapter: staticAdapter({
  pages: 'build',
  assets: 'build',
  fallback: 'index.html',
  precompress: false,
  strict: true
})
```

### 2. Runtime Config Module
**Current**: `/api/runtime-config` endpoint serves dynamic config  
**New**: Static defaults baked into client

**Files to modify**:
- `src/lib/core/runtimeConfig/index.ts` - Export baked config
- `src/routes/+layout.svelte` - Remove initRuntimeConfig call

### 3. Service Worker
**Current**: Only precaches build assets  
**New**: Add navigation fallback handler

**Files to modify**:
- `src/service-worker.ts` - Add setCatchHandler for navigation

### 4. URL Preview
**Current**: Fetches from `/api/url-preview` endpoint served by adapter-node  
**New**: Fetches from `/api/url-preview` served by Express server (hybrid architecture)

**Delta**:
- Create: `server.js` - Express server serving static files + API
- Update: `Dockerfile` - Run Express server instead of SvelteKit node server
- Add: Express to production dependencies
- Graceful degradation remains: fails silently when server unavailable

**Files to modify**:
- `src/lib/components/MessageContent.svelte` - Wrap preview fetch in try-catch (already done)
- `src/lib/core/UrlPreviewApi.ts` - Handle fetch errors gracefully (already done)
- `server.js` - Create new Express server
- `package.json` - Add express to dependencies
- `Dockerfile` - Update to run server.js

### 5. Server Architecture (New)
**Current**: Single SvelteKit node adapter handles everything  
**New**: Hybrid architecture - static PWA + Express API server

**Architecture**:
```
Docker Container
├── Express Server (server.js)
│   ├── GET /api/url-preview → Fetches URL metadata
│   ├── GET /health → Health check
│   └── * → Serves static files from build/ + SPA fallback
└── Static Files (build/)
    ├── index.html (PWA shell)
    ├── _app/ (JS/CSS assets)
    └── service-worker.js (offline support)
```

**Benefits**:
- PWA works independently (can be cached and run offline)
- Server provides API endpoints when available
- Simple, single-container deployment
- Backward compatible with existing behavior

### 6. PWA Update Notifications (New)
**Current**: Service worker updates silently in background, user never notified  
**New**: Toast notification appears when update is available, user can click to reload

**Update Flow**:
```
1. New version deployed to server
2. Browser detects service worker change via precache manifest hash
3. New service worker installs in background
4. Application shows toast: "Update available - Click to reload"
5. User clicks toast → page reloads → new version active
6. If dismissed, toast reappears periodically until update applied
```

**Files to modify**:
- `src/routes/+layout.svelte` - Add `onNeedRefresh` callback to registerSW
- Uses existing `showToast()` function with persistent duration

## Dependencies
- `express` - Production dependency for API server

## Test Strategy
1. Build with new adapter - verify static files generated
2. Run Express server locally: `node server.js`
3. Test PWA loads at http://localhost:3000/
4. Test API endpoint: http://localhost:3000/api/url-preview?url=https://example.com
5. Test direct URL access: http://localhost:3000/chat/npub1... (should work via SPA fallback)
6. Stop server, reload page - verify PWA still works via service worker
7. Test Docker build and run
8. Verify graceful degradation: URL previews fail silently when offline
9. Simulate update: Deploy new version, verify toast appears, click reloads app
