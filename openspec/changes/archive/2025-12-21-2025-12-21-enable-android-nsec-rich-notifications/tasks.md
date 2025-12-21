## 1. Spec & Proposal
- [x] 1.1 Draft OpenSpec deltas for `android-app-shell`
- [x] 1.2 Draft OpenSpec deltas for `settings`
- [x] 1.3 Run `openspec validate 2025-12-21-enable-android-nsec-rich-notifications --strict`

## 2. Web Runtime (SvelteKit)
- [x] 2.1 Remove `remember` parameter from login APIs and update call sites
- [x] 2.2 Add Android-only secure secret plugin wrapper
- [x] 2.3 Update local login to store secret in Android Keystore (not localStorage)
- [x] 2.4 Update restore to require Android re-login when secret missing
- [x] 2.5 Update logout to clear Android Keystore secret
- [x] 2.6 Update Android background messaging bridge to infer mode without `nospeak:nsec`

## 3. Android Native
- [x] 3.1 Add Keystore-backed encrypted storage for local secret key
- [x] 3.2 Add Capacitor plugin methods to set/get/clear local secret
- [x] 3.3 Remove `nsecHex` from Android background messaging start intent
- [x] 3.4 Implement native NIP-44 v2 decryption for local-key mode
- [x] 3.5 Allow rich notification emission for `mode == "nsec"`
- [x] 3.6 Disable background messaging when `nsec` secret missing (persist + stop service)

## 4. Tests
- [x] 4.1 Update `AuthService` unit tests for Android vs web storage behavior
- [x] 4.2 Native secret storage tests not added (requires Android instrumentation/Robolectric; out of scope for this repo’s current test setup)

## 5. Validation
- [x] 5.1 Run `npm run check`
- [x] 5.2 Run `npx vitest run`
- [x] 5.3 Run Android build (debug) to ensure Gradle and deps resolve
