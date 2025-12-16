# Change: Use NIP-55 for Android Amber login

## Why
Amber runs on the same Android device as the nospeak app shell, so using relay-based NIP-46 / Nostr Connect to authenticate and sign messages is slower, more complex, and less reliable than necessary. NIP-55 provides a direct Android signer interface (Intents plus ContentResolver) that better matches this topology and aligns with the existing Android app shell capabilities.

## What Changes
- Replace the existing Android Amber login and signing path that relies on NIP-46 / Nostr Connect with a NIP-55-based Android signer flow using `nostrsigner:` Intents and ContentResolver queries.
- Standardize a new `amber` auth method that uses a NIP-55-backed signer implementation instead of the current NIP-46 / bunker signer, and clear any legacy `nip46` auth sessions instead of restoring them.
- Require the Android app shell to prefer ContentResolver-based NIP-55 operations for background or high-volume signing/encryption when the user has granted "remember my choice" in the signer, falling back to Intents only when necessary.
- Keep the messaging experience and login screen semantics unchanged except that, when running inside the Android app shell, the "Login with Amber" option SHALL use NIP-55 rather than NIP-46 and SHALL open the Amber signer app directly instead of showing a Nostr Connect QR/URI flow.

## Impact
- Affected specs: `android-app-shell`, `messaging`.
- Affected code (for later implementation): Android Capacitor shell (native plugins and manifest), authentication and signer implementations in `src/lib/core` (including removal of NIP-46-specific code paths), and the unauthenticated login UI in `src/routes/+page.svelte`.
- **BREAKING**: Existing Amber sessions stored as `auth_method = "nip46"` will no longer be restored and will require users to re-login using the new NIP-55-based Amber flow.
