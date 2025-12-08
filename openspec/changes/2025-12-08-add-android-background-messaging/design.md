## Context
Nospeak is a pull-only encrypted messaging client that talks directly to Nostr relays from the client. The existing Android Capacitor shell embeds the web UI and already supports local notifications for new messages while the app is running in the foreground or lightly backgrounded. However, Android may freely suspend or kill the WebView and JS runtime when the app is backgrounded, especially under battery optimization, which breaks continuous relay subscriptions. The product goal is to "stay connected" to the user's read relays and surface new messages as they arrive, even when the app UI is not visible, without introducing server-side push.

Constraints and assumptions:
- Nospeak remains a pull-only client; there is no push gateway or server component added in this change.
- Background message delivery is best-effort within Android OS limits; we cannot guarantee delivery when the app is force-stopped or background execution is revoked by the system.
- We prefer minimal Android-native code, relying on Capacitor plugins and configuration where possible.

## Goals / Non-Goals
- Goals:
  - Maintain active connections to the user's configured read relays on Android while the app is backgrounded, using Android's foreground service model so the system understands that background work is intentional.
  - Surface a persistent foreground notification that explains that nospeak is syncing messages in the background and shows which relays are currently connected.
  - Reuse existing messaging subscription and notification logic so background delivery shares the same deduplication and LocalNotifications pipeline as foreground delivery.
  - Provide a clear user-facing setting and permission flow that requests background activity in a transparent, consent-based way.
  - Minimize energy impact by avoiding extra polling, batching reconnections, and stopping background work when the user signs out or explicitly disables the feature.
- Non-Goals:
  - Do not add server-side components or push notifications.
  - Do not attempt to bypass Android background execution policies (e.g., ignoring battery optimization or Doze) beyond standard user-approved mechanisms.
  - Do not redesign the overall notification UX; we reuse the existing message notification content and branding.
  - Do not change relay discovery, sync ordering, or message semantics beyond what is required to keep subscriptions alive in the background.

## Decisions
- Decision: Use an Android foreground service (or equivalent Capacitor background mechanism) to host the background messaging task.
  - Rationale: Foreground services are the standard Android pattern for long-running background work that must keep network connections alive, and they require a persistent notification, which matches the product requirement.
- Decision: Reuse the existing real-time subscription and deduplication pipeline from `messaging` for background connections.
  - Rationale: Keeps behavior consistent between foreground and background, avoids duplicating message handling logic, and ensures new messages still go through the same storage and notification paths.
- Decision: Represent background messaging as an explicit per-device preference in Settings (e.g., a "Background messaging" toggle under Settings → General, only visible/active on Android).
  - Rationale: Makes the background behavior opt-in, clearly scoped to the device, and easy to disable without uninstalling the app.
- Decision: When the user opts into background messaging on Android, guide them through OS-level background activity/battery optimization settings rather than attempting to silently request everything.
  - Rationale: Aligns with platform expectations and keeps permission requests understandable.
- Decision: Show the full list of currently connected read relay URLs (up to four) in the Android foreground notification for background messaging.
  - Rationale: There are at most four read relays, so listing them provides clarity without overwhelming the notification UI.
- Decision: Do not add additional user controls (such as "only while charging" or quiet hours) for background messaging in this change; provide a single on/off toggle only.
  - Rationale: Keeps the initial UX simple and matches the current product request; more advanced controls can be added in future changes if needed.
- Alternatives considered:
  - Periodic background fetch via alarms or WorkManager instead of a continuous foreground service: rejected because it risks missing near-real-time messages and complicates relay subscription semantics.
  - Attempting to rely solely on the WebView/JS runtime staying alive in the background without a foreground service: rejected as too fragile under modern Android power management.

## Risks / Trade-offs
- Android may still kill or throttle the foreground service under extreme battery pressure or OEM-specific rules, so "always connected" is still best-effort.
- Keeping WebSocket connections alive in the background consumes battery; we mitigate this with conservative reconnection policies and by limiting work to relay traffic and notifications.
- The persistent foreground notification adds UI noise for users; making the feature opt-in and clearly describing its purpose mitigates confusion.

## Migration Plan
- Introduce background-messaging wiring in the Android shell and hook it into existing messaging initialization flows, behind an environment and settings check so web behavior is unchanged.
- Add the Android-only background messaging setting and permission flow, including copy that explains the trade-offs and how to disable it.
- Roll out behind the new setting, validate behavior on a small set of devices (emulator plus at least one physical phone), and document limitations (e.g., may stop when force-closed or restricted by battery optimizations).

## Open Questions
- Are there specific Android OS versions or OEM behaviors we need to explicitly document as unsupported for continuous background messaging?
