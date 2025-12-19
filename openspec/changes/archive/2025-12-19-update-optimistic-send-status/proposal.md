# Change: Update Optimistic Send Status

## Why
Today, newly sent messages only appear after local persistence and downstream refresh, making chat feel sluggish. Additionally, the UI cannot reliably report whether a message was actually delivered to any relay because publishing happens asynchronously.

Users expect messages to appear immediately with a clear delivery state. When relay delivery cannot be confirmed, the UI should remove the message and let the user retry.

## What Changes
- Add an optimistic send UX for outgoing text and media messages:
    - The message bubble appears immediately after the user submits.
    - The latest outgoing message shows a `sending...` status until delivery confirmation.
- Add relay publish confirmation for outgoing DMs:
    - A send attempt is considered successful when at least one *recipient* messaging relay acknowledges the recipient gift-wrap within 5 seconds.
    - After success, the latest outgoing message shows `sent to x/x relays` (and can continue to update as more relays succeed).
- Add rollback behavior on failure:
    - If no recipient relay publish success is observed within 5 seconds, the optimistic message bubble is removed.
    - The user is shown an error message.
    - The text input is restored (text messages) or the media preview state is restored (media messages).

## Impact
- Affected specs:
    - `messaging` (chat send UX + delivery confirmation semantics)
- Affected code (implementation stage):
    - `src/lib/core/Messaging.ts` (send pipeline)
    - `src/lib/core/connection/*` (publish-with-deadline helper)
    - `src/lib/components/ChatView.svelte` (optimistic rendering + rollback)
    - `src/lib/components/MessageContent.svelte` (optimistic media rendering)
    - Tests in `src/lib/core/*.test.ts`

## Notes / Risks
- Relay publish APIs are not always abortable. A relay might acknowledge after the 5 second deadline; in that case the message could still be delivered even though the UI rolled back. This change optimizes for perceived responsiveness and clear retry affordances, not perfect delivery certainty.
