# Design: Optimistic Send Status + Relay Confirmation

## Overview
This change introduces an optimistic outgoing message bubble that renders immediately on submit, coupled with a bounded relay publish confirmation window (5 seconds). If delivery to at least one recipient messaging relay cannot be confirmed within the window, the optimistic bubble is removed and the user can retry.

## Current Behavior
- UI clears the input immediately, then awaits `messagingService.sendMessage()` / `sendFileMessage()`.
- The outgoing message bubble appears later via local persistence (`MessageRepository.saveMessage`) and a conversation refresh.
- Relay publishing is handled via `RetryQueue` and can succeed/fail asynchronously; the send call does not currently model delivery confirmation.

## Target Behavior
- **Immediate UX:** On submit, render an optimistic outgoing bubble instantly.
- **Latest-only status:** Only the latest outgoing message shows status.
- **Confirmation window:** A send is successful only if at least one recipient messaging relay acknowledges the recipient gift-wrap within 5 seconds.
- **Progress after success:** After first success, continue tracking per-relay progress (e.g. `sent to 2/3 relays`).
- **Rollback on failure:** If 0 relays succeed within the window, remove the optimistic bubble and restore the user’s draft state.

## Architectural Approach

### 1) Delivery confirmation source of truth
Delivery confirmation is derived from relay publish acknowledgements for the **recipient** gift-wrap event.

- Count successes only for recipient relays.
- Self-history relays do not count toward delivery confirmation.

### 2) Publish-with-deadline helper
Introduce a helper responsible for attempting immediate publishes with an overall deadline:
- Ensure temporary relay connections exist.
- Wait for connection readiness until deadline.
- Attempt publish operations bounded by remaining time.
- Report successes incrementally so UI can update `sent to x/x relays`.

On success (>= 1 relay ack):
- Persist the sent message locally.
- Optionally enqueue remaining relays to retry queue for best-effort propagation.

On failure (0 relay ack within deadline):
- Do not persist the message locally.
- Do not enqueue retry queue items for recipient relays (to reduce the chance of later delivery after the UI reports failure).

### 3) Optimistic UI rendering
Maintain a component-local optimistic message list in the chat view.
- Insert optimistic message immediately.
- Remove optimistic message when the DB-backed message arrives (success) or when the send fails.
- Status line selection:
    - `sending...` while confirmation is pending or while `successfulRelays` is `0`.
    - `sent to x/x relays` once `successfulRelays > 0`.

### 4) Media optimistic placeholder
Media sending can involve upload/encryption. To allow an immediate bubble:
- Render a local preview URL as an attachment while the send is in-flight.
- If send fails, remove bubble and restore preview (file + caption).

## Non-Goals
- Perfect delivery certainty across all relays.
- Per-message status tracking for multiple concurrent outgoing messages.
- Reworking the entire retry pipeline; this change only adds a confirmation layer.
