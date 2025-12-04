# Change: Add contact search via dedicated NIP-50 relay

## Why
Users currently must know the exact `npub` to add a contact in the Manage Contacts modal. This makes discovery difficult and forces users to leave the app to look up people by name or phrase. Nostr relays generally do not support full-text search, but the project already depends on Nostr and can use a dedicated search relay that implements NIP-50.

## What Changes
- Add a contact search experience to the Manage Contacts modal that allows users to type a name or phrase (not starting with `npub`) and see matching users from a search relay.
- Use the NIP-50 `search` filter against `wss://relay.nostr.band` limited to kind `0` metadata events to discover matching profiles.
- Display search results in a dropdown below the contact input, showing avatar, username (when available), and shortened `npub`.
- Prefill the contact input with the selected result's `npub` and keep the existing "Add" button workflow for actually adding the contact.
- Ensure that entering a value starting with `npub` continues to bypass search and directly adds the contact as before.

## Impact
- Affected specs: `messaging` (Manage Contacts modal behaviour and contact discovery UX).
- Affected code: Manage Contacts modal UI, Nostr profile search helper using `wss://relay.nostr.band`, and possibly minor wiring in existing profile/relay resolution logic to ensure new contacts behave like manually added ones.
