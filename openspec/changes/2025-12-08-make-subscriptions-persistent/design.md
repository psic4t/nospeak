## Context
The `messaging` spec already defines a "Real-Time Message Subscription and Deduplication" requirement, and the Android background messaging change (`2025-12-08-add-android-background-messaging`) expects that when background messaging is enabled and the Android foreground service is running, real-time subscriptions continue to deliver messages while the app UI is not visible.

In the current implementation, `messagingService.listenForMessages` is invoked from UI-level code (such as chat layouts) and depends on route lifecycle. When the user backgrounds the app or navigates away, the underlying WebView and Svelte components can be paused or unmounted, which effectively stops subscriptions until the UI comes back. The Android foreground service keeps the process alive and shows a persistent notification, but does not itself manage Nostr connections.

## Goals
- Ensure there is exactly one real-time subscription pipeline per logged-in session.
- Start that pipeline from a stable, app-global location (for example, after the ordered login history flow completes, or after session restore), not from a page-level component.
- Keep the pipeline running for as long as the user is logged in and the process is alive, regardless of which route is visible, so that:
  - On Android with background messaging enabled, new messages are received and processed while the app is in the background.
  - On web, behavior remains unchanged but is more robust to navigation.
- Maintain existing deduplication semantics and avoid introducing new polling or history-sync behavior for background mode.

## Non-Goals
- Do not move Nostr relay connections or crypto into native Android code; all messaging logic remains in the JS/TypeScript layer for this change.
- Do not change how history sync, login flows, or relay discovery work beyond the minimum necessary to coordinate with the global subscription startup.
- Do not alter notification content or channels beyond what is already defined by existing specs.

## Approach
- Introduce a global subscription manager concept within the existing messaging/core layer (reusing the current `MessagingService` and connection manager), with explicit `startSubscriptions` / `stopSubscriptions` semantics that are independent of any particular route.
- Wire `AuthService` (or a similar central bootstrap) so that after the ordered login history sync finishes for a user, it triggers `startSubscriptions` exactly once per session.
- Ensure that logout and account-switch flows call `stopSubscriptions` and tear down relay connections, aligning with the Android foreground service teardown from the background messaging change.
- On Android, keep the background messaging feature as a guardrail for when we expect subscriptions to be active in the background: if the user disables background messaging or the OS revokes permissions, we only run subscriptions when the app is in the foreground or in a permitted state.

## Alternatives Considered
- **Native Nostr client in `BackgroundMessagingService`:** Running Nostr relay connections and message handling fully inside the Android service would provide stronger guarantees against WebView throttling, but at the cost of duplicating much of the messaging logic in Kotlin/Java and complicating key management. This change is intentionally limited to JS-level persistence and does not introduce a native messaging stack.
- **Periodic background polling instead of persistent subscriptions:** Using alarms or WorkManager jobs to periodically poll for messages would be more battery friendly in some cases but does not align with Nostr's event-driven model and increases complexity in deduplication and state management. The foreground service plus long-lived subscriptions approach is more consistent with existing requirements.

## Risks
- On some devices or OEMs, even with a foreground service, Android may still throttle or pause the WebView/JS runtime under heavy battery optimization, which could still delay message delivery. This proposal does not fully eliminate OEM-specific behavior but aligns the implementation with platform expectations and the existing spec.
- A global subscription pipeline must be carefully coordinated with session state; bugs in startup/teardown ordering could lead to duplicate subscriptions or stale connections if not tested thoroughly.

## Open Questions
- Do we need explicit UI feedback to indicate that background subscriptions are active (beyond the foreground notification on Android), or is the existing Android notification plus message arrival semantics sufficient?
- Should we consider adding minimal metrics or logging hooks (non-spec) to understand background subscription uptime and reconnection behavior across devices?
