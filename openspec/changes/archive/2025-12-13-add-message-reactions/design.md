## Context
nospeak currently supports NIP-17 encrypted direct messages using NIP-59 gift wraps and NIP-44 encryption, with `kind 14` text and `kind 15` file rumors delivered via `kind 1059` gift-wrap events. Messages are stored in IndexedDB and rendered in Svelte components with lazy URL preview fetching based on viewport intersection. There is no representation of NIP-25 reactions today.

The goal of this change is to add support for NIP-25 `kind 7` reactions within the existing NIP-17 pipeline for one-to-one conversations, providing a simple, performant way to react with a small fixed emoji set while preserving existing messaging semantics.

## Goals
- Allow users to send reactions to individual encrypted DM messages using NIP-25 `kind 7` rumors wrapped inside NIP-17 gift-wraps.
- Persist incoming and outgoing reactions in local storage so that reactions can be aggregated and rendered even after reload.
- Extend the message interaction menu with a clear, low-friction way to apply the four standard reactions (thumb up, thumb down, heart, laugh).
- Render reaction emoji chips directly under the message bubble with minimal visual noise and clear indication of the current user’s reactions.
- Only hydrate and render reaction summaries for messages that are currently visible in the viewport to keep scrolling performant in long histories.

## Non-Goals
- Public timeline or group-chat reactions outside the existing one-to-one NIP-17 DM context.
- Custom emoji packs, NIP-30 custom emoji rendering, or arbitrary reaction graphics beyond plain Unicode emoji.
- Complex reaction analytics or global reaction counts across conversations.

## Decisions
- **Reaction targeting**: Use the DM gift-wrap event id (the outer `kind 1059` event) as the target in the NIP-25 `e` tag and in local storage. This aligns with how messages are already keyed locally (`Message.eventId`) and avoids exposing inner unsigned rumor ids.
- **Per-user semantics**: Allow each participant to react to a given message with multiple different emojis, but only one reaction per (message, emoji, author) tuple. If the same user re-sends the same emoji reaction, it overwrites their earlier reaction of that kind instead of incrementing the count.
- **Accepted content**: Outgoing reactions are limited to a fixed set of four emojis (thumb up, thumb down, heart, laugh). Incoming reactions may use arbitrary Unicode emojis, which will be displayed when possible, but any NIP-30 custom emoji tags are ignored and not resolved to external image URLs.
- **Storage model**: Store reactions in a dedicated `reactions` table keyed by target message event id and author, with fields for the emoji, reaction event id, and timestamp. This keeps reactions separate from the main `messages` table while enabling efficient per-message queries.
- **Aggregation**: Provide a small aggregation layer that converts raw reactions into per-message summaries of the form (emoji, count, byCurrentUser). This allows the UI to render compact chips and highlight the local user’s own reactions without duplicating counting logic in components.
- **Viewport-aware rendering**: Reuse the existing intersection-observer utility used for URL previews to gate reaction summary hydration and subscription. Reaction data is still stored for all messages, but aggregation and subscription work is only done while a given message bubble is within the visible scroll viewport.

## Alternatives Considered
- **Embedding reactions into the messages table**: Rejected because mixing message and reaction rows would complicate existing history fetch, pagination, and unread logic and would require additional filtering in many places.
- **Using inner rumor ids as reaction targets**: Rejected in favor of targeting the gift-wrap id, since the current implementation already persists only the gift-wrap id per message and NIP-25 treats any Nostr event id as a valid reaction target.
- **Rendering reactions eagerly for all messages**: Rejected due to potential performance and layout costs for long histories, especially on mobile. The viewport-aware approach aligns with how URL previews are already handled.

## Risks / Trade-offs
- **Backfill completeness**: Historical reactions will only appear after the client has fetched and processed their corresponding gift-wrap events. If some relays do not retain older gift-wraps, older reactions may be missing.
- **UI complexity**: Adding a reaction bar and context menu actions increases UI complexity in the message bubble. Careful styling is needed to avoid clutter, especially on small screens.
- **Spec evolution**: NIP-25 and NIP-17 are still drafts. Future changes to these NIPs may require revisiting how reactions are represented or encrypted, but the design keeps concerns isolated to the messaging service and reaction repository.

## Migration Plan
- Introduce the new `reactions` table via a forward-only IndexedDB migration without touching existing message data.
- Deploy the messaging service changes to start processing `kind 7` rumors and persisting reactions without changing the main message flow.
- Enable the UI reaction controls and viewport-aware rendering once reaction storage and aggregation are stable.
- No destructive migration or existing data rewrite is required; older clients will simply ignore reaction events.

## Open Questions
- Should long-press or context-menu invocation differ between desktop and mobile to make reactions more discoverable on touch devices?
- Should the UI display counts for all reactions or hide counts of 1 for a simpler look in very small bubbles?
