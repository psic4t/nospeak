# Change: Enable rich Android background notifications for local key (nsec) login

## Why
Android Background Messaging currently delivers rich notifications (sender identity + message preview) only when the session uses an external Android signer (Amber) because the native foreground service can delegate NIP-44 decryption to the signer.

Users who log in with a local key (nsec) do not receive the same rich notifications while the app UI is not visible. In addition, the Android implementation currently persists the local secret key in web `localStorage`, which is not an ideal storage location for long-lived secrets in a Capacitor shell.

## What Changes
- Add an Android-native, Keystore-backed storage location for the local secret key so the Android shell can restore local-key sessions without depending on web `localStorage`.
- Enable the native Android background messaging foreground service to decrypt NIP-44 gift-wraps using the locally stored secret key (NIP-44 v2), so it can deliver the same rich preview notifications as Amber sessions.
- Stop storing `nospeak:nsec` in web `localStorage` when running inside the Android Capacitor app shell. The local secret is stored once (native) and accessed through a dedicated Capacitor plugin.
- Remove the unused `remember` flag from login APIs (the app currently always persists logins).
- When background messaging starts/restores in local-key mode but the native secret key is missing, automatically disable background messaging and stop the service to prevent misleading status and background battery usage.

## Scope / Constraints
- Android-only changes for secure storage and background notification parity. Web-only deployments keep the existing localStorage behavior.
- No migration of legacy Android `localStorage['nospeak:nsec']` data. If the native key is missing, the user MUST re-login.
- Do not pass the local secret key through foreground service intents or store it in plain SharedPreferences.
- Preserve existing privacy behavior: message previews MUST remain hidden on the lockscreen as already specified.

## Impact
- Affected specs:
  - `android-app-shell`
  - `settings`
- Affected code (implementation stage):
  - Web runtime: `AuthService`, Android background messaging bridge/wrappers
  - Android native: background messaging Capacitor plugins, foreground service, secure storage helper

## Risks / Trade-offs
- Adding a crypto dependency (for example AndroidX Security Crypto + BouncyCastle) increases APK size and requires careful handling to avoid regressions.
- No migration means some Android users will be logged out after upgrade and must re-enter their nsec; this is a deliberate security/usability trade-off.
- Any bug in native NIP-44 v2 decryption would reduce notification fidelity for local-key sessions; Amber sessions remain unaffected.

## Non-Goals
- Changing message notification behavior on web browsers.
- Introducing NIP-46/Nostr Connect as a background decryption mechanism.
- Adding a "do not remember me" login flow.
- Changing how identities (username/avatar) are cached for notifications beyond existing Android background messaging profile cache behavior.
