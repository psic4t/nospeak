## 1. Database Layer

- [x] 1.1 Add `ArchiveItem` interface to `src/lib/db/db.ts`
- [x] 1.2 Add `archives` table to Dexie schema (version 12 migration)
- [x] 1.3 Create `src/lib/db/ArchiveRepository.ts` with CRUD operations
- [x] 1.4 Export `archiveRepo` singleton from repository

## 2. Sync Service

- [x] 2.1 Create `src/lib/core/ArchiveSyncService.ts` following FavoriteSyncService pattern
- [x] 2.2 Implement `publishArchives()` method
- [x] 2.3 Implement `fetchAndMergeArchives()` method with union merge
- [x] 2.4 Export `archiveSyncService` singleton

## 3. Reactive Store

- [x] 3.1 Create `src/lib/stores/archive.ts` with `archivedConversationIds` writable store
- [x] 3.2 Implement `loadArchives()` function
- [x] 3.3 Implement `toggleArchive()` function
- [x] 3.4 Add store initialization to app startup

## 4. Context Menu Component

- [x] 4.1 Create `src/lib/components/ChatContextMenu.svelte`
- [x] 4.2 Implement portal and reposition actions
- [x] 4.3 Add Archive/Unarchive action button
- [x] 4.4 Style with existing design system (backdrop-blur, rounded, etc.)

## 5. ChatList Integration

- [x] 5.1 Import archive store and context menu in ChatList.svelte
- [x] 5.2 Add 3-dot menu button (desktop) with hover visibility
- [x] 5.3 Implement long-press handler (mobile, 500ms)
- [x] 5.4 Filter out archived conversations from filteredChatItems
- [x] 5.5 Add "Archive" to filter tabs (All | Unread | Groups | Archive)
- [x] 5.6 Show archive count badge when filter='all'
- [x] 5.7 Handle archive/unarchive actions via context menu

## 6. Archive Page

- [x] 6.1 Create `src/routes/chat/archive/+page.svelte`
- [x] 6.2 Query and display only archived conversations
- [x] 6.3 Implement context menu for unarchiving
- [x] 6.4 Add empty state when no archived chats
- [x] 6.5 Add header with back button and archive icon
- [x] 6.6 Show unread indicators on archived chats

## 7. Translations

- [x] 7.1 Add translation keys to `src/lib/i18n/locales/en.ts`
  - `chats.archive`
  - `chats.unarchive`
  - `chats.emptyArchive`
  - `chats.archived`
- [x] 7.2 Add same keys to other locale files (de, es, fr, it, pt)

## 8. Testing & Validation

- [x] 8.1 Run `npm run check` for TypeScript validation
- [x] 8.2 Run `npx vitest run` for test suite
- [x] 8.3 Test archive/unarchive flow manually
- [x] 8.4 Verify archive sync across simulated devices
- [x] 8.5 Test mobile long-press and desktop 3-dot menu
- [x] 8.6 Verify archived chats don't appear in All/Unread/Groups tabs
