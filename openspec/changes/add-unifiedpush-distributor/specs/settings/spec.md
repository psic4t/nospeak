### Requirement: UnifiedPush Settings Category
The Settings interface SHALL provide a "UnifiedPush" category (Android-only) that allows users to configure nospeak as a UnifiedPush distributor. This category SHALL be visible only when running inside the Android Capacitor app shell and SHALL allow users to configure an ntfy-compatible server URL, enable/disable UnifiedPush functionality, manage user-defined topics, view registered apps, and test the connection.

#### Scenario: UnifiedPush category visible only on Android
- **GIVEN** the user is running nospeak inside the Android Capacitor app shell
- **WHEN** the user opens the Settings modal
- **THEN** the Settings sidebar/categories SHALL contain a "UnifiedPush" entry
- **AND** this entry SHALL NOT be visible on web or PWA platforms.

#### Scenario: UnifiedPush category shows server URL configuration
- **GIVEN** the user has selected the "UnifiedPush" category in Settings (Android-only)
- **WHEN** the UnifiedPush settings view is rendered
- **THEN** it SHALL display a server URL input field for the ntfy-compatible server
- **AND** the URL SHALL be validated to ensure it uses HTTPS or WSS protocol.

#### Scenario: User enables UnifiedPush with server URL
- **GIVEN** the user has opened Settings → UnifiedPush (Android-only)
- **AND** UnifiedPush is currently disabled
- **WHEN** the user enters a valid server URL (HTTPS/WSS) and enables UnifiedPush
- **THEN** the system SHALL start the Android UnifiedPushService foreground service
- **AND** the service SHALL connect to the configured ntfy-compatible server via WebSocket
- **AND** the enabled state and server URL SHALL be persisted to localStorage and SharedPreferences.

#### Scenario: User disables UnifiedPush
- **GIVEN** the user is running nospeak inside the Android Capacitor app shell
- **AND** UnifiedPush is currently enabled
- **WHEN** the user disables UnifiedPush in Settings
- **THEN** the Android UnifiedPushService SHALL be stopped
- **AND** any active WebSocket connections to the ntfy server SHALL be closed
- **AND** the disabled state SHALL be persisted.

#### Scenario: UnifiedPush requires notifications to be enabled
- **GIVEN** the user is running nospeak inside the Android Capacitor app shell
- **AND** Notifications are disabled in Settings → General
- **WHEN** the user attempts to enable UnifiedPush
- **THEN** the system SHALL prevent enabling UnifiedPush
- **AND** SHALL display a message indicating that notifications must be enabled first.

### Requirement: UnifiedPush Topic Management
The UnifiedPush settings interface SHALL allow users to add and remove user-defined topics (simple text strings like "alerts", "backups") up to a maximum of 20 topics. Topics SHALL be persisted locally and used to subscribe to the ntfy-compatible server. When no topics exist, a default "test-topic" SHALL be added automatically.

#### Scenario: Default test-topic is added when no topics exist
- **GIVEN** the user has enabled UnifiedPush and configured a server URL
- **AND** no user-defined topics have been created
- **WHEN** the UnifiedPush settings view is rendered
- **THEN** "test-topic" SHALL appear in the topic list
- **AND** the service SHALL subscribe to "test-topic" on the ntfy server.

#### Scenario: User adds a topic
- **GIVEN** the user has opened Settings → UnifiedPush
- **AND** the current topic list has fewer than 20 topics
- **WHEN** the user enters a topic name and adds it
- **THEN** the new topic SHALL be added to the topic list
- **AND** the Android UnifiedPushService SHALL subscribe to the new topic on the ntfy server
- **AND** the updated topic list SHALL be persisted.

#### Scenario: User removes a topic
- **GIVEN** the user has opened Settings → UnifiedPush
- **AND** the topic list contains one or more topics
- **WHEN** the user removes a topic from the list
- **THEN** the topic SHALL be removed from the topic list
- **AND** the Android UnifiedPushService SHALL unsubscribe from the removed topic
- **AND** the updated topic list SHALL be persisted.

#### Scenario: Topic limit enforced at 20 topics
- **GIVEN** the user has opened Settings → UnifiedPush
- **AND** the topic list contains 20 topics
- **WHEN** the user attempts to add another topic
- **THEN** the system SHALL prevent adding the topic
- **AND** SHALL display a message indicating the 20 topic limit has been reached.

### Requirement: UnifiedPush Registered Apps Display
The UnifiedPush settings interface SHALL display a read-only list of apps that have registered with nospeak as their UnifiedPush distributor. Each entry SHALL show the app's package name, registration message (if provided), and the generated endpoint URL.

#### Scenario: Registered apps list is displayed
- **GIVEN** one or more UnifiedPush-enabled apps have registered with nospeak
- **WHEN** the user opens Settings → UnifiedPush
- **THEN** the view SHALL display a list of registered apps
- **AND** each entry SHALL show the app's package name
- **AND** each entry SHALL show the registration message (if provided by the app)
- **AND** each entry SHALL show the generated endpoint URL
- **AND** the list SHALL be read-only (users cannot manually add/remove apps).

### Requirement: UnifiedPush Test Push Button
The UnifiedPush settings interface SHALL provide a "Test Push" button that sends a test message to the configured ntfy server's "test-topic". This button SHALL only be enabled when UnifiedPush is enabled and a server URL is configured.

#### Scenario: Test Push sends test message
- **GIVEN** the user has enabled UnifiedPush and configured a server URL
- **WHEN** the user taps the "Test Push" button
- **THEN** the system SHALL send a test message to "test-topic" on the configured ntfy server
- **AND** upon receiving the message, the Android UnifiedPushService SHALL display a notification
- **AND** the test message SHALL be distinguishable as a test (e.g., title "Test Push", content "Connection successful").

#### Scenario: Test Push disabled when UnifiedPush not configured
- **GIVEN** UnifiedPush is disabled or no server URL is configured
- **WHEN** the UnifiedPush settings view is rendered
- **THEN** the "Test Push" button SHALL be disabled
- **AND** a helper message SHALL indicate that UnifiedPush must be enabled and a server URL configured first.

### Requirement: UnifiedPush Error Notification
When the Android UnifiedPushService cannot connect to the configured ntfy server (network error, server unavailable, invalid URL), the system SHALL display an error notification indicating the connection failure. The error notification SHALL use the same notification channel as DM notifications.

#### Scenario: Error notification on connection failure
- **GIVEN** UnifiedPush is enabled and a server URL is configured
- **WHEN** the Android UnifiedPushService fails to connect to the ntfy server
- **THEN** the system SHALL display an Android notification with an error message
- **AND** the notification SHALL indicate that the ntfy server is unavailable
- **AND** the notification SHALL use the same notification channel as DM notifications
- **AND** the service SHALL attempt to reconnect using exponential backoff.

#### Scenario: Service recovers after connection failure
- **GIVEN** the Android UnifiedPushService previously failed to connect and displayed an error notification
- **WHEN** the service successfully reconnects to the ntfy server
- **THEN** the error notification SHALL be cleared or updated to indicate successful connection
- **AND** normal push notification delivery SHALL resume.
