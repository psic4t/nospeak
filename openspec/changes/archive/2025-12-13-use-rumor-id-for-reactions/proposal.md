# Change: Use Rumor ID for Reaction Targeting

## Why
The previous implementation of message reactions used the NIP-17 Gift Wrap event ID as the target for NIP-25 reactions. This caused a synchronization issue because the sender and recipient see different Gift Wrap events (one wrapped for the recipient, one "self-wrapped" for the sender) for the same logical message. As a result, reactions sent by a partner target an ID that does not match the ID stored by the sender, preventing reactions from appearing on the sender's device.

## What Changes
- **Canonical ID**: Switch from using the Gift Wrap ID to using the **Rumor ID** (the hash of the inner Kind 14 event) as the canonical identifier for messages.
- **Database**: Add a `rumorId` field to the `Message` table in IndexedDB to store this stable identifier.
- **Messaging Core**:
  - Calculate and store the `rumorId` when creating/sending messages.
  - Calculate and store the `rumorId` when decrypting/receiving messages.
  - Update reaction sending logic to target the `rumorId` in the NIP-25 `e` tag.
  - Update reaction processing logic to associate incoming reactions with the `rumorId`.
- **UI**: Update the chat view and reaction components to key reactions off the `rumorId`.

## Impact
- **Reliability**: Reactions will correctly appear on messages regardless of who sent them or which device is viewing them, as the Rumor ID is derived deterministically from the shared message content.
- **Migration**: Existing cached messages in IndexedDB will not have a `rumorId` until they are re-fetched or a migration script runs. For simplicity, we will focus on new messages working correctly; existing messages may need a re-sync to support reactions.
