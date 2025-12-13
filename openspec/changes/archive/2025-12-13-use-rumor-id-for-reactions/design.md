## Context
The current implementation keys reactions off the `eventId` of the message stored in IndexedDB. For NIP-17 DMs, this `eventId` corresponds to the wrapping event (Kind 1059). Since the sender creates two wrappers (one for recipient, one for self), the IDs differ. NIP-25 reactions need a single stable ID to target so that both parties agree on which message is being reacted to.

## Design Decision: Rumor ID as Canonical Reference
We will use the hash of the inner Kind 14 "Rumor" event as the stable identifier.
- **Stability**: The Rumor event contains the actual message content, timestamp, and tags. This payload is encrypted but identical for both parties.
- **Calculation**: Since the Rumor is often unsigned in NIP-17, we will deterministically calculate its ID using `getEventHash` (from `nostr-tools`) upon encryption (sending) and decryption (receiving).
- **Storage**: We will add a `rumorId` column to the local `messages` table.
- **Reactions**: NIP-25 reactions will reference this `rumorId` in their `e` tag.

## Database Schema
Current `Message` interface:
```typescript
interface Message {
  id?: number;
  eventId: string; // Currently GiftWrap ID
  ...
}
```

New `Message` interface:
```typescript
interface Message {
  id?: number;
  eventId: string;
  rumorId: string; // New field: Hash of the inner Kind 14 event
  ...
}
```

## Migration Strategy
- **New Messages**: Will be saved with `rumorId` populated.
- **Old Messages**: Will have `rumorId` undefined.
  - Option A: Run a migration to decrypt all old messages and compute hash (Expensive, requires user unlock).
  - Option B: Leave as undefined. Reactions won't work on old messages until they are re-fetched during a "fresh sync" or we implement lazy backfill.
  - **Decision**: For this iteration, we accept that reactions will only work on new (or re-fetched) messages. This minimizes complexity and risk.

## Considerations
- **Relay Interoperability**: This follows standard practice where the "payload" ID is the logical target. Even though the payload isn't published directly, its hash is a globally unique derived identifier suitable for reactions.
