## Why

Messages in Nostr can contain references to other users via `nostr:npub1...` URIs or bare `npub1...` strings, but nospeak currently renders these as raw text. Users cannot identify who is being mentioned or interact with these references, making the messaging experience incomplete compared to other Nostr clients.

## What Changes

- Detect `nostr:npub1...` and bare `npub1...` patterns in message content and render them as clickable inline mentions showing the user's display name (or truncated npub as fallback)
- Clicking a mention opens the existing ProfileModal, which is enhanced to fetch profiles from relays when not cached locally
- ProfileModal gains an "Add to contacts" button for users not yet in the contact list
- Add i18n keys for the new UI elements across all supported locales

## Capabilities

### New Capabilities

- `npub-mentions`: Detection, resolution, and rendering of npub references within message content as interactive inline mentions

### Modified Capabilities

- `contacts`: ProfileModal enhanced with relay-based profile fetching when cache is empty, and an "Add to contacts" button for non-contact profiles

## Impact

- Affected specs: `npub-mentions` (new), `contacts` (modified)
- Affected code: `MessageContent.svelte` (content rendering pipeline), `ProfileModal.svelte` (profile loading and contact actions), i18n locale files
- No database schema changes
- No new dependencies (uses existing `nostr-tools` nip19, `profileResolver`, `profileRepo`, `addContactByNpub`)
