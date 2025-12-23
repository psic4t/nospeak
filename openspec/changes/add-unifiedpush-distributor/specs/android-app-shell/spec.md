### Requirement: UnifiedPush Distributor Implementation
When running inside the Android Capacitor app shell, nospeak SHALL act as a UnifiedPush distributor, allowing other UnifiedPush-enabled apps to register for push notifications through nospeak. The Android app shell SHALL implement the UnifiedPush distributor specification, including registration handling, endpoint generation, message forwarding, and deep link support.

#### Scenario: App registers with nospeak as UnifiedPush distributor
- **GIVEN** nospeak is installed and configured as a UnifiedPush distributor
- **AND** another UnifiedPush-enabled app (e.g., Mastodon, Tusky) sends a broadcast with action `org.unifiedpush.android.distributor.REGISTER`
- **WHEN** the broadcast is received
- **THEN** the `AndroidUnifiedPushDistributorReceiver` SHALL generate a unique endpoint for the app
- **AND** SHALL store the registration mapping (token → {packageName, vapidKey, message})
- **AND** SHALL reply with a broadcast with action `org.unifiedpush.android.connector.NEW_ENDPOINT` containing the endpoint URL.

#### Scenario: App unregisters from nospeak
- **GIVEN** an app has previously registered with nospeak as its UnifiedPush distributor
- **WHEN** the app sends a broadcast with action `org.unifiedpush.android.distributor.UNREGISTER`
- **THEN** the `AndroidUnifiedPushDistributorReceiver` SHALL remove the registration for the app
- **AND** SHALL reply with a broadcast with action `org.unifiedpush.android.connector.UNREGISTERED`.

#### Scenario: App acknowledges message delivery
- **GIVEN** an app has received a push notification from nospeak
- **WHEN** the app sends a broadcast with action `org.unifiedpush.android.distributor.MESSAGE_ACK`
- **THEN** the `AndroidUnifiedPushDistributorReceiver` SHALL acknowledge the message delivery
- **AND** SHALL update any internal delivery tracking state as needed.

#### Scenario: Deep link handler sets nospeak as default distributor
- **GIVEN** nospeak is installed on the device
- **WHEN** a UnifiedPush-enabled app launches a deep link with scheme `unifiedpush://link`
- **THEN** the `AndroidUnifiedPushDistributorLinkActivity` SHALL be launched
- **AND** SHALL return `RESULT_OK` with a pending intent containing the package name
- **AND** the calling app SHALL be able to set nospeak as its default distributor.

### Requirement: UnifiedPush Service and WebSocket Connection
When UnifiedPush is enabled and a server URL is configured, the Android UnifiedPushService SHALL maintain a WebSocket connection to the configured ntfy-compatible server, subscribe to user-defined topics, receive messages, and forward them to registered apps.

#### Scenario: Service starts and connects to ntfy server
- **GIVEN** the user has enabled UnifiedPush in Settings
- **AND** a valid ntfy-compatible server URL is configured
- **WHEN** the `AndroidUnifiedPushService` is started
- **THEN** the service SHALL establish a WebSocket connection to `wss://<server>/ws` (or per-topic WebSocket)
- **AND** SHALL subscribe to all user-defined topics (including default "test-topic")
- **AND** SHALL display a persistent foreground notification showing connection status
- **AND** SHALL continue running as a foreground service with `foregroundServiceType="dataSync"`.

#### Scenario: Service receives message from ntfy server
- **GIVEN** the `AndroidUnifiedPushService` is connected to an ntfy server
- **AND** a message is received for a subscribed topic
- **WHEN** the message JSON is parsed (containing id, time, event, topic, message, title, priority, tags, etc.)
- **THEN** the service SHALL generate an Android notification for the message
- **AND** SHALL use the same notification channel as DM notifications
- **AND** SHALL support ntfy features (priority, tags, title, click actions)
- **AND** if the message is for a registered app, SHALL forward via broadcast with action `org.unifiedpush.android.connector.MESSAGE`.

#### Scenario: Service reconnects after connection loss
- **GIVEN** the `AndroidUnifiedPushService` is connected to an ntfy server
- **WHEN** the WebSocket connection is lost (network error, server restart, etc.)
- **THEN** the service SHALL attempt to reconnect using exponential backoff
- **AND** SHALL update the persistent foreground notification to show reconnecting state
- **AND** SHALL continue attempting reconnection until UnifiedPush is disabled
- **OR** until a maximum number of retry attempts is reached (deployment-configurable).

#### Scenario: Service stops when UnifiedPush disabled
- **GIVEN** the `AndroidUnifiedPushService` is running and connected
- **WHEN** the user disables UnifiedPush in Settings
- **THEN** the service SHALL close all WebSocket connections
- **AND** SHALL stop the foreground service
- **AND** SHALL clear the persistent foreground notification
- **AND** SHALL persist the disabled state.

### Requirement: UnifiedPush Notifications with ntfy Features
The Android UnifiedPushService SHALL display notifications for received messages with full support for ntfy features including priority, tags, title, click actions, and attachments. Notifications SHALL use the same channel as DM notifications.

#### Scenario: Notification displays message with priority
- **GIVEN** the `AndroidUnifiedPushService` receives a message with priority field (1-5, where 5 is highest)
- **WHEN** the notification is generated
- **THEN** the notification SHALL use Android notification priority appropriate to the ntfy priority value
- **AND** SHALL maintain consistency with DM notification behavior.

