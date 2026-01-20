# Change: Add Discovery Relays to Profile Resolution

## Why

When searching for contacts via NIP-05 lookup, the `ProfileResolver` only queries the user's currently connected messaging relays. If a contact's profile (kind 0 event) is not replicated on those relays, the profile fetch fails silently, returning no name or picture even though the NIP-05 lookup succeeded. Discovery relays (purplepag.es, relay.damus.io, nos.lol, relay.primal.net, nostr.data.haus) are much more likely to have the profile cached.

## What Changes

- Extend `ConnectionManager.subscribe()` to accept an optional `extraRelays` parameter that temporarily connects to additional relays for the duration of the subscription
- Update `ProfileResolver` to pass discovery relays as extra relays when resolving profiles
- Add a `connectDiscoveryRelays()` method to `ConnectionManager` for proactive relay connection
- Connect discovery relays on first keystroke in the contact search field to ensure they're ready when the NIP-05 profile fetch happens

## Impact

- Affected specs: `contacts`
- Affected code:
  - `src/lib/core/connection/ConnectionManager.ts` - extend `subscribe()`, add `connectDiscoveryRelays()`
  - `src/lib/core/ProfileResolver.ts` - pass discovery relays to subscribe
  - `src/lib/components/ManageContactsModal.svelte` - connect discovery relays on first keystroke
  - `src/routes/contacts/+page.svelte` - connect discovery relays on first keystroke
