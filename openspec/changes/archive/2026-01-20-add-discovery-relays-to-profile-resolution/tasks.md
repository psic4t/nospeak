## 1. ConnectionManager Extension

- [x] 1.1 Extend `subscribe()` method signature to accept optional `options?: { extraRelays?: string[] }` parameter
- [x] 1.2 Track which extra relays were newly added (not already in `this.relays`) for cleanup
- [x] 1.3 Call `addTemporaryRelay()` for each new extra relay
- [x] 1.4 Update cleanup function to remove temporarily added relays
- [x] 1.5 Add `connectDiscoveryRelays(relayUrls: string[])` public method for proactive connection

## 2. ProfileResolver Update

- [x] 2.1 Import `getDiscoveryRelays` from `$lib/core/runtimeConfig`
- [x] 2.2 Pass `{ extraRelays: getDiscoveryRelays() }` to `connectionManager.subscribe()` call

## 3. Search UI Integration

- [x] 3.1 In `ManageContactsModal.svelte`: import `connectionManager` and `getDiscoveryRelays`
- [x] 3.2 In `ManageContactsModal.svelte`: add `discoveryRelaysConnected` state variable
- [x] 3.3 In `ManageContactsModal.svelte`: add `$effect` to connect discovery relays on first keystroke
- [x] 3.4 In `ManageContactsModal.svelte`: reset `discoveryRelaysConnected` when modal closes
- [x] 3.5 In `contacts/+page.svelte`: apply same changes (import, state, effect, reset)

## 4. Testing & Validation

- [x] 4.1 Run `npm run check` to verify no type errors
- [x] 4.2 Run `npx vitest run` to verify tests pass
- [ ] 4.3 Manual test: search for NIP-05 contact whose profile is only on discovery relays