#### Scenario: Notification displays message with tags
- **GIVEN** the `AndroidUnifiedPushService` receives a message with a tags array (e.g., ["warning", "skull"])
- **WHEN** the notification is generated
- **THEN** the notification content SHALL include the tags
- **AND** tags MAY be rendered as emojis if they map to known emoji names (ntfy convention)
- **AND** SHALL use the same notification channel as DM notifications.

#### Scenario: Notification displays message with title
- **GIVEN** the `AndroidUnifiedPushService` receives a message with a title field
- **WHEN** the notification is generated
- **THEN** the notification SHALL display the title as the notification title
- **AND** the message body SHALL be displayed as the notification text
- **AND** SHALL use the same notification channel as DM notifications.

#### Scenario: Notification supports click action
- **GIVEN** the `AndroidUnifiedPushService` receives a message with a click URL field
- **WHEN** the notification is generated
- **THEN** tapping the notification SHALL open the click URL in the system browser
- **AND** SHALL use the same notification channel as DM notifications.

### Requirement: UnifiedPush Persistent Configuration Storage
The Android UnifiedPush implementation SHALL persist all configuration and state in SharedPreferences so that it survives app restarts, device reboots, and app updates without requiring WebView initialization.

#### Scenario: Settings persisted to SharedPreferences
- **GIVEN** the user configures UnifiedPush settings (enabled, server URL, topics)
- **WHEN** the settings are saved
- **THEN** the enabled state SHALL be persisted in SharedPreferences key `unifiedpush_enabled`
- **AND** the server URL SHALL be persisted in SharedPreferences key `unifiedpush_server_url`
- **AND** the topics array SHALL be persisted in SharedPreferences key `unifiedpush_topics` (JSON string)
- **AND** the registrations mapping SHALL be persisted in SharedPreferences key `unifiedpush_registrations` (JSON object).

#### Scenario: Service restores configuration on startup
- **GIVEN** the user previously configured and enabled UnifiedPush
- **WHEN** the Android app starts or restarts (including after device reboot or app update)
- **THEN** the `AndroidUnifiedPushService` SHALL read the persisted configuration from SharedPreferences
- **AND** if enabled is true and a server URL is configured, the service SHALL start automatically
- **AND** SHALL connect to the server and subscribe to persisted topics
- **AND** SHALL restore registered app mappings for message forwarding.

### Requirement: UnifiedPush Service Coexistence with Background Messaging
The Android UnifiedPushService SHALL run independently of the existing Background Messaging service, both as separate foreground services, but SHALL share the same notification channel for all notifications.

#### Scenario: Both services can run simultaneously
- **GIVEN** the user has enabled both Background Messaging and UnifiedPush
- **WHEN** the Android app is running
- **THEN** both `AndroidBackgroundMessagingPlugin` and `AndroidUnifiedPushService` SHALL be active as separate foreground services
- **AND** each service SHALL maintain its own WebSocket connections (to Nostr relays and ntfy server respectively)
- **AND** both services SHALL use the same notification channel for emitting notifications
- **AND** each service SHALL display its own persistent foreground notification.

#### Scenario: Stopping one service does not affect the other
- **GIVEN** both Background Messaging and UnifiedPush services are running
- **WHEN** the user disables Background Messaging (or UnifiedPush)
- **THEN** the disabled service SHALL stop
- **AND** the other service SHALL continue running without interruption
- **AND** notifications from the remaining service SHALL continue to appear normally.

### Requirement: UnifiedPush Plugin API
The Android app shell SHALL expose a Capacitor plugin `AndroidUnifiedPushPlugin` that allows the WebView to control UnifiedPush functionality, including starting/stopping the service, managing topics, and querying registrations.

#### Scenario: Plugin starts UnifiedPush service
- **GIVEN** the WebView calls `AndroidUnifiedPushPlugin.start(serverUrl, topics)`
- **WHEN** the plugin method is invoked
- **THEN** the plugin SHALL persist the server URL and topics to SharedPreferences
- **AND** SHALL start the `AndroidUnifiedPushService` foreground service
- **AND** the service SHALL connect to the ntfy server and subscribe to topics
- **AND** the plugin SHALL return success or an error message.

#### Scenario: Plugin adds a topic
- **GIVEN** the WebView calls `AndroidUnifiedPushPlugin.addTopic(topic)`
- **WHEN** the plugin method is invoked
- **AND** the current topic count is less than 20
- **THEN** the plugin SHALL add the topic to the persisted topics array
- **AND** if the service is running, SHALL subscribe to the new topic on the ntfy server
- **AND** the plugin SHALL return success or an error message.

#### Scenario: Plugin removes a topic
- **GIVEN** the WebView calls `AndroidUnifiedPushPlugin.removeTopic(topic)`
- **WHEN** the plugin method is invoked
- **AND** the topic exists in the persisted topics array
- **THEN** the plugin SHALL remove the topic from the persisted topics array
- **AND** if the service is running, SHALL unsubscribe from the topic on the ntfy server
- **AND** the plugin SHALL return success or an error message.

#### Scenario: Plugin queries registrations
- **GIVEN** the WebView calls `AndroidUnifiedPushPlugin.getRegistrations()`
- **WHEN** the plugin method is invoked
- **THEN** the plugin SHALL return an array of registered apps with packageName, message, and endpoint
- **AND** SHALL include all apps that have registered and not yet unregistered.
