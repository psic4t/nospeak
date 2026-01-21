# Change: Add Small Group Chats (NIP-17)

## Why

Users need the ability to communicate with multiple people in a single conversation. NIP-17 already supports group chats via multiple `p` tags in a single message rumor, but nospeak currently only handles 1-on-1 conversations. Adding group chat support enables collaborative messaging without requiring users to maintain separate conversations with each participant.

## What Changes

- **Database schema**: Add `conversationId` and `participants` fields to messages to support multi-recipient conversations
- **Messaging logic**: Handle multiple `p` tags when receiving messages; create gift-wraps for each participant when sending
- **Conversation routing**: Use deterministic hash of sorted participant pubkeys for group chat URLs (e.g., `/chat/abc123def456`)
- **Group creation UI**: Add "Create group chat" button to ManageContactsModal with multi-select contact picker
- **Chat display**: Update ChatList and ChatView to show group conversations with multiple avatars and participant-based titles
- **Auto-generated titles**: Initial group title derived from participant names (e.g., "Alice, Bob, Carol")

## Impact

- Affected specs: `messaging`, `contacts`
- Affected code:
  - `src/lib/db/db.ts` - Schema changes
  - `src/lib/db/MessageRepository.ts` - Query updates for conversationId
  - `src/lib/core/Messaging.ts` - Multi-recipient p-tag handling
  - `src/lib/components/ManageContactsModal.svelte` - Group creation button
  - `src/lib/components/ChatList.svelte` - Group display
  - `src/lib/components/ChatView.svelte` - Group header
  - `src/routes/chat/[npub]/+page.svelte` - Route handling for group IDs
  - New: `src/lib/components/CreateGroupChatModal.svelte`
  - New: `src/lib/components/GroupAvatar.svelte`
  - New: `src/lib/db/ConversationRepository.ts`
