# Design: Separate Chats from Contacts

## Context

The current nospeak architecture treats contacts and chats as the same concept - the contact list sidebar shows contacts ordered by recent message activity. To support group chats in the future, we need to separate these concepts:

- **Contacts**: People the user has explicitly saved or who have messaged them
- **Chats**: Active conversations (currently 1:1, future: groups)

Additionally, contacts are currently stored only in local IndexedDB with no Nostr sync. This means contacts are lost when switching devices or clearing browser data.

## Goals

- Cleanly separate Chat UI from Contact management UI
- Sync contacts to Nostr using Kind 30000 encrypted follow sets
- Maintain backward compatibility with existing contact data
- Prepare architecture for future group chat support

## Non-Goals

- Implementing group chats (future work)
- Changing the underlying message storage or sync
- Supporting public contact lists (privacy-focused: encrypted only)

## Decisions

### 1. Kind 30000 with Private Content

**Decision**: Store contacts as encrypted content in Kind 30000 events, not as public `p` tags.

**Rationale**: 
- Privacy: Contact lists are sensitive information
- NIP-51 supports both public tags and encrypted content
- Encrypted content uses NIP-44 self-encryption (user encrypts to their own pubkey)

**Event Structure**:
```json
{
  "kind": 30000,
  "tags": [["d", "dm-contacts"]],
  "content": "<NIP-44 encrypted JSON: [[\"p\", \"<pubkey1>\"], [\"p\", \"<pubkey2>\"]]>",
  "created_at": <timestamp>
}
```

### 2. Union Merge Strategy

**Decision**: When syncing contacts, always union local and remote sets - never delete contacts.

**Rationale**:
- Prevents accidental contact loss
- Handles multi-device scenarios gracefully
- Simplest conflict resolution strategy

**Alternatives Considered**:
- Last-write-wins: Could lose contacts if timestamps are out of sync
- Remote-authoritative: Could lose locally-added contacts before sync completes

### 3. Immediate Sync on Add/Remove

**Decision**: Publish updated Kind 30000 event immediately when contacts change.

**Rationale**:
- Ensures contacts are backed up promptly
- Simplifies implementation (no batching logic)
- Network overhead is minimal (single event per change)

### 4. ChatList vs ContactList Naming

**Decision**: Rename component internally to `ChatList` while keeping external references clear.

**Rationale**:
- Reflects the actual purpose (showing chats, not just contacts)
- Prepares for group chats which are not contacts
- i18n label changes from "Contacts" to "Chats"

## Architecture

### Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                        UI Layer                             │
├────────────────┬────────────────┬───────────────────────────┤
│    ChatList    │ ManageContacts │      ChatView             │
│   (sidebar)    │    Modal       │    (messages)             │
└───────┬────────┴───────┬────────┴───────────┬───────────────┘
        │                │                    │
        ▼                ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│                    Service Layer                            │
├────────────────┬────────────────┬───────────────────────────┤
│ ContactService │ContactSyncSvc  │  MessagingService         │
│  (add/remove)  │ (Kind 30000)   │  (autoAddContact)         │
└───────┬────────┴───────┬────────┴───────────┬───────────────┘
        │                │                    │
        ▼                ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│              Repository Layer (IndexedDB)                   │
├─────────────────────────────────────────────────────────────┤
│      ContactRepository    │    MessageRepository            │
└───────────────────────────┴─────────────────────────────────┘
```

### ContactSyncService API

```typescript
class ContactSyncService {
  // Publish current contacts to relays
  async publishContacts(): Promise<void>;
  
  // Fetch Kind 30000 from relays and merge into local DB
  async fetchAndMergeContacts(): Promise<void>;
  
  // Internal: encrypt contact list using NIP-44
  private async encryptContacts(pubkeys: string[]): Promise<string>;
  
  // Internal: decrypt contact list from event content
  private async decryptContacts(content: string): Promise<string[]>;
}
```

### Sync Trigger Points

1. **On Contact Add**: `ContactService.addContactByNpub()` → `contactSyncService.publishContacts()`
2. **On Contact Remove**: `contactRepo.removeContact()` → `contactSyncService.publishContacts()`
3. **On Auto-Add (message from unknown)**: `Messaging.autoAddContact()` → `contactSyncService.publishContacts()`
4. **On Profile Refresh**: Layout.svelte delayed refresh → `contactSyncService.fetchAndMergeContacts()`

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| NIP-44 not supported by signer | Already required for NIP-17 messaging; all signers implement it |
| Large contact lists | Not a concern for typical use (<1000 contacts); can paginate later if needed |
| Network failures during publish | Silent failure acceptable; will sync on next publish |
| Concurrent edits (multi-device) | Union merge ensures no data loss |

## Migration Plan

1. Deploy code changes (no breaking changes to existing data)
2. Existing local contacts remain in IndexedDB
3. On first profile refresh after update, contacts are published to Kind 30000
4. New devices fetch Kind 30000 on login and merge with local

**Rollback**: No rollback needed - contacts remain in local DB regardless of sync status.

## Open Questions

None - all design decisions have been finalized based on user requirements.
