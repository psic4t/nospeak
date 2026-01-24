# Change: Unify message send pipeline for 1-on-1 and group chats

## Why
The `MessagingService` has 8 send functions (~1100 lines) that duplicate the same NIP-17/NIP-59 gift-wrap pipeline for each combination of message type (text, file, location, reaction) × recipient mode (1-on-1, group). Each function independently handles auth, relay discovery, temporary connections, gift-wrap creation, publishing, retry queuing, and DB persistence. This makes the code brittle (bugs must be fixed in up to 8 places), hard to extend (new message types require two new functions), and inconsistent (e.g. `sendGroupFileMessage` uses best-effort retry-only while `sendGroupMessage` uses `publishWithDeadline`).

## What Changes
- Extract a generic `sendEnvelope()` private method that handles the shared NIP-59 delivery pipeline: auth, relay discovery, temp connections, per-recipient gift-wrap, publish/retry, self-wrap, DB save, and post-send hooks.
- Reduce the 8 public/private send functions to thin wrappers that only build the rumor event (kind 14/15/7) with appropriate tags, then delegate to `sendEnvelope()`.
- Normalize the publish strategy: all group sends use `publishWithDeadline` per participant (fixing the `sendGroupFileMessage` inconsistency).
- No changes to external behavior, event formats, or NIP compliance.

## Impact
- Affected specs: `messaging` (internal refactor — no requirement changes, but the send delivery architecture is restructured)
- Affected code: `src/lib/core/Messaging.ts` (lines 763-1848)
- Estimated reduction: ~800 lines removed, ~300 lines added (net -500 lines)
- Risk: Medium — touches all send paths; requires thorough test coverage of existing behavior
