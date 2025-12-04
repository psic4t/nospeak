## 1. Design and Spec Alignment
- [x] 1.1 Review `openspec/specs/messaging/spec.md` and the archived `update-contacts-modal-display` change to align search UX with existing Manage Contacts behavior.
- [x] 1.2 Confirm NIP-50 expectations and nostr.band capabilities for kind `0` profile search.

## 2. Search Behaviour and Relay Usage
- [x] 2.1 Implement a small search helper that queries `wss://relay.nostr.band` using NIP-50 `search` filters restricted to kind `0` metadata events and a configurable result limit.
- [x] 2.2 Ensure the search helper handles timeouts, deduplicates results per pubkey, and maps results into a stable structure (npub, display name, picture, nip05, about).

## 3. Manage Contacts Modal UX
- [x] 3.1 Update the Manage Contacts modal input behaviour so that values starting with `npub` keep the existing direct-add flow with no search.
- [x] 3.2 For non-`npub` inputs of at least 3 characters, trigger a debounced search using the new helper and surface a dropdown of results under the input.
- [x] 3.3 Render search results with avatar, display name (when available), and shortened `npub`, and handle loading / no-result / error states gracefully.
- [x] 3.4 When the user clicks a search result, prefill the input with the selected user's `npub`, close the dropdown, and require the user to click "Add" to finalize adding the contact.

## 4. Integration and Validation
- [x] 4.1 Ensure that adding a contact via search uses the same profile resolution and relay-discovery path as entering the `npub` manually, so downstream messaging behaviour is unchanged.
- [x] 4.2 Manually verify that entering a valid `npub` still bypasses search and adds the contact directly.
- [x] 4.3 Manually verify that name/phrase search (3+ characters) returns relevant results from nostr.band and that selected users become standard contacts after clicking "Add".
- [x] 4.4 Run `npm run check` and `npx vitest run` to confirm the change does not introduce type or test regressions.
