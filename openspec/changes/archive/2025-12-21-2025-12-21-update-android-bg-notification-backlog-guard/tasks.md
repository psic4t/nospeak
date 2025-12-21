## 1. Implementation
- [x] Add persisted notification baseline fields in `AndroidBackgroundMessagingPrefs` (baseline seconds, optional last-notified seconds).
- [x] Update `AndroidBackgroundMessagingPlugin.start(...)` to set a cold-start baseline at enable time (with small grace).
- [x] Update `NativeBackgroundMessagingService` to:
  - [x] Parse inner rumor `created_at` when decrypting.
  - [x] Compute `effectiveCutoffSeconds = max(persistedBaselineSeconds, nowSeconds - 15*60)` on start.
  - [x] Suppress notifications for rumors older than the cutoff.
  - [x] Advance and persist the baseline when notifications are emitted.
- [x] Ensure behavior remains compatible with randomized gift-wrap timestamps (avoid relying on outer `created_at` or strict `since now`).

## 2. Validation
- [x] Run `npm run check`.
- [x] Run `npx vitest run`.
- [ ] Android smoke check (local): start background messaging, restart service, verify no historical flood and recent notifications still fire.

## 3. Acceptance Checks
- [ ] First enable after login/initial sync: no notifications for pre-existing history.
- [ ] Service restart (boot/app update/process kill): notifications are eligible only for messages with inner rumor timestamps within last 15 minutes.
- [ ] No regressions: new live messages still notify when the app UI is not visible.
