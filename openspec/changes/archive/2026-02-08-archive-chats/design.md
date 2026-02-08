## Context

The nospeak app currently shows all chats in a single list without any organization beyond the All/Unread/Groups filter tabs. Users have requested a way to archive inactive conversations to declutter their main chat list while preserving message history.

The existing `dm-contacts` and `dm-favorites` implementations provide a proven pattern: encrypted Kind 30000 events with a d-tag identifier, storing data as encrypted JSON arrays. We will follow this exact pattern for consistency.

Current architecture:
- Database: Dexie/IndexedDB with versioned schema migrations
- Sync: Nostr Kind 30000 encrypted lists for cross-device sync
- UI: Svelte 5 with reactive stores and context menus
- Icons: Custom SVG following existing patterns (star for favorites, etc.)

## Goals / Non-Goals

**Goals:**
- Allow users to archive conversations to hide them from main list
- Provide context menu access (long-press mobile, 3-dot desktop)
- Sync archive state across devices via Nostr relays
- Show archived chats in dedicated Archive tab/filter
- Support unarchiving from archive view

**Non-Goals:**
- Auto-archive based on inactivity (manual only)
- Archive expiration/deletion
- Nested archive folders
- Archive search/filtering beyond the existing pattern

## Decisions

### 1. Archive Storage Format

Store archived conversation IDs in the same format as favorites: encrypted Kind 30000 events with d-tag `dm-archive`.

**Rationale:**
- Consistency with existing patterns reduces cognitive load
- Reuses proven sync infrastructure
- Same encryption/security model

**Storage format:** `["e", "<conversationId>"]` tags in encrypted JSON array

### 2. Context Menu Interaction Model

Implement a dedicated `ChatContextMenu.svelte` component following the pattern of `ContextMenu.svelte` (used for messages) and `ContactContextMenu.svelte`.

**Rationale:**
- Consistent UX across the app
- Separates concerns (chat actions vs message actions)
- Allows future expansion (mute, pin, etc.)

**Mobile:** Long-press (500ms) triggers menu
**Desktop:** 3-dot menu button on hover/focus

### 3. Archive Tab Position

Add Archive as the fourth tab: All | Unread | Groups | Archive

**Rationale:**
- Logical grouping (main views → special views)
- Archive is mutually exclusive with other filters
- Count badge indicates archived items exist

### 4. Archive Page Design

Create `/chat/archive/+page.svelte` following the favorites page pattern.

**Rationale:**
- Consistent navigation pattern
- Reuses existing list styling
- Simple unarchive action via context menu

## Risks / Trade-offs

- **[Risk]** Archive state sync conflicts → **Mitigation:** Union merge strategy (same as favorites)
- **[Risk]** Accidental archive → **Mitigation:** Immediate unarchive from Archive tab; no confirmation dialog needed
- **[Trade-off]** Archived chats don't appear in All/Unread/Groups → **Rationale:** This is expected archive behavior

## Migration Plan

1. Database migration adds `archives` table (version 12)
2. Archive sync fetches on app startup (non-blocking)
3. Archive page lazy-loaded on navigation

## Open Questions

None - all decisions confirmed with user:
- Archived chats show unread indicators: YES
- Archive tab shows count badge: YES  
- Archive icon: Box/archive style
