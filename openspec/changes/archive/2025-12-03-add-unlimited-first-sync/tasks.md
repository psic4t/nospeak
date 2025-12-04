## 1. Sync State Management
- [x] 1.1 Create `src/lib/stores/sync.ts` with writable store for sync state (`isSyncing`, `progress`, `isFirstSync`)

## 2. Messaging Service Changes
- [x] 2.1 Import sync state store in `Messaging.ts`
- [x] 2.2 Add method to check if DB is empty (first-time sync detection)
- [x] 2.3 Modify `fetchHistory()` to use unlimited batches on first sync, 1 batch otherwise
- [x] 2.4 Update `fetchMessages()` to report progress to sync state store after each batch
- [x] 2.5 Change `listenForMessages()` to use `since` filter (only new messages)

## 3. UI Components
- [x] 3.1 Create `src/lib/components/SyncProgressModal.svelte` for mobile blocking overlay
- [x] 3.2 Update `src/routes/chat/+page.svelte` to show progress in empty chat area (desktop)
- [x] 3.3 Update `src/routes/chat/+layout.svelte` to show modal overlay on mobile during first sync

## 4. Post-Sync Navigation
- [x] 4.1 Add auto-navigation to newest contact after first-time sync completes (desktop)

## 5. Validation
- [x] 5.1 Run `npm run check` to verify no type errors
- [x] 5.2 Run `npx vitest run` to ensure tests pass
- [ ] 5.3 Manual testing: clear IndexedDB, login, verify unlimited sync with progress
