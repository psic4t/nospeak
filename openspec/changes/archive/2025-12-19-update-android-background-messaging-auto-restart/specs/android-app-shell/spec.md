## ADDED Requirements
### Requirement: Android Background Messaging Auto-Restart After Device Restart
When running inside the Android Capacitor app shell, the system SHALL restore Android background messaging after a device restart or app update for users who previously enabled background messaging. The Android shell SHALL persist the background messaging enabled state and the minimal service start configuration (for example, public key and configured read relay URLs) in Android app-private storage so that native components can read it without requiring the WebView to start. After Android delivers `BOOT_COMPLETED`, the shell SHALL (best-effort) restart the native background messaging foreground service once the user has unlocked their profile. After Android delivers `MY_PACKAGE_REPLACED`, the shell SHALL (best-effort) restart the service if background messaging remains enabled.

This restoration behavior SHALL be best-effort and SHALL NOT attempt to bypass Android background execution policies. If the user force-stops the app or the OS blocks background execution, the service MAY not restart until the user manually opens the app again.

#### Scenario: Service restarts after device reboot
- **GIVEN** the user previously enabled background messaging in Settings → General while running inside the Android Capacitor app shell
- **AND** the Android app has previously persisted the background messaging enabled state and required configuration in app-private storage
- **WHEN** the device reboots and the user unlocks their Android profile
- **THEN** the Android app shell SHALL start the native background messaging foreground service without requiring the WebView to be opened
- **AND** the persistent foreground notification for background messaging SHALL be displayed.

#### Scenario: Service restarts after app update
- **GIVEN** the user previously enabled background messaging in Settings → General while running inside the Android Capacitor app shell
- **AND** the Android app has previously persisted the background messaging enabled state and required configuration in app-private storage
- **WHEN** the app is updated and Android delivers `MY_PACKAGE_REPLACED` for the nospeak package
- **THEN** the Android app shell SHALL (best-effort) start the native background messaging foreground service
- **AND** the persistent foreground notification for background messaging SHALL be displayed.

#### Scenario: Service does not restart when background messaging is disabled
- **GIVEN** the user has disabled background messaging in Settings → General
- **WHEN** the device reboots or the app is updated
- **THEN** the Android app shell SHALL NOT start the native background messaging foreground service.

#### Scenario: Service starts when no read relays are configured
- **GIVEN** the user previously enabled background messaging in Settings → General
- **AND** the Android app has persisted the enabled state but has no configured read relay URLs available (for example, the list is empty)
- **WHEN** the native background messaging foreground service is started or restored (including after reboot)
- **THEN** the service SHALL remain running with its persistent notification
- **AND** the foreground notification text SHALL indicate that no relays are configured (for example, "No read relays configured")
- **AND** the service SHALL NOT attempt to establish relay WebSocket connections until one or more relay URLs are configured.

## MODIFIED Requirements
### Requirement: Android Background Messaging Notification Health State
The Android Capacitor app shell foreground notification for background messaging SHALL reflect the current health of background relay connections instead of always claiming that nospeak is connected. While the native foreground service is running, the notification text SHALL indicate when at least one read relay connection is active, MAY indicate when the service is attempting to reconnect to relays after connection loss, and SHALL avoid implying an active connection when no relays are currently connected and no reconnection attempts are scheduled. When background messaging is enabled but there are zero configured read relays, the notification text SHALL indicate that no relays are configured (for example, "No read relays configured") rather than implying a disconnection from configured relays.

#### Scenario: Foreground notification shows connected state when relays are active
- **GIVEN** the Android foreground service for background messaging is running
- **AND** at least one WebSocket connection to a configured read relay is currently active
- **WHEN** the foreground notification is displayed in the Android notification shade
- **THEN** the notification SHALL indicate that nospeak is connected to read relays and MAY include a summary list of up to four connected read relay URLs, consistent with existing android-app-shell foreground notification requirements.

#### Scenario: Foreground notification reflects reconnecting state when all relays are down
- **GIVEN** the Android foreground service for background messaging is running
- **AND** all WebSocket connections to configured read relays are currently closed or have failed
- **AND** the service has scheduled one or more reconnection attempts using its backoff strategy
- **WHEN** the foreground notification is displayed in the Android notification shade
- **THEN** the notification SHALL indicate that nospeak is reconnecting to read relays or otherwise clearly communicate that it is attempting to restore connectivity rather than being fully connected.

#### Scenario: Foreground notification indicates no relays configured
- **GIVEN** the Android foreground service for background messaging is running
- **AND** the configured read relay URL list is empty
- **WHEN** the foreground notification is displayed in the Android notification shade
- **THEN** the notification text SHALL indicate that no relays are configured (for example, "No read relays configured")
- **AND** it SHALL NOT imply that the app is currently reconnecting or disconnected from configured relays.

#### Scenario: Foreground notification does not imply connection when background messaging is effectively disconnected
- **GIVEN** the Android foreground service for background messaging is running
- **AND** there are no active WebSocket connections to any configured read relays
- **AND** no reconnection attempts are currently scheduled (for example, because permissions were revoked or background messaging is in a stopped or error state)
- **WHEN** the foreground notification is displayed in the Android notification shade
- **THEN** the notification text SHALL avoid claiming that nospeak is connected to read relays
- **AND** it MAY indicate that background messaging is not currently connected so that users are not misled about connection state.
