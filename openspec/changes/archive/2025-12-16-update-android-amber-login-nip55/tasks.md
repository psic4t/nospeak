## 1. Specification and Design
- [x] 1.1 Finalize this proposal and design, including confirmation that NIP-55 (Intents + ContentResolver) is the only supported Amber path in the Android app shell.
- [x] 1.2 Review existing archived changes that mention Amber / NIP-46 to ensure this proposal is consistent with past decisions while explicitly deprecating NIP-46 for Android.

## 2. Android App Shell and Plugin Implementation
- [x] 2.1 Add NIP-55 discovery support to the Android manifest (nostrsigner scheme in `<queries>`) and document the expected Amber package behavior.
- [x] 2.2 Implement a new Capacitor plugin (e.g. `AndroidNip55Signer`) that exposes `isAvailable`, `getPublicKey`, `signEvent`, `nip44Encrypt`, and `nip44Decrypt`, using Intents for `get_public_key` and a hybrid ContentResolver/Intent strategy for the other methods as defined by NIP-55.
- [x] 2.3 Persist the signer package name returned by `get_public_key` and use it for subsequent ContentResolver URIs and Intent `setPackage` calls.
- [x] 2.4 Implement clear error semantics in the plugin for "no signer available", "rejected", "user cancelled", and transport/format errors, so the web layer can surface stable, user-friendly messages.

## 3. Web Client Signer and Auth Wiring
- [x] 3.1 Add a TypeScript bridge for the `AndroidNip55Signer` plugin in `src/lib/core` and implement a `Nip55Signer` that satisfies the existing `Signer` interface by delegating `getPublicKey`, `signEvent`, `encrypt`, and `decrypt` to the plugin.
- [x] 3.2 Update `AuthService` to introduce an `amber` auth method that uses `Nip55Signer` for the "Login with Amber" flow, derives the current user's npub from the NIP-55 pubkey, and runs the existing ordered login history flow.
- [x] 3.3 Update `AuthService.restore` to restore `amber` sessions via `Nip55Signer` and to clear any legacy `nip46` sessions (removing associated local storage keys) instead of attempting to reconnect via NIP-46.
- [x] 3.4 Ensure Android background messaging continues to treat Amber sessions generically as external-signer mode (`mode = "amber"`) and does not depend on NIP-46-specific state.

## 4. Login UI and User Experience
- [x] 4.1 Update the unauthenticated login screen so that, when running inside the Android app shell and a NIP-55 signer is available, the "Login with Amber" button launches the NIP-55 `get_public_key` flow directly (no QR/nostrconnect URI modal).
- [x] 4.2 Remove or repurpose any Amber-specific QR/URI modals that were used for NIP-46 so they are no longer part of the Android Amber login path.
- [x] 4.3 Ensure non-Android environments (desktop web, mobile web) retain their existing login options and behavior, and that the Amber option remains Android-only.

## 5. Testing and Validation
- [x] 5.1 Add or update unit tests for `AuthService` and the new `Nip55Signer` to cover successful Amber login, restoration of `amber` sessions, and non-restoration of legacy `nip46` sessions.
- [x] 5.2 Add tests to verify that NIP-98 upload authentication and message encryption/decryption continue to work when the active signer is `Nip55Signer`.
- [x] 5.3 Perform manual Android end-to-end tests with Amber installed to confirm that Intents and ContentResolver paths behave as expected, including remembered permissions and "always reject" paths.
- [x] 5.4 Run `npm run check`, `npx vitest run`, and `openspec validate update-android-amber-login-nip55 --strict` before merging implementation work.
