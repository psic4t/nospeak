# Change: Add NIP-05 Search to Manage Contacts

## Why
Users currently need to know an exact `npub` to add contacts via the Manage Contacts modal. While relay-based name search was added, many users publish a NIP-05 identifier (e.g., `bob@domain.com`) as their primary identity. Being able to look up users by NIP-05 directly from the web makes contact discovery easier and aligns with how Nostr identities are commonly shared.

## What Changes
- Add NIP-05 format detection to the Manage Contacts modal's input field (`localpart@domain`).
- When a NIP-05 address is entered, immediately fetch the hex public key from the domain's `/.well-known/nostr.json` endpoint without triggering relay-based search.
- Convert the resolved hex key to an `npub`, resolve the user's profile metadata from relays, and display the result as a single-item dropdown with avatar and username.
- Show "Already added" indicator when the resolved `npub` already exists in the user's contacts list.
- Display appropriate error states for invalid NIP-05 format, network failures, and NIP-05 not found.
- Update the input placeholder text to reflect that NIP-05 is a supported input format.

## Impact
- Affected specs: `messaging` (Manage Contacts modal search behaviour).
- Affected code: Manage Contacts modal UI, NIP-05 verifier helper for lookup-only (not verification), and minor i18n updates.
- No changes to existing relay-based search, npub direct-add flow, or contact storage schema.
