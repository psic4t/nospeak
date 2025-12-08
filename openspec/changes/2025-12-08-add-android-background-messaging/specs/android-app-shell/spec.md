## ADDED Requirements
### Requirement: Android Background Messaging Foreground Service
The Android Capacitor app shell SHALL provide a background messaging mode that keeps the user's read relays connected while the app UI is not visible by running the messaging stack inside an Android foreground service (or equivalent Capacitor-managed background task) with a persistent notification.

#### Scenario: Foreground service keeps relay connections active
- **GIVEN** the user is running nospeak inside the Android Capacitor app shell
- AND the user has enabled background messaging in Settings → General
- AND Android has granted any required background activity or battery optimization exceptions for the app
- WHEN the user backgrounds the app (for example, by switching to another app or returning to the home screen)
- THEN the app SHALL start or maintain a foreground-capable background task that keeps WebSocket connections to the user's configured read relays active
- AND the background task SHALL reuse the same real-time subscription pipeline defined in the `messaging` spec for receiving and processing messages.

#### Scenario: Background messaging stops when disabled or user signs out
- **GIVEN** background messaging is currently active for the Android app
- WHEN the user either signs out of nospeak or disables background messaging in Settings → General
- THEN the app SHALL stop the background messaging foreground service (or equivalent task)
- AND it SHALL close the associated relay connections
- AND it SHALL remove the persistent foreground notification associated with background messaging.

### Requirement: Persistent Android Foreground Notification for Background Messaging
When Android background messaging is active, the Android app shell SHALL display a persistent foreground notification indicating that nospeak is connected to the user's read relays, including a summary of which relays are connected, and SHALL keep this notification visible as long as background messaging is running.

#### Scenario: Foreground notification shows connected relay summary
- **GIVEN** the Android foreground service for background messaging is running
- WHEN the foreground notification for nospeak is displayed in the Android notification shade
- THEN the notification SHALL indicate that nospeak is syncing messages in the background
- AND it SHALL display the list of connected read relay URLs (up to four entries corresponding to the user's configured read relays)
- AND it SHALL use nospeak branding and iconography consistent with the existing Android local notification and visual-design requirements.

#### Scenario: Foreground notification persists while background messaging is active
- **GIVEN** background messaging is enabled and the foreground service is running
- WHEN the user expands or collapses the Android notification shade
- THEN the notification entry for nospeak background messaging SHALL remain visible and non-dismissible by default while the foreground service is active
- AND the notification SHALL be removed when background messaging stops or is disabled by the user.

#### Scenario: Web behavior unchanged outside Android shell
- **GIVEN** the user is accessing nospeak in a standard web browser rather than the Android app shell
- WHEN they enable or disable message notifications or other messaging settings
- THEN no Android-specific foreground service or persistent notification SHALL be created
- AND notification behavior SHALL remain as defined by the existing web messaging specification.
