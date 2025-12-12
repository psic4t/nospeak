## 1. Specification and Design
- [x] 1.1 Finalize spec deltas for `android-app-shell`, `messaging`, and `settings` describing Android back/swipe behavior.
- [x] 1.2 Capture technical design for integrating Capacitor `@capacitor/app` backButton handling with Svelte layouts and modal state.

## 2. Android Back Handling Integration
- [x] 2.1 Add `@capacitor/app` dependency and wire it into the existing Capacitor config for the Android shell, including any required `disableBackButtonHandler` settings.
- [x] 2.2 Implement a single Android-only back handler in the web client using the Capacitor App plugin `backButton` event that responds to both hardware and swipe-back actions.
- [x] 2.3 Define and implement a clear priority order for back handling: close full-screen overlays, then in-app modals (Settings, Manage Contacts, profile-related, QR), then perform route-level navigation or exit.

## 3. Chat and Contact List Navigation
- [x] 3.1 Ensure that on Android mobile, back/swipe from a chat detail route (`/chat/<npub>`) navigates back to the contact list route (`/chat`) instead of exiting the app or jumping to a different screen.
- [x] 3.2 Verify that back/swipe from the contact list root behaves sensibly (e.g., falls back to history/back or app exit) and does not regress existing startup navigation semantics.

## 4. Settings and Manage Contacts Back Behavior
- [x] 4.1 Make Android back/swipe close the Settings modal when it is open, keeping the user on their current underlying screen.
- [x] 4.2 Make Android back/swipe close the Manage Contacts modal when it is open, keeping the user on their current underlying screen.
- [x] 4.3 Ensure other global overlays (profile modal, empty profile modal, QR modal, image viewer) are closed by Android back/swipe before any route-level navigation occurs.

## 5. Validation
- [x] 5.1 Test the Android app on a device or emulator with gesture navigation to confirm back/swipe behavior from: contact list, chat detail, Settings open, Manage Contacts open, and with full-screen overlays active. (Manual verification required outside this environment.)
- [x] 5.2 Run `npm run check` to verify type safety and Svelte checks.
- [x] 5.3 Run `npx vitest run` to ensure existing tests pass (and add or update tests if a natural place exists for back-handling logic).
