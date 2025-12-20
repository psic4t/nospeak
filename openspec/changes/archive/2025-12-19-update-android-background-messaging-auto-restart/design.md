## Context
Android background messaging is implemented as a native Android foreground service started via a Capacitor plugin from the web runtime. This is sufficient while the user opens the app regularly, but does not survive device reboots or app updates because the WebView/JS runtime is not running to re-issue the `start()` call.

This change adds minimal Android-native wiring so the service can be restarted (best-effort) when Android notifies the app of reboot completion or app replacement.

## Goals / Non-Goals
- Goals:
  - Restart Android background messaging after device reboot once the user unlocks, when the user previously enabled the feature.
  - Restart Android background messaging after app update (`MY_PACKAGE_REPLACED`) when previously enabled.
  - Keep changes minimal and aligned with existing foreground-service design.
  - Improve notification wording when background messaging is enabled but has no configured relays.
- Non-Goals:
  - Do not support Direct Boot (`LOCKED_BOOT_COMPLETED`) or pre-unlock background messaging.
  - Do not attempt to bypass OEM or OS battery restrictions.
  - Do not persist sensitive secrets (for example, do not store an `nsec`).

## Decisions
- Decision: Persist background messaging state/config in Android app-private storage.
  - Rationale: Boot receivers run before the WebView is initialized; they need a native-readable source of truth.
  - Stored data:
    - `enabled` boolean
    - `pubkeyHex` string
    - `readRelays` string list (stored as JSON)
    - `summary` string (for notification)
- Decision: Use `BOOT_COMPLETED` and `MY_PACKAGE_REPLACED` receivers to restart the foreground service.
  - Rationale: These broadcasts are the standard Android hooks for boot-time and post-update restoration.
  - Scope: best-effort; do nothing if background messaging is disabled.
- Decision: Start the service even when no relays are configured, but show explicit notification state.
  - Rationale: Matches product intent that "background messaging is enabled" is a distinct state from "connected".

## Notification Semantics
- If `enabled=true` and the configured relays list is empty, the persistent foreground notification should indicate "No read relays configured".
- If relays exist but none are connected and no reconnect is scheduled, follow the existing "not connected" semantics.

## Risks / Trade-offs
- Android devices that aggressively restrict background execution may still prevent the service from restarting automatically.
- Users who force-stop the app may prevent boot receivers from running until the next manual launch.
- Persisting `pubkeyHex` and relay URLs is low sensitivity but still user data; keep it app-private and minimize what is stored.
