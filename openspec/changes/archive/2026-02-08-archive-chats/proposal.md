## Why

Users need a way to declutter their chat list without deleting conversations. Currently, all chats remain visible in the main list indefinitely. An archive feature allows users to hide inactive conversations while preserving message history, similar to how favorites work but for the opposite use case—hiding rather than highlighting.

## What Changes

- **New encrypted list `dm-archive`**: Store archived conversation IDs as encrypted Kind 30000 events (same pattern as `dm-contacts` and `dm-favorites`)
- **Chat context menu**: Add long-press (mobile) and 3-dot menu (desktop) interaction to chat list items
- **Archive action**: First option in context menu archives/unarchives the chat
- **Archive visibility**: Archived chats are filtered from the main chat list
- **Archive tab**: New "Archive" tab in chat list filter tabs (All/Unread/Groups/Archive)
- **Archive page**: Dedicated page at `/chat/archive` to view and unarchive conversations
- **Sync integration**: Archive state syncs across devices via Nostr relays

## Capabilities

### New Capabilities

- **chat-archiving**: Core archive functionality including repository, sync service, store, and UI components for archiving conversations

### Modified Capabilities

- **chat-list**: Update to filter out archived chats from default view and add Archive tab to filter options

## Impact

- **Database**: New `archives` table added to Dexie schema (version 12 migration)
- **Sync Services**: New `ArchiveSyncService` following the pattern of `FavoriteSyncService`
- **Stores**: New `archive` store for reactive archive state management
- **Components**: New `ChatContextMenu` component for chat list interactions; updates to `ChatList.svelte`
- **Routes**: New `/chat/archive/+page.svelte` route for viewing archived chats
- **i18n**: New translation keys for archive-related UI text in all locale files
- **Dependencies**: No new external dependencies; leverages existing Nostr/NIP-44 encryption infrastructure
