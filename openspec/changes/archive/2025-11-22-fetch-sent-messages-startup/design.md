# Design: Fetch Sent Messages on Startup

## Context
Users report missing sent messages when starting with a fresh cache. `nospeak` currently uses NIP-59 (Gift Wrap) for messaging, which uses ephemeral keys. NIP-59 messages sent to others cannot be decrypted by the sender later because the sender does not retain the ephemeral private key used for encryption.

## Goals
- Ensure users can recover their sent message history on new devices or after cache clears.
- maintain compliance with NIP-59 privacy standards.

## Decisions
- **Send to Self**: We will modify `SendChatMessage` to create *two* gift wraps for every message:
    1. One for the recipient (as currently done).
    2. One for the sender (self-DM).
    - This approach is the standard way to maintain history in NIP-59 (often called "outbox" or "sent" folder simulation).
- **Fetch Strategy**:
    - **Kind 1059 (Self)**: Query where `pubkey` = user AND `p` tag = user. (Recoverable).
    - **Kind 1059 (Others)**: Cannot be recovered. We accept this limitation for *past* messages sent before this change, but fix it for *future* messages.

## Risks / Trade-offs
- **Storage/Bandwidth**: Doubles the number of events published (one for recipient, one for self). This is a known trade-off for NIP-59 history.
- **Migration**: Old NIP-59 messages sent before this change will remain unrecoverable.

## Open Questions
- Should we backfill/migrate old messages? (No, impossible without local cache).
