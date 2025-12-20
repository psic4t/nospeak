## 1. Implementation
- [x] 1.1 Add Android app-private persistence for background messaging state and config (enabled flag, pubkey, relays, summary).
- [x] 1.2 Update the Capacitor plugin start/stop/update APIs to write/read persisted state.
- [x] 1.3 Add `BOOT_COMPLETED` receiver to restart the foreground service after reboot (post-unlock).
- [x] 1.4 Add `MY_PACKAGE_REPLACED` receiver to restart the foreground service after app update.
- [x] 1.5 Update the native foreground service to restore from persisted state when restarted with a null intent.
- [x] 1.6 Update foreground notification text for the "no relays configured" case.
- [x] 1.7 Update Android manifest permissions/components (`RECEIVE_BOOT_COMPLETED`, receiver declarations).

## 2. Validation
- [x] 2.1 Run `npm run check`.
- [x] 2.2 Run `npx vitest run`.
- [x] 2.3 Run Android build (for example `./android/gradlew :app:assembleDebug`).

## 3. Manual Android Test Plan
- [x] 3.1 Enable background messaging, confirm persistent notification appears.
- [x] 3.2 Reboot device, unlock, confirm the persistent background messaging notification reappears without opening the app.
- [x] 3.3 Update the app (install a new build over the old one), confirm the service restarts and notification appears.
- [x] 3.4 With background messaging enabled but no messaging/read relays configured, confirm notification shows "No read relays configured".
- [x] 3.5 Disable background messaging, reboot device, confirm no background messaging notification/service is started.
