# Change: Android back-swipe navigation for chat and overlays

## Why
Android users expect the system back gesture (edge swipe or hardware button) to feel consistent and predictable. Today, nospeak’s Android shell relies on generic history behavior, which can either exit the app unexpectedly or navigate in ways that don’t align with the chat/contact-list layout or in-app modals. We want Android back/swipe to integrate cleanly with the chat experience so that it closes overlays and returns to the contact list from conversations, instead of behaving like a generic browser.

## What Changes
- Define Android-specific back/swipe behavior that prioritizes closing full-screen overlays and modals (Settings, Manage Contacts, profile, image viewer) before changing routes or exiting.
- Ensure that on Android mobile, back/swipe from a chat detail view (`/chat/<npub>`) returns to the contact list view (`/chat`) rather than exiting or jumping to an unrelated screen.
- Integrate Capacitor’s `@capacitor/app` backButton handling into the Android app shell so that the system back gesture and hardware back button share a single, well-defined navigation policy.
- Keep web and non-Android platforms unchanged: the new behavior MUST apply only when running inside the Android Capacitor shell.

## Impact
- Affected specs: `android-app-shell`, `messaging`, `settings`.
- Affected code:
  - Android shell back handling via Capacitor’s App plugin and configuration.
  - SvelteKit root/chat layouts and navigation helpers used to switch between contact list and chat detail views.
  - Global modal/overlay state (Settings, Manage Contacts, Profile, Empty Profile, QR, image viewer) so that Android back closes them in a predictable order.
- No changes to data models or relay/messaging protocols; this is strictly a client-side navigation and UX improvement for Android.
