# Change: NIP-07 Account Mismatch Detection

## Why

NIP-07 signer extensions (like nos2x, Alby, etc.) allow users to have multiple Nostr accounts configured. When a user logs into nospeak with Account A via NIP-07, then later switches to Account B in their signer extension, the app will perform signing operations with Account B while the UI shows Account A's identity. This creates a serious security and usability issue:

- Messages could be sent/signed as the wrong identity
- Incoming messages for Account B get loaded into Account A's chat history
- The user may not realize they're operating as a different account

## What Changes

- **New store**: `signerMismatch` store to track when the active NIP-07 account differs from the logged-in user
- **New service**: `SignerVerification` service that checks signer account on app load and periodically (focus events, 30s interval)
- **New modal**: Non-dismissible `SignerMismatchModal` that blocks all app interaction when mismatch is detected
- **Signer guard**: Block all signing operations (`signEvent`, `encrypt`, `decrypt`) when mismatch is detected
- **NIP-07 signer enhancement**: Add method to get current signer pubkey bypassing cache

## Impact

- Affected specs: None (this is a security enhancement)
- Affected code:
  - `src/lib/core/signer/Nip07Signer.ts` - Add cache-bypassing pubkey method, add mismatch guard
  - `src/lib/core/AuthService.ts` - Integrate verification on NIP-07 restore/login
  - `src/lib/stores/auth.ts` - Store expected pubkey (hex) for comparison
  - `src/routes/+layout.svelte` - Render blocking modal when mismatch detected
  - New: `src/lib/stores/signerMismatch.ts`
  - New: `src/lib/core/SignerVerification.ts`
  - New: `src/lib/components/SignerMismatchModal.svelte`
  - New i18n strings for modal text in all locales
