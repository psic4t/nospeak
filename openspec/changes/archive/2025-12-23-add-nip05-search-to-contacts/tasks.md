## 1. Design and Spec Alignment
- [x] 1.1 Review existing `Manage Contacts Search via NIP-50 Relay` requirement in `openspec/specs/messaging/spec.md` to align NIP-05 lookup behavior with current search UI patterns.
- [x] 1.2 Confirm NIP-05 lookup URL format and JSON response structure against NIP-05 specification.

## 2. NIP-05 Lookup Helper
- [x] 2.1 Add a new `resolveNip05ToNpub(nip05: string): Promise<string>` function in `src/lib/core/Nip05Verifier.ts` that:
  - Validates input format (`localpart@domain` where both parts are non-empty).
  - Constructs and fetches from `https://<domain>/.well-known/nostr.json?name=<localPart>`.
  - Parses JSON to extract the hex pubkey for the given local-part.
  - Returns the hex pubkey or throws an error for invalid format, HTTP errors, invalid response, or when the name is not found.
  - Does not use memory caching (as per user requirement).

## 3. Manage Contacts Modal Logic
- [x] 3.1 Add state variables for NIP-05 mode: `isResolvingNip05`, `nip05LookupError`, `nip05Result`, and `nip05LookupToken`.
- [x] 3.2 Implement `isValidNip05Format(query: string)` helper function to detect NIP-05 format with minimum 2-char TLD validation.
- [x] 3.3 Update the existing `isNpubMode` derived value to also return true for NIP-05 format (so relay search is skipped).
- [x] 3.4 Extend the search effect to detect NIP-05 format and:
  - Trigger immediate NIP-05 lookup (no debounce) only after minimum 2-char TLD is entered.
  - Convert resolved hex pubkey to `npub` using `nip19.npubEncode`.
  - Check if the `npub` already exists in the contacts list.
  - Resolve profile metadata using `profileResolver.resolveProfile(npub, true)`.
  - Display result with avatar, username, and "Already added" indicator when applicable.
  - Display appropriate error messages for lookup failures.
  - Use token pattern to prevent race conditions between concurrent lookups.
- [x] 3.5 Update `resetState()` to clear NIP-05-related state including `nip05LookupToken`.
- [x] 3.6 Ensure that typing or removing "@" characters triggers appropriate mode transitions (NIP-05 ↔ relay search).

## 4. Manage Contacts Modal UI
- [x] 4.1 Add NIP-05-specific result display section under the input field that shows:
  - Loading spinner with "Looking up NIP-05..." text while resolving.
  - Single result row with avatar, username, shortened npub.
  - "Already added" badge when the resolved npub exists in contacts.
  - Click-to-select behavior that populates the input with the npub and closes dropdown.
  - Disabled, non-interactive state when the result is already added.
  - Green verification icon and full NIP-05 address displayed next to username (matching relay search result pattern).
- [x] 4.2 Add error display for NIP-05 lookup failures with specific messages for:
  - Invalid NIP-05 format (e.g., `missing@domain`, `@domain`).
  - NIP-05 not found on the server.
  - Network or HTTP errors.
- [x] 4.3 Ensure the NIP-05 result section takes precedence over relay search results when NIP-05 format is active.

## 5. Internationalization
- [x] 5.1 Update `src/lib/i18n/locales/en.ts` to add translation keys:
  - `modals.manageContacts.searchPlaceholder` → `'npub, NIP-05, or search term'`
  - `modals.manageContacts.resolvingNip05` → `'Looking up NIP-05...'`
  - `modals.manageContacts.nip05LookupFailed` → `'Failed to look up NIP-05'`
  - `modals.manageContacts.nip05NotFound` → `'NIP-05 not found'`
  - `modals.manageContacts.nip05InvalidFormat` → `'Invalid NIP-05 format (use name@domain.com)'`
  - `modals.manageContacts.alreadyAdded` → `'Already added'`
- [x] 5.2 Add corresponding German translations to `src/lib/i18n/locales/de.ts`.

## 6. Integration and Validation
- [x] 6.1 Manually verify that entering a valid NIP-05 address (e.g., a real user's identifier) resolves correctly and displays the result with avatar and username.
- [x] 6.2 Manually verify that invalid NIP-05 formats show the appropriate error message.
- [x] 6.3 Manually verify that a NIP-05 for a user already in contacts shows "Already added" and cannot be added again via the dropdown.
- [x] 6.4 Manually verify that selecting a valid NIP-05 result pre-fills the input with the npub and allows adding via the "Add" button.
- [x] 6.5 Manually verify that typing "@" after a local-part triggers NIP-05 mode, and removing "@" or typing non-NIP-05 text falls back to relay search.
- [x] 6.6 Manually verify that relay search still works for non-NIP-05 queries (3+ characters).
- [x] 6.7 Manually verify that NIP-05 search only triggers after minimum 2-character TLD is entered and continues searching with every subsequent letter.
- [x] 6.8 Manually verify that typing quickly in NIP-05 mode no longer shows "search failed" after successful lookups (race condition fixed).
- [x] 6.9 Run `npm run check` and `npx vitest run` to confirm the change does not introduce type or test regressions.
