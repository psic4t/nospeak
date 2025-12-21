## 1. Specification
- [x] 1.1 Update `settings` deltas to remove upload backend toggle
- [x] 1.2 Update `messaging` deltas for Blossom-only uploads + legacy placeholders
- [x] 1.3 Update `android-app-shell` deltas for Blossom-only uploads

## 2. UI
- [x] 2.1 Remove "Use Blossom servers" toggle from Settings → Media Servers
- [x] 2.2 Add an in-app info modal (QR-modal style) for auto-configured default servers

## 3. Upload behaviour
- [x] 3.1 Implement "ensure default Blossom servers" helper used by all upload entrypoints
- [x] 3.2 When uploading with no servers configured, set defaults and show info modal

## 4. Remove internal storage
- [x] 4.1 Remove `/api/upload` route and its unit tests
- [x] 4.2 Remove `/api/user_media/[filename]` and `/user_media/[filename]` routes
- [x] 4.3 Remove NIP-98 upload auth helper if unused

## 5. Rendering
- [x] 5.1 Render placeholder for `https://nospeak.chat/api/user_media/...` URLs

## 6. Validation
- [x] 6.1 Run `npm run check`
- [x] 6.2 Run `npx vitest run`
