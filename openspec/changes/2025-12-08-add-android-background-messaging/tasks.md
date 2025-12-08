## 1. Implementation
- [x] 1.1 Add an Android foreground service or Capacitor background messaging mechanism that can host the relay subscription stack while the app UI is not visible.
- [x] 1.2 Wire the foreground service to reuse the existing messaging connection and real-time subscription logic so that background and foreground share the same pipelines and deduplication.
- [x] 1.3 Implement a persistent Android foreground notification for background messaging that displays connected read relay information and uses existing nospeak branding and notification channels.
- [x] 1.4 Extend the Settings → General UI to include an Android-only "Background messaging" preference, including copy that explains its purpose and trade-offs.
- [x] 1.5 Implement the Android permission flow that is triggered when enabling background messaging, guiding users through any required background activity or battery optimization system dialogs.
- [x] 1.6 Ensure that signing out or disabling background messaging cleanly tears down the foreground service, closes relay connections, and removes the foreground notification.
 
## 2. Energy Efficiency and Behavior
- [x] 2.1 Update the messaging reconnection logic to apply conservative backoff behavior when running in background mode on Android.
- [x] 2.2 Verify that no additional periodic polling or history sync jobs are introduced solely for background operation beyond the existing subscription-based model.
 
## 3. Validation
- [x] 3.1 Add or update unit tests for messaging and notification services to cover Android background-enabled behavior (mocking any Capacitor or Android-specific APIs).
- [x] 3.2 Manually verify on an Android emulator and at least one physical device that:
  - Background messaging keeps relay connections active while the foreground service is running.
  - New messages received in the background trigger local notifications and update unread indicators when the app is brought to the foreground.
  - The persistent foreground notification appears while background messaging is active, shows relay connectivity information, and disappears when disabled.
- [x] 3.3 Confirm that web behavior (including Settings and notifications) remains unchanged in standard browsers.

