# Change: Make message subscriptions persistent across app lifecycle on Android

## Why
The existing Android background messaging change adds a foreground service and persistent notification, but real-time Nostr relay subscriptions are still effectively tied to the Svelte UI lifecycle. When the nospeak app is backgrounded, the WebView and route components may be paused or unmounted, causing `listenForMessages` and related subscriptions to stop. As a result, the Android foreground service can remain active without actually keeping WebSocket connections to the user's read relays alive, and new messages only appear (and trigger notifications) once the app UI is reopened.

To deliver reliable background message delivery consistent with nospeak's pull-only model, we need to ensure that relay subscriptions and the message processing pipeline are app-global and long-lived for the duration of a logged-in session, independent of which route is currently visible, while still respecting Android power management and user preferences.

## What Changes
- Make the real-time message subscription (`listenForMessages` and related wiring) an app-global, single-instance service that is started when the messaging environment is ready (for example, after login history flow completes or a session is restored) and remains active for the entire logged-in session, not tied to a specific chat route or component.
- Ensure that on Android, when background messaging is enabled and the foreground service is running, the app's relay connections and real-time subscriptions remain active while the app process is alive, so that new messages are received and processed in the background as long as the OS allows.
- Define clear teardown behavior so that relay connections and subscriptions are stopped cleanly on logout, account switch, or when background messaging is disabled, without relying on route unmounts.
- Keep the implementation consistent with the existing `messaging` spec and the `2025-12-08-add-android-background-messaging` change: no new polling or history jobs for background mode, and reuse the existing deduplication and notification pipeline.

## Impact
- Specs: `messaging`, `android-app-shell` (as a refinement of the previous Android background messaging behavior).
- Code (for later implementation):
  - `src/lib/core/Messaging.ts` / `MessagingService` startup and subscription wiring.
  - Startup/navigation/layout wiring where `listenForMessages` is currently invoked (for example, `src/routes/chat/+layout.svelte` and any global layout or auth bootstrap code).
  - `src/lib/core/AuthService.ts` integration so that subscriptions start once the login history sync completes and stop cleanly on logout.
  - No changes to server components; this remains a client-only, pull-based design.
