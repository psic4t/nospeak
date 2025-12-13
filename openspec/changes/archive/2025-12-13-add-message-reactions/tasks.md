## 1. Specification and Design
- [x] 1.1 Review NIP-17 and NIP-25 details relevant to encrypted DM reactions.
- [x] 1.2 Finalize OpenSpec requirements for message reactions in `changes/add-message-reactions/specs/messaging/spec.md`.
- [x] 1.3 Refine design decisions for reaction storage, aggregation, and viewport-aware rendering in `design.md`.
- [x] 1.4 Run `openspec validate add-message-reactions --strict` and resolve any spec issues.

## 2. Data Model and Storage
- [x] 2.1 Extend the IndexedDB schema to add a `reactions` table keyed by target message and author.
- [x] 2.2 Implement a `ReactionRepository` for reading and writing reactions, including per-message queries.
- [x] 2.3 Add a reactions store or helper to aggregate reactions by emoji and mark whether the current user has reacted.

## 3. Messaging Pipeline Integration
- [x] 3.1 Update the NIP-17 gift-wrap decryption path to recognize and process `kind 7` reaction rumors alongside existing `kind 14` and `kind 15` messages.
- [x] 3.2 Implement a `sendReaction` path in the messaging service that creates NIP-25 `kind 7` rumors, wraps them using the existing NIP-17 flow, and publishes them to the appropriate relays.
- [x] 3.3 Ensure reactions reference the DM gift-wrap event id via the `e` tag per the agreed convention.
- [x] 3.4 Avoid treating reactions as normal chat messages in history fetch and real-time subscription logic.

## 4. UI and Interaction
- [x] 4.1 Extend the message context / interaction menu to show the standard reaction set (thumb up, thumb down, heart, laugh).
- [x] 4.2 Wire the interaction menu to call the messaging service to send reactions for the selected message.
- [x] 4.3 Implement a `MessageReactions` UI component that renders aggregated reactions as emoji chips under the related message bubble.
- [x] 4.4 Integrate intersection-observer-based viewport detection so reaction summaries are only hydrated and rendered for visible messages.

## 5. Testing and Validation
- [x] 5.1 Add unit tests around the messaging service for sending and receiving reactions, including history and live subscription paths.
- [x] 5.2 Add unit tests for the reaction repository and aggregation logic, covering multiple emojis and both participants.
- [x] 5.3 Add UI-level tests where feasible (e.g., component-level tests for the reactions UI and context menu behaviour).
- [x] 5.4 Run `npm run check` and `npx vitest run` and fix any failures related to this change.
