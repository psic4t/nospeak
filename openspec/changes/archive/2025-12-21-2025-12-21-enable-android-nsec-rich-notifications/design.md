## Context
Android background messaging runs a native foreground service that maintains relay WebSocket connections while the WebView UI is not visible. Today, rich notifications (sender identity + message preview) are effectively Amber-only:
- The service decrypts gift-wrap content by calling Amber's NIP-55 `NIP44_DECRYPT` ContentResolver endpoint.
- Notification emission is explicitly gated to `mode == "amber"`.

Local key (nsec) login currently persists the secret in web `localStorage` and does not provide the native service with a durable decryption capability across process death or device reboot.

## Goals
- Provide the same rich Android background notifications for local key (nsec) login as Amber login.
- Store the local secret key once on Android in a Keystore-backed mechanism and stop persisting it in web `localStorage` on Android.
- Support background messaging restore after reboot/app update in local-key mode, without requiring WebView start.
- Avoid transporting secrets in intents or plain SharedPreferences.
- Keep the change tightly scoped to notification parity and secret storage.

## Non-Goals
- Migrating existing Android `localStorage['nospeak:nsec']` values to native storage.
- Adding a non-persistent login mode or "remember me" UI.
- Replacing the existing Amber/NIP-55 signer integration.

## Decisions
- Use AndroidX Security Crypto (`EncryptedSharedPreferences` + `MasterKey`) to store the 32-byte local secret key in app-private storage backed by Android Keystore.
- Introduce a small Capacitor plugin API for the web runtime to set/get/clear the local secret key when running inside the Android shell.
- Remove the unused `remember` boolean from `AuthService.login` and `AuthService.loginWithExtension` and treat persistence as the default behavior.
- For local-key mode (`mode == "nsec"`), the native background service reads the secret key from Keystore-backed storage directly rather than receiving it through the start intent.
- If background messaging is started/restored in local-key mode but the secret key is missing, the service disables background messaging (persisted) and stops itself.

## Cryptography / Decryption
- Implement NIP-44 v2 decryption in native code for local-key mode.
- The service SHALL only decrypt enough to extract the message/reaction preview and routing target as already specified.
- Amber sessions continue using the existing NIP-55 ContentResolver decryption path.

## Storage Model
- Android native:
  - Secret key stored once in Keystore-backed encrypted preferences.
  - Background messaging prefs store only non-secret configuration (mode, pubkey, relays, summary, notification enabled state).
- Web runtime:
  - On Android: no longer stores `nospeak:nsec`.
  - Outside Android: retains current behavior.

## Failure and Recovery
- If the Android Keystore secret is lost (user cleared app storage, OS key invalidation, etc.), local-key restore fails and requires re-login.
- When this happens and background messaging is enabled, the native service disables background messaging to avoid battery drain and misleading notifications.

## Alternatives Considered
- Migrating legacy `localStorage['nospeak:nsec']` into Keystore. Rejected per request (forces re-login).
- Passing `nsecHex` into the native service via intent extras. Rejected because it duplicates secrets and increases leakage risk.
- Using a remote signer (NIP-46) for local-key sessions. Rejected as out of scope and adds network dependency.

## Risks / Trade-offs
- Implementing NIP-44 v2 crypto in native code requires careful test coverage and dependency selection.
- Forcing re-login on upgrade is user-hostile but intentionally simplifies security and reduces covert persistence of secrets in multiple stores.

## Implementation Sketch
- Add Keystore-backed storage helper and a Capacitor plugin interface for local secret management.
- Update login/restore/logout in the web runtime to use the native secret store on Android and to require re-login when missing.
- Update Android background messaging start flow to remove `nsecHex` from intents.
- Update the native service to:
  - read the local secret from Keystore when in `nsec` mode
  - decrypt gift-wraps using native NIP-44 v2
  - emit the same rich notifications as Amber mode
  - disable and stop background messaging when the secret is unavailable.
