## 1. Implementation
- [x] 1.1 Add a repository method to page older messages for a conversation strictly from IndexedDB using a timestamp cursor and page size.
- [x] 1.2 Update chat route (`src/routes/chat/[npub]/+page.svelte`) and `ChatView.svelte` to use the new repository method so that scroll-up first loads older messages from the local cache and only triggers relay history backfill when the user explicitly clicks a "Fetch older messages from relays" control once the cache reports no more local messages.
- [x] 1.3 Wire a clear decision point for when to call `messagingService.fetchOlderMessages` (only when the user clicks the explicit control and the previous backfill for this conversation did not already report "no more" results).
- [x] 1.4 Ensure existing first-time and background history sync flows remain unchanged and continue to populate the cache for all conversations.
- [x] 1.5 Add or update unit tests for `MessageRepository` pagination behavior and `MessagingService.fetchOlderMessages` integration, plus any Svelte-level tests if present for scroll-up behavior.

## 2. Validation
- [x] 2.1 Run `npm run check` to confirm type and Svelte checks pass.
- [x] 2.2 Run `npx vitest run` to confirm all tests pass, including any new or updated ones.
- [x] 2.3 Manually verify in a development environment that scrolling up pages purely from cached messages when available and only triggers additional network history fetch after the user clicks the explicit control, and that a "no more messages" status is shown once relays return no additional history.
