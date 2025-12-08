## ADDED Requirements
### Requirement: Android Background Message Delivery
When running inside the Android Capacitor app shell with background messaging enabled, the messaging experience on Android SHALL continue to receive and process incoming messages from the user's read relays while the app UI is not visible, using the same real-time subscription and deduplication pipeline as in the foreground, and SHALL trigger local notifications for newly received messages according to the existing notification requirements.

#### Scenario: Background subscriptions deliver new messages on Android
- **GIVEN** the user is logged in and has enabled background messaging in Settings → General while running inside the Android Capacitor app shell
- AND the Android foreground service for background messaging is active
- WHEN a new gift-wrapped message addressed to the current user is delivered from any configured read relay
- THEN the background messaging pipeline SHALL decrypt and save the message to the local database using the same deduplication rules as foreground subscriptions
- AND it SHALL update unread indicators and message history state so that the message appears in the correct conversation when the UI becomes visible again.

#### Scenario: Background delivery triggers Android local notifications
- **GIVEN** the user is running nospeak in the Android app, has enabled message notifications in Settings → General, and Android has granted notification permission
- AND the Android foreground service for background messaging is active
- WHEN a new message for the current user is received via a background subscription while the app UI is not visible
- THEN the messaging pipeline SHALL invoke the existing notification service to show an Android local notification for the new message using the configured notification channel and icon
- AND activating the notification SHALL bring the app to the foreground and navigate to the appropriate conversation, as already defined in the messaging notification requirements.

#### Scenario: Background messaging suspends when not eligible
- **GIVEN** the user is logged out, has disabled background messaging in Settings → General, or Android has revoked required background execution privileges
- WHEN the messaging system evaluates whether to maintain background subscriptions
- THEN it SHALL avoid starting or SHALL stop any background relay subscriptions and foreground services
- AND new-message notifications SHALL only be generated while the app is in an eligible foreground or foreground-capable state as defined by the platform.

### Requirement: Energy-Efficient Background Messaging on Android
The messaging implementation for Android background messaging SHALL minimize energy usage by limiting background work to maintaining relay subscriptions, processing incoming messages, and firing notifications, and SHALL apply conservative reconnection and backoff behavior when connections are lost.

#### Scenario: No extra polling beyond relay subscriptions
- **GIVEN** background messaging is active on Android
- WHEN the app is running in background mode
- THEN the messaging pipeline SHALL avoid scheduling additional periodic polling or history sync jobs solely for background operation
- AND it SHALL rely primarily on real-time subscriptions to receive new messages.

#### Scenario: Conservative reconnection and backoff in background
- **GIVEN** background messaging is active and one or more relay connections are lost due to network changes or OS behavior
- WHEN the messaging pipeline attempts to reconnect to read relays while the app is in the background
- THEN it SHALL use a conservative reconnection strategy (for example, exponential backoff with upper bounds) to limit repeated connection attempts
- AND it SHALL stop attempting reconnections entirely if the user signs out or disables background messaging.
