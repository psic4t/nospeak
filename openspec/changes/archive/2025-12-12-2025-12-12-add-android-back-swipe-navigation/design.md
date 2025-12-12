## Context
nospeak ships a Capacitor-based Android app shell that reuses the Svelte web client. Android users expect the OS back gesture (edge swipe) and hardware back button to control navigation and dismiss layers in a predictable, Android-native way. Today, back behavior is largely delegated to generic history/navigation, which can result in:
- Exiting the app from a chat detail view instead of returning to the contact list.
- Back not consistently closing global overlays or modals like Settings or Manage Contacts before changing routes.

This change introduces an explicit Android-aware back handling strategy while keeping the web experience unchanged.

## Goals / Non-Goals
- Goals:
  - Provide a consistent Android-native feel for back/swipe in chat, Settings, and Manage Contacts.
  - Centralize Android back handling so that both hardware back and system back swipe are handled by one piece of logic.
  - Respect existing startup navigation semantics (e.g., `/chat` behavior on mobile vs desktop).
  - Prioritize closing overlays/modals before route navigation or app exit.
- Non-Goals:
  - Redesign the routing architecture or URL structure.
  - Change non-Android behavior (web, other platforms).
  - Introduce gesture detection beyond the Android system back gesture (no custom in-content swipe recognizers).

## Decisions
- Decision: Use Capacitor `@capacitor/app` `backButton` event as the single integration point for Android back/swipe.
  - Rationale: This event is designed to capture both hardware back presses and system back gestures on Android, and is officially supported across Capacitor versions. It avoids custom native gesture code while still providing OS-native behavior.

- Decision: Handle Android back/swipe in a prioritized sequence:
  1. Close full-screen overlays such as the image viewer before anything else.
  2. Close global modals layered over the main content (Settings, Manage Contacts, profile modal, empty profile modal, QR modal, relay status) if any are open.
  3. If on a chat detail route (`/chat/<npub>`), navigate back to the contact list route (`/chat`) on mobile instead of exiting the app.
  4. Otherwise, if the browser history can go back, call `window.history.back()`; if not, call `App.exitApp()` as the last resort.
  - Rationale: This matches common Android UX expectations where back first dismisses transient UI layers, then backs out of the current feature, and finally exits the app when at the root.

- Decision: Gate the handler to Android-native contexts only.
  - Rationale: The same Svelte codebase runs in web browsers; we must avoid intercepting back behavior there. We will reuse existing platform detection (e.g., `Capacitor.isNativePlatform()` and `Capacitor.getPlatform() === 'android'` or `isAndroidNative()`) to only attach the back handler inside the Android shell.

## Alternatives Considered
- Alternative: Implement custom native swipe gesture detection in the Android shell and bridge custom events into JavaScript.
  - Rejected because Capacitor already surfaces the Android system back gesture through the App plugin; adding another native gesture path would increase complexity without clear benefit for this use case.

- Alternative: Rely solely on history-based back handling without central coordination.
  - Rejected because it cannot reliably close overlays/modals before navigating, and makes it difficult to ensure that `/chat/<npub>` backs to `/chat` on Android mobile instead of exiting.

## Risks / Trade-offs
- Risk: Misconfigured back handling could trap users (e.g., failing to call `exitApp()` when history cannot go back), causing the back gesture to appear broken.
  - Mitigation: Clearly define and implement the fallback path (history back when possible, otherwise `exitApp()`), and manually test root-level behavior.

- Risk: Overly aggressive back handling could close modals or overlays in unexpected order.
  - Mitigation: Keep the priority order simple and well documented; align it with the visible layering of UI elements.

## Migration Plan
- Implement back handling behind Android-only detection so that web users are unaffected during development.
- Ship as a behavioral improvement without configuration flags, as it aligns with native Android UX expectations and does not change data models or server APIs.

## Open Questions
- Should unsent text in a chat input be preserved when backing from `/chat/<npub>` to `/chat`, or is clearing input acceptable? (Initial implementation can preserve current behavior.)
- Are there any additional global overlays (beyond image viewer and existing modals) that must participate in the Android back priority ordering?
