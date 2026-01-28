# PWA Server Independence

## Proposal
Make the nospeak PWA work independently from the nospeak.chat server by using static adapter instead of node adapter. This allows the installed PWA to function even when the server is unavailable, similar to the Android app.

## Motivation
Currently, the PWA uses `@sveltejs/adapter-node` which requires the server to render pages. When nospeak.chat is down, users cannot navigate to routes like `/chat` or `/contacts`. By switching to `adapter-static`, the PWA becomes a true standalone application.

## Scope
- Switch build adapter from node to static for default builds
- Bake runtime configuration into the client instead of fetching from `/api/runtime-config`
- Keep URL preview on server (graceful degradation when server unavailable)
- Add service worker navigation fallback for offline support
- Ensure all routes work without server-side rendering
- Add PWA update notifications to inform users when new version is available

## Non-Goals
- Background sync for messages (already works via retry queue)
- Offline message composition (separate concern)
- Runtime config override via environment variables (will use build-time defaults)
- Forced auto-reload without user consent

## Acceptance Criteria
1. PWA can be installed and runs without nospeak.chat server
2. All navigation works offline after initial load
3. URL previews work when server is available, silently fail when unavailable
4. Build process uses adapter-static by default
5. Android build continues to work with same configuration
6. PWA shows update notification when new version is available
7. Clicking update notification reloads the app to apply update
8. Update notification reappears periodically if user doesn't reload
