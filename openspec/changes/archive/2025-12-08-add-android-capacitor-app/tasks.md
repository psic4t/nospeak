## 1. Project Setup
- [x] 1.1 Confirm target Android API level(s), minimum OS version, and supported device types.
- [x] 1.2 Add Capacitor CLI and configuration to the project (root `capacitor.config.*`).
- [ ] 1.3 Initialize an Android project under `android/` linked to the nospeak web build output (run `npm run build:android` and `npm run android` after installing dependencies to generate and open the native project).

## 2. Web Build Integration
- [x] 2.1 Decide which SvelteKit build output (adapter) the Android shell will load (local bundled assets vs dev server for debugging).
- [x] 2.2 Update build scripts so a single command produces web assets for Capacitor (e.g., `npm run build:android`).
- [ ] 2.3 Verify that the Android WebView loads the bundled nospeak UI offline and respects existing routing (`/chat`, `/settings`, etc.) on a real device or emulator.

## 3. Native Environment Bridge
- [x] 3.1 Add a small TypeScript utility to detect when the app is running inside Capacitor on Android.
- [x] 3.2 Expose a simple interface for triggering native dialogs (alert, confirm, action sheet, share) from the web layer.
- [x] 3.3 Add basic tests or stubs for the bridge to keep it safe in non-native environments (web, SSR).

## 4. Native Dialog Integration in Messaging
- [x] 4.1 Update message input and media upload flows to use Capacitor-native dialogs for error states while preserving existing file-picker behavior.
- [x] 4.2 Use native confirmation dialogs (e.g., error alerts, destructive actions) in the Android shell when appropriate (contacts, relays, logout).
- [x] 4.3 Integrate native share sheet for sharing message content or invite links from Android (via the "Share nospeak" action in Settings → About).

## 5. UX and Visual Consistency
- [x] 5.1 Ensure native dialogs respect system theme (light/dark) and align with Catppuccin visual language where possible by reusing existing text and colors and relying on OS-native styling.
- [x] 5.2 Verify that navigation and startup behavior on Android align with existing `messaging` startup navigation requirements by loading the same `build` output used for the web client.

## 6. Build, Test, and Release
- [x] 6.1 Document Android toolchain requirements (Java/Kotlin, Android Studio, SDK, emulators/real devices).
- [x] 6.2 Add commands or scripts to build, run, and debug the Android app (e.g., `npm run android` wrapper).
- [ ] 6.3 Test the app on at least one emulator and one physical device, validating native dialogs, media upload, and messaging flows (manual verification step for maintainers).
- [x] 6.4 Document signing and Play Store (or alternative store) release steps, even if initial distribution is internal.
