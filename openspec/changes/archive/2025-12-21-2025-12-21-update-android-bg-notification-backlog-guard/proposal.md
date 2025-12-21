# Change: Prevent Android Background Messaging Notification Backlog Flood

## Why
Android background messaging can emit hundreds of OS notifications for historical messages immediately after first login + initial sync, and sometimes after the native background messaging service restarts. This creates a noisy, low-signal user experience and can cause users to disable notifications entirely.

## What Changes
- Add a notification "baseline" (cutoff) for the Android-native background messaging foreground service so that only eligible, recent conversation activity can produce OS notifications.
- Treat the first explicit enablement of Android background messaging (typically immediately after login) as a cold start that suppresses notifications for all pre-existing messages.
- On subsequent service restarts (boot, app update, process restart), cap backlog notification eligibility to a maximum age window (15 minutes) so users do not receive large notification floods.
- Ensure backlog suppression is compatible with NIP-59/NIP-17 gift-wrap timestamp randomization by using the decrypted inner rumor timestamp for eligibility decisions rather than the outer gift-wrap event timestamp.

## Impact
- Affected specs: `android-app-shell`, `messaging`
- Affected code (expected):
  - `android/app/src/main/java/com/nospeak/app/NativeBackgroundMessagingService.java`
  - `android/app/src/main/java/com/nospeak/app/AndroidBackgroundMessagingPrefs.java`
  - `android/app/src/main/java/com/nospeak/app/AndroidBackgroundMessagingPlugin.java`
- User-facing behavior:
  - After first login/enable, historical messages do not generate Android OS notification spam.
  - After background service restarts, only recently-timed conversation activity (<= 15 minutes) is eligible to notify.

## Non-Goals
- This change does not modify message persistence, sync correctness, or unread indicators.
- This change does not add new UI settings; the behavior is automatic.
