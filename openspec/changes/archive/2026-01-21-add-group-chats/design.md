# Design: Small Group Chats (NIP-17)

## Context

NIP-17 defines how to implement group chats in Nostr using multiple `p` tags. The current nospeak architecture treats all conversations as 1-on-1 chats identified by a single `recipientNpub`. This design document outlines how to extend the system to support group conversations while maintaining backward compatibility.

**Constraints:**
- Must comply with NIP-17 specification
- Must maintain backward compatibility with existing 1-on-1 chats
- Should not require migration of existing message data
- Group size limited to ~100 participants per NIP-17 recommendation

## Goals / Non-Goals

**Goals:**
- Support creating and participating in group chats with 2+ other participants
- Deterministic conversation identification that works across clients
- Clean UI for group creation with contact multi-select
- Display group chats distinctly from 1-on-1 chats in ChatList

**Non-Goals:**
- Group administration (invites, bans, admins) - NIP-17 explicitly has no moderation
- Participant addition/removal after creation (creates new conversation per NIP-17)
- Group subject/title editing (will be added in future change)
- Large group optimization (>100 participants)

## Decisions

### Decision 1: Conversation ID Derivation

**Approach:** Derive `conversationId` from SHA-256 hash of sorted participant pubkeys (hex format, including self), truncated to 16 characters.

**Rationale:**
- Deterministic: Any client can derive the same ID from the same participant set
- Collision-resistant: 16 hex chars = 64 bits, sufficient for practical use
- No external state: Doesn't rely on subject tags or external identifiers
- Backward compatible: 1-on-1 chats continue using npub as conversationId

**Algorithm:**
```typescript
function deriveConversationId(participantPubkeys: string[]): string {
    // participantPubkeys are hex pubkeys, including self
    const sorted = [...participantPubkeys].sort();
    const concatenated = sorted.join('');
    const hash = sha256(concatenated);
    return hash.slice(0, 16);
}
```

**Alternatives considered:**
- Subject-based ID: Rejected because subject is optional and mutable
- Random UUID: Rejected because not deterministic across clients
- Full hash: Rejected because URL length concerns

### Decision 2: Message Schema Extension

**Approach:** Add optional fields to existing Message interface rather than creating separate table.

```typescript
interface Message {
    // Existing fields...
    recipientNpub: string;  // Keep for backward compatibility
    
    // New fields
    conversationId: string;     // npub for 1-on-1, hash for groups
    participants?: string[];    // null for 1-on-1, array of npubs for groups
}
```

**Rationale:**
- Minimal schema change
- Existing queries continue to work via recipientNpub
- New group queries use conversationId index
- participants array enables group-specific UI

### Decision 3: Route Structure

**Approach:** Keep `/chat/[npub]` route but handle both npub and conversationId formats.

**Detection logic:**
- If parameter starts with `npub1` → 1-on-1 chat
- Otherwise → group chat (lookup conversation by hash)

**Rationale:**
- No breaking changes to existing URLs
- Group URLs are shorter and don't expose participant pubkeys
- Easy to distinguish programmatically

### Decision 4: Gift-Wrap Distribution

**Approach:** Send individual gift-wrap to each participant (including self), all wrapping the same rumor with all p-tags.

Per NIP-17:
```
rumor.tags = [
    ['p', participant1_pubkey],
    ['p', participant2_pubkey],
    ['p', participant3_pubkey],
    ['subject', 'Group Title']  // on first message only
]
```

Each participant receives their own gift-wrap addressed to their pubkey.

**Rationale:**
- NIP-17 compliant
- Each participant can decrypt independently
- No shared secrets required

### Decision 5: Initial Group Title

**Approach:** Auto-generate title from participant names, truncated to 50 characters.

Format: `"Alice, Bob, Carol"` or `"Alice, Bob, +3 more"` if too long.

**Rationale:**
- Immediate context without user input
- Consistent with other messaging apps
- Can be changed later (future feature)

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Performance with many participants | Limit to 10 participants initially; warn at >5 |
| Gift-wrap creation is O(n) per message | Acceptable for small groups; document limitation |
| Conversation ID collision | 64-bit hash space is sufficient; monitor in practice |
| Participant removal confusion | Document that removal = new conversation per NIP-17 |

## Migration Plan

**Phase 1: Schema (non-breaking)**
- Add `conversationId` field with migration that copies `recipientNpub` for existing messages
- Add `participants` field as optional (null for existing messages)
- Add database index on `conversationId`

**Phase 2: Core Logic**
- Update message receiving to detect group messages (multiple p-tags)
- Update message sending with group support
- Both old and new messages work seamlessly

**Phase 3: UI**
- Add group creation modal
- Update ChatList to show groups
- Update ChatView header for groups

**Rollback:** Remove UI components; core logic remains backward compatible.

## Open Questions

1. ~~Should group chat route use hash or encoded participants?~~ **Resolved: Use 16-char hash**
2. Should we limit initial group size? **Recommendation: Limit to 10 for MVP**
3. How should we handle subject tag updates? **Deferred to future change**
