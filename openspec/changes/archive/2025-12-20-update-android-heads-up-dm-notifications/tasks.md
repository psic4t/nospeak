## 1. Implementation
- [x] 1.1 Update Android message notification channel defaults (IMPORTANCE_HIGH, sound/vibration, lockscreen visibility) in `NativeBackgroundMessagingService`.
- [x] 1.2 Add testing-stage channel recreation (delete + recreate message channel on service start).
- [x] 1.3 Restrict background-service notifications to decrypted DMs only (Amber-only, kinds 14 and 15) and suppress reactions/generic fallback.
- [x] 1.4 Update Android notification builder to prefer Heads-Up presentation (priority/category/visibility).
- [ ] 1.5 Manual Android verification: confirm Heads-Up pop appears when app not visible; confirm no reaction/generic notifications.

## 2. Validation
- [x] 2.1 Run `npm run check`.
- [x] 2.2 Run `npx vitest run`.
