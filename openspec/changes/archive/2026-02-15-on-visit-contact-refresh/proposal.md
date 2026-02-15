## Why

The app currently refreshes relay discovery and profile data for all contacts in a single bulk operation 5 seconds after every app reload. This is wasteful—most contacts' data hasn't changed, and the user may only chat with 1-2 people per session. Moving the refresh to happen per-contact when visiting a chat reduces startup network activity and ensures the contact data that matters most (the one being viewed) is always fresh.

## What Changes

- Remove the bulk 5-second startup contact profile/relay refresh loop from `+layout.svelte`
- Keep the current user's own relay discovery at startup (needed for persistent messaging relay connections)
- Add on-visit refresh: when opening a 1:1 chat, run `discoverUserRelays()` for the partner (relay discovery + profile resolution in one call)
- Add on-visit refresh for groups: when opening a group chat, run `discoverUserRelays()` for each participant (batched with inter-batch delays)
- Add per-contact cooldown (~5 min) to prevent redundant refreshes on rapid chat switching
- Dispatch `nospeak:profiles-updated` after refresh so the UI updates gradually (names, pictures)
- Extend the existing `handleProfilesUpdated` listener in ChatView to also re-read group participant profiles

## Capabilities

### New Capabilities

- `chat-visit-refresh` — On-demand contact profile and relay refresh triggered by chat navigation

### Modified Capabilities

_None — the startup refresh being removed is not captured in any existing spec._

## Impact

- Affected code: `+layout.svelte` (remove bulk refresh), `+page.svelte` (add visit trigger), `ChatView.svelte` (extend profile update handler for groups), new `ChatVisitRefreshService.ts`
- Contacts whose chats are never visited will have stale profile data indefinitely (acceptable trade-off)
- No breaking changes to APIs, data models, or relay protocols
- No changes to the login/auth flow or current user relay discovery
