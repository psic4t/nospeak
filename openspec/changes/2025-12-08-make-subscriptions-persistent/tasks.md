## 1. Implementation
- [x] 1.1 Identify all current entry points where real-time message subscriptions (`listenForMessages` or equivalent) are started or stopped, including any route-level Svelte components and messaging bootstrap code.
- [x] 1.2 Introduce an app-global subscription control in the messaging core (for example, a `startSubscriptions` / `stopSubscriptions` API on `MessagingService`) that encapsulates creation and teardown of real-time subscriptions.
- [x] 1.3 Wire `AuthService` (or equivalent session bootstrap) to call the global subscription start API once the ordered login history flow or session-restore flow completes, ensuring only one pipeline per logged-in user.
- [x] 1.4 Remove or refactor route-level subscription startup/teardown so that individual pages or layouts no longer directly control the lifetime of the real-time subscription pipeline.
- [x] 1.5 Ensure logout, account-switch, and Android background messaging disable flows call the global subscription stop API and close associated relay connections.
 
## 2. Android Background Integration
- [x] 2.1 Verify that when Android background messaging is enabled and the foreground service is running, the app-global subscription pipeline remains active while the app process is alive and continues to receive and process new messages.
- [x] 2.2 Confirm that disabling background messaging or signing out on Android stops both the foreground service and the app-global subscription pipeline.
 
## 3. Validation
- [x] 3.1 Add or update unit tests for `MessagingService` (or equivalent) to cover the app-global subscription lifecycle (single instance, correct start/stop behavior, idempotent calls).
- [x] 3.2 Manually test on Android devices that:
  - New messages arrive and trigger Android local notifications while the app is backgrounded and the background messaging foreground service is active.
  - Messages continue to appear in the correct conversations without requiring the user to reopen the app.
- [x] 3.3 Confirm that web behavior remains unchanged for users in standard browsers (subscriptions still deliver messages in real time and are not broken by navigation).

