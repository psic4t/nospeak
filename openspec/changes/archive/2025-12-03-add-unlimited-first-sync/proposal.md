# Change: Add Unlimited First-Time Message Sync with Progress Indicator

## Why
Currently, the application only fetches the last 100 messages on login. This causes older contacts (those without recent messages) to not appear in the contact list, since contacts are auto-populated from message history. Users expect to see all their messaging contacts after logging in.

## What Changes
- First-time sync (empty cache) fetches ALL messages from relays instead of just 100
- Returning user sync remains unchanged (1 batch of 100 messages to fill gaps)
- Progress indicator shown during first-time sync:
  - Desktop: Displayed in empty chat area with message count
  - Mobile: Blocking modal overlay with message count
- Real-time subscription (`listenForMessages`) changed to only receive new messages (using `since` filter)
- Auto-navigate to newest contact after first-time sync completes

## Impact
- Affected specs: `messaging` (Message Synchronization, Message History Display)
- Affected code:
  - `src/lib/core/Messaging.ts` - sync logic changes
  - `src/lib/stores/` - new sync state store
  - `src/lib/components/` - new SyncProgressModal component
  - `src/routes/chat/+page.svelte` - desktop progress UI
  - `src/routes/chat/+layout.svelte` - mobile modal integration
