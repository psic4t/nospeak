# Change: Separate Chats from Contacts

## Why

To prepare for future group chat support, the UI needs to clearly distinguish between **Chats** (active conversations) and **Contacts** (saved people). Currently, the sidebar displays contacts mixed with chat previews, and contacts are stored only locally. This change establishes a clean separation where:

1. The sidebar becomes "Chats" (conversations with recent activity)
2. Contacts become a separate concept managed via a modal, synced to Nostr using Kind 30000 encrypted follow sets
3. Users can have contacts they haven't chatted with yet, and chats from unknown senders

## What Changes

- **UI Rename**: Current "Contacts" sidebar becomes "Chats" (internally `chatList`)
- **Navigation**: "Manage" button removed from header; replaced with FAB (+) button in lower-right that opens contacts modal
- **Contacts Modal**: 
  - Clicking a contact opens/creates a chat with that contact (auto-closes modal)
  - "New Contact" button at top opens search/add mode
- **Contact Sync**: 
  - Contacts stored as Kind 30000 encrypted follow set with `d: "dm-contacts"`
  - Private storage using NIP-44 encryption (contacts encrypted in content field)
  - Published to messaging relays + discovery relays
  - Fetched on profile refresh and merged with local contacts (union merge)
- **Auto-add Contacts**: When messages arrive from unknown senders, contact is auto-added and sync is triggered

## Impact

- Affected specs:
  - `specs/contacts/spec.md` (NEW) - Contact management and sync
  - `specs/messaging/spec.md` - UI naming, auto-add behavior
- Affected code:
  - `src/lib/components/ContactList.svelte` → renamed to `ChatList.svelte`
  - `src/lib/components/ManageContactsModal.svelte` - click-to-chat behavior
  - `src/lib/core/ContactSyncService.ts` (NEW) - Kind 30000 sync
  - `src/lib/core/ContactService.ts` - integrate sync
  - `src/lib/core/Messaging.ts` - trigger sync on auto-add
  - `src/lib/core/ProfileResolver.ts` - fetch Kind 30000
  - `src/routes/chat/+layout.svelte` - update import
  - `src/lib/i18n/locales/*.ts` - translation updates
