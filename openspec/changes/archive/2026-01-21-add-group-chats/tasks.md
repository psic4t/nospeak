# Tasks: Add Small Group Chats (NIP-17)

## 1. Database Schema and Repository

- [x] 1.1 Add `conversationId` and `participants` fields to Message interface in `db.ts`
- [x] 1.2 Create database migration (version bump) to populate `conversationId` from `recipientNpub` for existing messages
- [x] 1.3 Add database index on `[conversationId+sentAt]` for efficient group queries
- [x] 1.4 Create `ConversationRepository.ts` with `Conversation` interface and CRUD operations
- [x] 1.5 Add `deriveConversationId()` helper function using SHA-256 hash of sorted pubkeys
- [x] 1.6 Write unit tests for `deriveConversationId()` function

## 2. Messaging Core Logic

- [x] 2.1 Update `handleGiftWrap()` in Messaging.ts to extract ALL p-tags from rumor
- [x] 2.2 Add `isGroupMessage()` helper to detect messages with multiple p-tags
- [x] 2.3 Update `createMessageFromRumor()` to set `conversationId` and `participants` for group messages
- [x] 2.4 Create `sendGroupMessage()` method that creates gift-wraps for each participant
- [x] 2.5 Update validation logic to accept multiple p-tags (not just first one)
- [x] 2.6 Handle `subject` tag parsing for group chat titles
- [x] 2.7 Write unit tests for multi-recipient message handling

## 3. Group Chat Creation UI

- [x] 3.1 Create `CreateGroupChatModal.svelte` with contact multi-select interface
- [x] 3.2 Add search/filter field for contacts in group creation modal
- [x] 3.3 Implement checkbox-based selection (desktop) and tap-to-toggle (mobile)
- [x] 3.4 Add "Create Group" button with validation (requires 2+ selected contacts)
- [x] 3.5 Generate auto-title from selected contact names (truncated to 50 chars)
- [x] 3.6 Add `showCreateGroupModal` to modals store
- [x] 3.7 Add "Create group chat" button to ManageContactsModal header
- [x] 3.8 Add i18n strings for group chat creation UI

## 4. Chat List and Navigation

- [x] 4.1 Create `GroupAvatar.svelte` component showing stacked participant avatars
- [x] 4.2 Update `ChatList.svelte` to detect and display group conversations
- [x] 4.3 Show group title (or auto-generated name) instead of single contact name
- [x] 4.4 Update route handler in `[npub]/+page.svelte` to detect group IDs (non-npub format)
- [x] 4.5 Load conversation metadata for group chats from ConversationRepository
- [x] 4.6 Navigate to new group chat after creation

## 5. Chat View Updates

- [x] 5.1 Update `ChatView.svelte` header to show group title and participant count
- [x] 5.2 Display GroupAvatar in chat header for group conversations
- [x] 5.3 Show sender name above each message in group chats
- [x] 5.4 Update message styling to accommodate sender attribution
- [x] 5.5 Add participant list view (tap on header to see members)

## 6. Testing and Validation

- [x] 6.1 Write integration tests for group chat creation flow
- [x] 6.2 Test message send/receive with 3+ participants
- [x] 6.3 Verify conversation ID is deterministic across sessions
- [x] 6.4 Test backward compatibility with existing 1-on-1 chats
- [x] 6.5 Run `npm run check` and fix any type errors
- [x] 6.6 Run `npx vitest run` and ensure all tests pass
