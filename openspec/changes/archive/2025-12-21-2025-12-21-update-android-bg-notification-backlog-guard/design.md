# Design: Android Background Messaging Notification Backlog Guard

## Context
The Android background messaging implementation runs a native foreground service which:
- maintains relay connections,
- decrypts NIP-17 gift-wrap events,
- emits Android OS notifications when the WebView is not visible.

Some relays may send large volumes of historical gift-wrap events on subscription. Additionally, the NIP-59-style gift-wrap event `created_at` timestamp may be randomized/backdated, so using an outer `since` filter can accidentally exclude legitimate new deliveries.

## Goals
- Eliminate notification floods caused by historical replay on first enable.
- Prevent notification floods on service restart.
- Preserve compatibility with randomized gift-wrap timestamps.

## Key Decision: Use the *inner rumor* timestamp
- The native service MUST NOT rely on the gift-wrap event `created_at` for notification eligibility.
- The service SHALL prefer the decrypted inner rumor `created_at` timestamp (when available) for deciding whether an incoming DM is "recent".
- If the rumor timestamp is missing/unparseable, the service MAY fall back to treating it as "now" for notification eligibility.

Rationale:
- The outer gift-wrap timestamp can be randomized.
- The inner rumor timestamp more closely represents when the user-visible DM content was authored.

## Notification Baseline & Cutoff Model
Define a persisted "notification baseline" timestamp (epoch seconds) that establishes the earliest rumor timestamp eligible to trigger notifications.

### Baseline types
1. **Cold start baseline** (first explicit enable)
   - When Android background messaging is explicitly started from the WebView after login (Capacitor plugin `start(...)`), the service persists a baseline near "now".
   - This suppresses notifications for all pre-existing history.

2. **Warm start baseline** (service restart)
   - When the native service starts via boot/package-replace/process restart, it loads the persisted baseline.
   - It also applies an additional cap so that the effective cutoff is never older than `now - 15 minutes`.

### Effective cutoff
`effectiveCutoffSeconds = max(persistedBaselineSeconds, nowSeconds - 15*60)`

### Grace window
To avoid missing a DM created very near the moment background messaging is enabled, the service may apply a small grace window (e.g. 60 seconds) when establishing the cold start baseline.

## Backlog suppression mechanics
- The service continues to treat pre-EOSE subscription deliveries as history (no notifications), but also applies the effective cutoff to any post-EOSE/live deliveries.
- The cutoff is evaluated using the decrypted inner rumor timestamp.

## State persistence
Persist the following in Android `SharedPreferences`:
- `notificationBaselineSeconds`
- Optionally, `lastNotifiedRumorCreatedAtSeconds` (to advance baseline as notifications fire)

### Advancing the baseline
When a notification is emitted for a rumor with `rumorCreatedAtSeconds`, the service updates persisted baseline:
`notificationBaselineSeconds = max(notificationBaselineSeconds, rumorCreatedAtSeconds)`

This reduces duplicate notifications across reconnects.

## Trade-offs
- Using the inner rumor timestamp can still suppress notifications for messages whose rumor timestamps are far in the past. This is acceptable for backlog protection and aligns with the requirement to avoid floods.
- This change prioritizes "no notification spam" over "notify for all historical unread items".
