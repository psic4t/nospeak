# Change: Restart Android background messaging after device reboot and app update

## Why
Android background messaging is implemented as a native foreground service that is started from the web runtime via a Capacitor plugin. After a device reboot (or after an app update), the web runtime is not running, so the foreground service is never started again even when the user previously enabled background messaging. This causes missed background notifications until the user manually opens the app.

## What Changes
- Persist the Android background messaging "enabled" state and the minimal service start configuration in Android app-private storage so native components can read it without starting the WebView.
- Add an Android `BOOT_COMPLETED` receiver that (best-effort) restarts the background messaging foreground service after device reboot once the user has unlocked their profile.
- Add an Android `MY_PACKAGE_REPLACED` receiver that (best-effort) restarts the service after an app update for users who previously enabled background messaging.
- Improve the persistent foreground notification wording when background messaging is enabled but no read relays are configured (show "No read relays configured").

## Impact
- Affected specs: `android-app-shell`, `settings`.
- Affected code (implementation stage): Android Capacitor shell (`android/app/src/main/...`), plus the existing TypeScript bridge that starts/stops the native service (`src/lib/core/BackgroundMessaging.ts`).
- User impact: Android users who enable background messaging should continue to receive background message notifications after a reboot or app update without needing to manually open the app.
- Limitations: This remains best-effort under Android power management. The service may not restart if the user force-stops the app or if OEM-specific background restrictions block startup.
