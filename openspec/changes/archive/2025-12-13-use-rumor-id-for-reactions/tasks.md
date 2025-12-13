## 1. Specification and Design
- [x] 1.1 Define the requirement for using Rumor ID as the stable reaction target in `specs/messaging/spec.md`.
- [x] 1.2 Validate the proposal with `openspec validate`.

## 2. Data Model Changes
- [x] 2.1 Update `src/lib/db/db.ts` to add `rumorId` to the `Message` interface.
- [x] 2.2 Increment Dexie schema version to index `rumorId`.

## 3. Messaging Core Updates
- [x] 3.1 Update `MessagingService.createMessageFromRumor` (and `processGiftWrapToMessage`) to calculate the rumor hash (`getEventHash`) and include it in the `Message` object.
- [x] 3.2 Update `MessagingService.sendMessage` to calculate the rumor hash before encryption and save it as `rumorId` in the local cache.
- [x] 3.3 Update `MessagingService.sendReaction` to use `targetMessage.rumorId` as the `e` tag target.
- [x] 3.4 Update `MessagingService.processReactionRumor` to use the incoming `e` tag (which is now the rumor ID) to look up the target message (or simply store it as `targetEventId` in the reaction repo, relying on the UI to match it via `rumorId`).

## 4. UI Updates
- [x] 4.1 Update `ChatView.svelte` to pass `msg.rumorId` to `MessageReactions` component instead of `msg.eventId`.
- [x] 4.2 Update `ChatView.svelte`'s `reactToMessage` handler to pass `rumorId` to `sendReaction`.
- [x] 4.3 Update `MessageReactions.svelte` to fetch and subscribe using the passed ID (logic likely remains the same, just semantic change of the ID).

## 5. Testing
- [x] 5.1 Update unit tests in `MessagingService.test.ts` to verify `rumorId` generation and reaction targeting.
- [x] 5.2 Verify that the `rumorId` is consistent between sent and received versions of the same message.
