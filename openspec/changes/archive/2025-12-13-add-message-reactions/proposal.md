# Change: Add NIP-25 Message Reactions to Encrypted DMs

## Why
Users want to quickly react to individual direct messages with simple emoji feedback inside the existing NIP-17 encrypted DM experience. Today nospeak only supports plain text and media messages; there is no way to express lightweight acknowledgment or sentiment without sending a full reply. Adding NIP-25 reactions improves expressiveness while preserving the privacy and deniability properties of NIP-17.

## What Changes
- Add support for creating and sending NIP-25 `kind 7` reaction rumors as part of the existing NIP-17 gift-wrapped DM pipeline.
- Store and aggregate incoming reaction events per message in local storage so the UI can render them efficiently.
- Extend the message interaction menu with a fixed set of standard reactions (thumb up, thumb down, heart, laugh) that can be applied to any message in a one-to-one conversation.
- Render reaction emoji chips directly under the corresponding message bubble, aggregating reactions by emoji and indicating when the current user has reacted.
- Ensure reaction summaries are only hydrated and rendered for messages that are currently within the scroll viewport, similar to existing URL preview lazy-loading behavior.

## Impact
- Affected specs: `messaging` (new requirements for reactions, viewport-aware rendering, and NIP-17/NIP-25 alignment).
- Affected code: messaging core (gift-wrap processing and send pipeline), local DB schema and repositories, Svelte chat UI components (message context menu and message bubble rendering), and related stores.
