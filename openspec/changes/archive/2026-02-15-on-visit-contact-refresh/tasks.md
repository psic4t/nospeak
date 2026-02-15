## 1. Create ChatVisitRefreshService

- [x] 1.1 Create `src/lib/core/ChatVisitRefreshService.ts` with `ChatVisitRefreshService` class and exported singleton
- [x] 1.2 Implement in-memory cooldown map (`Map<string, number>`) with 5-minute cooldown constant
- [x] 1.3 Implement `refreshContact(npub: string)` — check cooldown, call `discoverUserRelays(npub, false)`, update cooldown map, dispatch `nospeak:profiles-updated`
- [x] 1.4 Implement `refreshGroupParticipants(participants: string[], currentUserNpub: string)` — filter out current user, batch in groups of 3 with 300ms inter-batch delays, call `refreshContact()` per participant, dispatch `nospeak:profiles-updated` after each batch

## 2. Wire Up Chat Visit Trigger

- [x] 2.1 In `src/routes/chat/[npub]/+page.svelte`, add `$effect` that reacts to `conversationId` changing — for 1:1 chats, call `chatVisitRefreshService.refreshContact(conversationId)` 
- [x] 2.2 For group chats, add logic that waits for `groupConversation` to be loaded, then calls `chatVisitRefreshService.refreshGroupParticipants(groupConversation.participants, currentUser.npub)`

## 3. Extend ChatView Profile Update Handler for Groups

- [x] 3.1 In `src/lib/components/ChatView.svelte`, extract group participant profile loading into a reusable `refreshGroupParticipantProfiles()` function
- [x] 3.2 Extend the `handleProfilesUpdated` event handler to call `refreshGroupParticipantProfiles()` when viewing a group chat

## 4. Remove Bulk Startup Contact Refresh

- [x] 4.1 In `src/routes/+layout.svelte`, remove the contact iteration loop (lines 416-439) from the startup `setTimeout`
- [x] 4.2 Reduce the startup delay from 5000ms to 2000ms (only current user relay discovery remains)
- [x] 4.3 Remove the now-unused `contactRepo` import and `profileResolver` import from the startup block if no longer needed
- [x] 4.4 Clean up the console.log messages that reference bulk contact refresh

## 5. Validation

- [x] 5.1 Run `npm run check` and fix any type errors
- [x] 5.2 Run `npx vitest run` and fix any test failures
