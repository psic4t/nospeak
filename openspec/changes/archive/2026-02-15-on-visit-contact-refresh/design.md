## Context

The app currently refreshes relay discovery and profile data for every contact 5 seconds after every app reload via a bulk `setTimeout` in `+layout.svelte:377-442`. This calls `discoverUserRelays()` + `resolveProfile()` for each contact in batches of 5, even though the user may only interact with 1-2 contacts per session. The current user's own relay discovery (which sets up persistent messaging relay connections) also runs inside this same timer.

The existing `nospeak:profiles-updated` custom event is already wired up in `ChatView.svelte` and `ChatList.svelte` to re-read profile data from IndexedDB when dispatched.

## Goals / Non-Goals

**Goals:**
- Refresh a contact's relay/profile data when the user actually visits that chat
- Refresh all group participants' data when visiting a group chat
- Update the UI gradually as fresh data arrives (names, pictures)
- Avoid redundant network calls on rapid chat switching
- Keep the current user's own relay discovery at startup

**Non-Goals:**
- Background periodic refresh for contacts never visited
- Changes to the profile TTL / caching mechanism in `ProfileRepository`
- Changes to `discoverUserRelays()` or `ProfileResolver.resolveProfile()` internals
- Changes to the login sync flow

## Decisions

### 1. Single service with in-memory cooldown

Create a `ChatVisitRefreshService` singleton with a `Map<string, number>` tracking last-refresh timestamps per npub. Cooldown of 5 minutes prevents redundant refreshes when switching between chats rapidly. The map resets on app reload, which is acceptable since we always force-refresh on visit.

**Alternatives considered:**
- Store cooldown in IndexedDB: Rejected — adds unnecessary persistence complexity. Stale cooldowns after reload could prevent needed refreshes.
- Use the profile TTL as the gate: Rejected — user explicitly chose "always force-refresh" on visit regardless of TTL.

### 2. Call `discoverUserRelays()` only (not `resolveProfile()` separately)

`discoverUserRelays(npub, false)` already calls `profileResolver.resolveProfile(npub, true)` internally (Discovery.ts:30). The current startup code redundantly calls `resolveProfile()` a second time after `discoverUserRelays()`. The new service eliminates this redundancy.

**Alternatives considered:**
- Call both explicitly: Rejected — the double-fetch is pure waste; `discoverUserRelays()` does everything needed.

### 3. Trigger via `$effect` in `+page.svelte` reacting to `conversationId`

The chat page already uses `$effect` blocks to react to navigation. Adding another `$effect` that fires on `conversationId` change is consistent with the existing pattern. For group chats, the effect also depends on `groupConversation` being loaded (since participants come from that object).

**Alternatives considered:**
- Trigger in `ChatView.svelte` `onMount`: Rejected — ChatView is keyed on `conversationId` so it remounts on navigation, but `onMount` lacks clean reactive dependency tracking.
- Use SvelteKit `afterNavigate`: Rejected — not used anywhere in the codebase; would introduce a new pattern.

### 4. Batch group participants with per-batch event dispatch

For group chats, refresh participants in batches of 3 with 300ms inter-batch delays. Dispatch `nospeak:profiles-updated` after each batch completes so names/pictures update gradually in the UI rather than all at once at the end.

**Alternatives considered:**
- Refresh all in parallel: Rejected — a group with 20 participants would open 20 discovery relay connections simultaneously.
- Dispatch only once at end: Rejected — user would see stale data for the entire duration then a sudden flash update.

### 5. Extend `handleProfilesUpdated` in ChatView for groups

The existing `handleProfilesUpdated` listener (ChatView.svelte:573) only calls `fetchPartnerProfile()` (1:1). Extend it to also re-read `participantProfiles` from the DB for group chats. This uses the existing `profileRepo.getProfileIgnoreTTL()` path — no new data flow needed.

### 6. Keep current user refresh at startup with reduced delay

The current user's relay discovery (`discoverUserRelays(user.npub, true)`) sets up persistent messaging relay connections. This must stay at startup. Reduce the delay from 5 seconds to 2 seconds since it no longer needs to batch all contacts.

## Risks / Trade-offs

- **Stale data for unvisited contacts:** Contacts whose chats are never opened will have indefinitely stale profile data in the chat list sidebar. → Acceptable per requirements; the sidebar shows whatever is cached.
- **Large group chats:** A 20-member group triggers 20 relay discoveries on first visit (minus cooldown hits from prior 1:1 visits). → Mitigated by batching with inter-batch delays. Subsequent visits within 5 minutes hit the cooldown.
- **Discovery relay load:** Each `discoverUserRelays()` call connects to discovery relays temporarily. → These are cleaned up after each call. The batching limits concurrent connections.
- **Race condition on rapid navigation:** User switches chats while a background refresh is in-flight. → The refresh writes to IndexedDB and dispatches a global event. If the user has already left, the event handler in the new chat's ChatView is a no-op (different `partnerNpub`). No harmful side effects.
