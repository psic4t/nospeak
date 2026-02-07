## 1. Database Layer

- [x] 1.1 Add `FavoriteItem` interface to `src/lib/db/db.ts` with fields: `eventId` (string), `conversationId` (string), `createdAt` (number)
- [x] 1.2 Add `favorites` table declaration to `NospeakDB` class in `src/lib/db/db.ts`
- [x] 1.3 Add schema version 11 with `favorites: 'eventId, conversationId, createdAt'` index definition

## 2. Repository

- [x] 2.1 Create `src/lib/db/FavoriteRepository.ts` with `FavoriteRepository` class following `ContactRepository` pattern
- [x] 2.2 Implement `addFavorite(eventId, conversationId)`, `removeFavorite(eventId)`, `isFavorite(eventId)`, `getFavorites()`, `getFavoriteEventIds()` methods
- [x] 2.3 Export singleton `favoriteRepo`

## 3. Sync Service

- [x] 3.1 Create `src/lib/core/FavoriteSyncService.ts` following `ContactSyncService` pattern with `D_TAG = 'dm-favorites'` and `KIND_FOLLOW_SET = 30000`
- [x] 3.2 Implement `publishFavorites()` — encrypt local favorites as `[["e", "<eventId>", "<conversationId>"], ...]` using NIP-44 self-encryption and publish to all relays
- [x] 3.3 Implement `fetchAndMergeFavorites()` — fetch Kind 30000 `dm-favorites` from relays, decrypt, parse `e` tags, and union-merge into local DB
- [x] 3.4 Implement private `fetchLatestEvent(filter)` helper (reuse pattern from `ContactSyncService`)
- [x] 3.5 Export singleton `favoriteSyncService`

## 4. Reactive Store

- [x] 4.1 Create `src/lib/stores/favorites.ts` with a writable store holding a `Set<string>` of favorited eventIds
- [x] 4.2 Implement `loadFavorites()` to populate the store from IndexedDB on startup
- [x] 4.3 Implement `toggleFavorite(eventId, conversationId)` — add/remove from DB, update store, fire-and-forget `publishFavorites()`

## 5. Context Menu

- [x] 5.1 Add `onFavorite` callback and `isFavorited` boolean props to `src/lib/components/ContextMenu.svelte`
- [x] 5.2 Add Favorite/Unfavorite toggle button after Copy button in the context menu template

## 6. ChatView Integration

- [x] 6.1 Import favorites store in `src/lib/components/ChatView.svelte`
- [x] 6.2 Add `handleFavorite()` function that calls `toggleFavorite()` with the context menu message's eventId and conversationId
- [x] 6.3 Pass `onFavorite` and `isFavorited` props to `<ContextMenu>` component
- [x] 6.4 Add star icon badge overlay (absolute positioned, top-right) on message bubbles where `$favoriteEventIds.has(msg.eventId)` is true
- [x] 6.5 Support `highlight` query parameter to scroll to and highlight a specific message by eventId

## 7. ChatList Integration

- [x] 7.1 Import favorites store and repository in `src/lib/components/ChatList.svelte`
- [x] 7.2 Add reactive `favoritesCount` state using `liveQuery` on the favorites table
- [x] 7.3 Render Favorites entry at top of chat list (before `{#each filteredChatItems}`) when `favoritesCount > 0` — star icon avatar, "Favorites" label, message count subtitle
- [x] 7.4 Wire up click handler to navigate to `/favorites`

## 8. Favorites Route

- [x] 8.1 Create `src/routes/favorites/+page.svelte` with back button and page header
- [x] 8.2 Load all favorites from DB and join with messages table to get full message data
- [x] 8.3 Group favorites by conversationId and resolve conversation/contact names for section headers
- [x] 8.4 Render each favorite as a tappable card with message preview, sender info, and timestamp
- [x] 8.5 Navigate to `/chat/<conversationId>?highlight=<eventId>` on tap

## 9. Sync Integration

- [x] 9.1 Add `fetchAndMergeFavorites()` call in `src/lib/core/AuthService.ts` after contact sync during login flow
- [x] 9.2 Add `fetchAndMergeFavorites()` call in `src/routes/+layout.svelte` alongside contact sync in delayed refresh
- [x] 9.3 Add `fetchAndMergeFavorites()` call in `src/lib/components/ProfileModal.svelte` alongside contact sync on own profile refresh
- [x] 9.4 Call `loadFavorites()` on app startup to populate the reactive store

## 10. Internationalization

- [x] 10.1 Add English i18n strings to `src/lib/i18n/locales/en.ts`: `chat.contextMenu.favorite`, `chat.contextMenu.unfavorite`, `chats.favorites`, `chats.favoriteMessage`, `chats.favoriteMessages`, `chats.emptyFavorites`
- [x] 10.2 Add German i18n strings to `src/lib/i18n/locales/de.ts`: matching keys with German translations

## 11. Validation

- [x] 11.1 Run `npm run check` and fix any type errors
- [x] 11.2 Run `npx vitest run` and fix any test failures
