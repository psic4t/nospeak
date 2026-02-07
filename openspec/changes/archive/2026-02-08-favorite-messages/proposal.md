## Why

Users need a way to save important messages for quick reference later. Currently there is no mechanism to bookmark or highlight individual messages across conversations, forcing users to scroll through chat history to find previously noted content.

## What Changes

- Add a "Favorite" / "Unfavorite" toggle button to the message context menu
- Store favorited message IDs in an encrypted `dm-favorites` Kind 30000 list (same pattern as `dm-contacts`)
- Display a star icon overlay (top-right corner) on favorited message bubbles
- Add a dedicated "Favorites" virtual entry at the top of the ChatList that navigates to `/favorites`
- Create a `/favorites` route showing all favorited messages grouped by conversation
- Clicking a favorited message navigates to the original conversation and scrolls to it
- Sync favorites to/from relays at the same points as contacts (login, delayed refresh, profile refresh)

## Capabilities

### New Capabilities
- `message-favorites` — Favoriting messages, encrypted relay sync, favorites view, and UI indicators

### Modified Capabilities
- `contacts` — Add favorites sync calls alongside existing contact sync points (login, delayed refresh, profile refresh)

## Impact

- Affected specs: `contacts` (sync integration points), new `message-favorites` spec
- Affected code:
  - New: `FavoriteRepository.ts`, `FavoriteSyncService.ts`, `favorites.ts` store, `/favorites` route
  - Modified: `db.ts` (schema v11), `ContextMenu.svelte`, `ChatView.svelte`, `ChatList.svelte`, `AuthService.ts`, `+layout.svelte`, `ProfileModal.svelte`, i18n locale files
- Database: New `favorites` table in IndexedDB (schema version 11)
- Relay traffic: Additional Kind 30000 event per user (minimal impact, same as contacts)
