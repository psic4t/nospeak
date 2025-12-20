# Change: Update Android background DM notifications to Heads-Up

## Why
Android background message notifications are currently easy to miss because the native background service posts notifications using default importance and may emit generic / reaction notifications that create noise. During testing we want prominent Heads-Up notifications for new decrypted DMs delivered via Amber.

## What Changes
- Update the Android native background messaging service to post **Heads-Up eligible** notifications for new decrypted DMs (and DM attachments) when running in Amber mode.
- Configure the Android message notification channel to default to **high importance with sound + vibration**, and allow lockscreen content previews (subject to the user’s Android privacy settings).
- Suppress Android-background-service notifications for:
  - NIP-25 reactions (`kind 7`)
  - generic “new encrypted message” fallback when decryption is unavailable or fails
- Testing-stage behavior: delete + recreate the Android message notification channel at service startup to ensure testers receive the new defaults immediately.

## Impact
- Affected specs:
  - `openspec/specs/messaging/spec.md`
- Affected code:
  - `android/app/src/main/java/com/nospeak/app/NativeBackgroundMessagingService.java`
- User impact:
  - New decrypted DM notifications become more prominent (Heads-Up + sound/vibration by default).
  - Users can still override notification behavior in Android Settings per-channel (importance, sound, vibration, lockscreen visibility).
  - **Testing note:** because the channel is deleted + recreated on service start, any per-channel customization will be reset whenever the background service starts (for example after app restart or toggling background messaging).
