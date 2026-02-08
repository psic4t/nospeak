## Context

MessageContent.svelte renders message text by splitting on a URL regex, rendering URLs as media/links and text segments via `{@html parseMarkdown(text)}`. There is no detection of Nostr entity references (`npub1...`, `nostr:npub1...`). ProfileModal loads profiles only from IndexedDB cache and does not fetch from relays. The existing `addContactByNpub()` function in ContactService handles the full add-and-sync flow.

## Goals / Non-Goals

**Goals:**
- Detect and render npub references as clickable inline mentions in message bubbles
- Show resolved display names from cache, with truncated npub as fallback
- Open ProfileModal on click with on-demand relay-based profile fetching
- Allow adding unknown users to contacts directly from ProfileModal

**Non-Goals:**
- Detecting `nprofile`, `nevent`, `naddr`, or other NIP-19 entity types (future work)
- Pre-fetching profiles during message rendering (deferred to modal open)
- Rendering mentions differently for own contacts vs unknown users
- Editing/composing mentions in the message input

## Decisions

### 1. Render npub mentions as `<a>` tags via the existing `{@html}` pipeline

Apply an npub regex replacement step inside the text rendering flow (after markdown parsing, before highlight). Matched npubs are replaced with `<a data-npub="npub1..." class="npub-mention" href="#">@displayName</a>`. A single event-delegation click handler on the MessageContent container intercepts clicks on `[data-npub]` elements and calls `openProfileModal(npub)`.

**Alternatives considered:**
- Split text into sub-arrays and render npub segments as `<button>` Svelte components: Rejected because it requires restructuring the template's `{#each}` loop and complicates the rendering pipeline for a simple link.
- Use a Svelte action on the container: Equivalent but event delegation via `onclick` is simpler and idiomatic.

### 2. Build a reactive display-name lookup map from profile cache

Extract all unique npubs from `content` (derived). Perform async `profileRepo.getProfileIgnoreTTL()` lookups and store results in a `$state` map (`Map<string, string>`). The HTML output is derived from this map — when cache results arrive, the derived HTML re-renders with display names replacing truncated npubs.

**Alternatives considered:**
- Synchronous cache lookup during regex replacement: Rejected because IndexedDB reads are async; cannot be called inside a string replacement function.
- No name resolution inline, always show truncated npub: Rejected because cached names are available for contacts and recently viewed profiles — showing them improves UX with no network cost.

### 3. Fetch profile from relays in ProfileModal when cache is empty

Enhance `loadProfile()` to call `profileResolver.resolveProfile(npub, true)` when `profileRepo.getProfileIgnoreTTL()` returns undefined, then re-read cache. The existing loading skeleton covers the fetch delay.

**Alternatives considered:**
- Pre-fetch on viewport intersection in MessageContent: Rejected because it wastes bandwidth for mentions the user never interacts with.
- Add a separate "fetch" button in the modal: Rejected because automatic fetch is more seamless and the loading skeleton already communicates the wait.

### 4. Add "Add to contacts" button in ProfileModal

Show the button when `!isContact && !isOwnProfile && profile` is true. Call the existing `addContactByNpub()` which handles local DB insert + relay sync. Update `isContact` state to `true` after successful add to swap the button to a "Contact added" confirmation.

**Alternatives considered:**
- Navigate to ManageContactsModal instead: Rejected because it adds friction; the one-click add is self-contained and uses existing ContactService.

## Risks / Trade-offs

- **Regex false positives on partial npub-like strings** → Mitigate by validating with `nip19.decode()` before rendering as a mention; invalid decodes fall through as plain text.
- **Large number of unique npubs in a single message** → Unlikely in practice; cap the lookup map to first 20 unique npubs to bound async work.
- **Profile fetch timeout in modal** → ProfileResolver already has a 3-second timeout; the loading skeleton handles the UX.
- **Display name XSS via profile metadata** → The display name inserted into `{@html}` must be HTML-escaped. Use a simple escape function before inserting into the `<a>` tag content.
