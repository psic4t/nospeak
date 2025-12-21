# Change: Add Blossom Media Servers for Uploads

## Why
Users want control over where their media files are hosted and the ability to use Nostr-native “Blossom” media servers instead of nospeak’s built-in media storage. This improves interoperability with the broader Nostr ecosystem and enables users to choose their preferred hosting providers.

## What Changes
- Add a new Settings category: **Media Servers**.
- Fetch and cache the user’s Blossom server list from Nostr (`kind:10063`) and allow editing (add/remove) with the same interaction model as Messaging Relays.
- Publish updated Blossom server lists as replaceable `kind:10063` events.
- Add a Settings switch to select the upload backend:
  - Use local nospeak file storage (current behavior)
  - Use Blossom servers (new behavior)
- When Blossom mode is enabled, uploads:
  - MUST upload to at least the first configured server
  - SHOULD also upload/mirror to remaining configured servers (best-effort)
  - MUST use Blossom authorization events (kind `24242`) and endpoint semantics (`PUT /upload`) per BUD-01/BUD-02/BUD-03.
- The Blossom mode switch is disabled (greyed out) when no servers are configured.

## Impact
- Affected specs:
  - `settings` (new Media Servers category + upload backend toggle)
  - `messaging` (media upload destination is configurable)
  - `android-app-shell` (Android upload/camera capture requirements depend on selected upload backend)
- Affected code (anticipated):
  - Settings UI: `src/lib/components/SettingsModal.svelte`
  - Profile discovery/cache: `src/lib/core/ProfileResolver.ts`, `src/lib/db/ProfileRepository.ts`, `src/lib/db/db.ts`
  - Upload callers: `src/lib/components/MediaUploadButton.svelte`, `src/lib/core/Messaging.ts`
  - New Blossom upload/auth helpers under `src/lib/core/`.
