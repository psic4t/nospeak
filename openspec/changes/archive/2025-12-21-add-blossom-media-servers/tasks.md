## 1. Specification
- [x] 1.1 Add `settings` spec delta for Media Servers category
- [x] 1.2 Add `messaging` spec delta for configurable upload backend
- [x] 1.3 Add `android-app-shell` spec delta for Android upload semantics

## 2. Data model + discovery
- [x] 2.1 Extend Profile DB schema to store `mediaServers`
- [x] 2.2 Parse/cache `kind:10063` server list during profile resolution

## 3. Settings: Media Servers
- [x] 3.1 Add new Settings category UI: list/add/remove server URLs
- [x] 3.2 Persist upload backend toggle per device
- [x] 3.3 Disable Blossom toggle when server list empty
- [x] 3.4 Publish updated `kind:10063` on save (same relay fanout as messaging relays)

## 4. Blossom upload client
- [x] 4.1 Implement Blossom auth event builder (kind 24242)
- [x] 4.2 Implement Blossom `PUT /upload` (raw body) and descriptor parsing
- [x] 4.3 Implement failover + best-effort mirroring to all configured servers

## 5. Integrate upload backend selection
- [x] 5.1 Route profile picture/banner uploads through upload backend chooser
- [x] 5.2 Route chat attachment uploads through upload backend chooser

## 6. Validation
- [x] 6.1 Add i18n strings (EN/DE) for Media Servers
- [x] 6.2 Add unit tests for parsing `kind:10063` and Blossom auth construction
- [x] 6.3 Run `npm run check`
- [x] 6.4 Run `npx vitest run`
