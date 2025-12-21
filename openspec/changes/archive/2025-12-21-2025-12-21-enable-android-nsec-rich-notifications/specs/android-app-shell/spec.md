## MODIFIED Requirements

### Requirement: Android Background Messaging Foreground Service
The Android Capacitor app shell SHALL provide a background messaging mode that keeps the user's read relays connected while the app UI is not visible by running the messaging stack inside a native Android foreground service that is started and controlled via a dedicated Capacitor plugin.

When the current session uses an external signer such as Amber, this native service SHALL decrypt gift-wrapped messages via the signer integration.

When the current session uses a local key (nsec) login, this native service SHALL decrypt gift-wrapped messages using a locally stored secret key (NIP-44 v2) that is persisted in Android-native, Keystore-backed storage.

In both modes, the native service SHALL raise OS notifications that include short plaintext previews for messages and reactions, consistent with existing lockscreen privacy and notification routing requirements.

#### Scenario: Native foreground service emits preview notifications for Amber sessions
- **GIVEN** the user is running nospeak inside the Android Capacitor app shell and has enabled background messaging
- **AND** the native foreground service is active
- **AND** message notifications are enabled and Android has granted local notification permission
- **AND** the current session uses an external signer (Amber)
- **WHEN** a new gift-wrapped message or reaction addressed to the current user is delivered from any configured read relay while the app UI is not visible
- **THEN** the native foreground service SHALL attempt to decrypt the gift-wrap using the external signer integration
- **AND** it SHALL raise an Android OS notification that includes a short preview (for example, a truncated plaintext message preview or `Reaction: ❤️`) when the device is unlocked
- **AND** activating the notification SHALL open the nospeak app and navigate to the corresponding chat conversation.

#### Scenario: Native foreground service emits preview notifications for local-key sessions
- **GIVEN** the user is running nospeak inside the Android Capacitor app shell and has enabled background messaging
- **AND** the native foreground service is active
- **AND** message notifications are enabled and Android has granted local notification permission
- **AND** the current session uses a local key (nsec) login
- **AND** the local secret key is available in Android-native secure storage
- **WHEN** a new gift-wrapped message or reaction addressed to the current user is delivered from any configured read relay while the app UI is not visible
- **THEN** the native foreground service SHALL decrypt the gift-wrap using NIP-44 v2 with the locally stored secret key
- **AND** it SHALL raise an Android OS notification that includes a short preview when the device is unlocked
- **AND** activating the notification SHALL open the nospeak app and navigate to the corresponding chat conversation.

#### Scenario: Local-key secret is not passed through intents
- **GIVEN** the user enables Android background messaging in a local-key (nsec) session
- **WHEN** the web runtime starts or updates the native Android foreground service via the Capacitor plugin
- **THEN** the start/update request SHALL NOT include the local secret key in an Android intent extra
- **AND** the foreground service SHALL obtain the local secret key only from Android-native, Keystore-backed storage.

#### Scenario: Background messaging is disabled when local secret is missing
- **GIVEN** the Android foreground service starts or restores background messaging in local-key mode
- **AND** the local secret key is missing from Android-native secure storage
- **WHEN** the service evaluates whether it can perform background decryption
- **THEN** it SHALL persistently disable Android background messaging for that installation
- **AND** it SHALL stop the foreground service
- **AND** it SHOULD update the foreground notification summary to indicate that re-login is required.

### Requirement: Android Background Messaging Auto-Restart After Device Restart
When running inside the Android Capacitor app shell, the system SHALL restore Android background messaging after a device restart or app update for users who previously enabled background messaging.

For Amber sessions, the native service MAY rely on the persisted signer package selection and existing signer integration as specified.

For local-key sessions, the native service SHALL only restart in a state that can perform NIP-44 decryption when the local secret key is available in Android-native secure storage. If the secret key is missing, the service SHALL disable background messaging and SHALL NOT continue attempting to run in a degraded mode.

#### Scenario: Local-key service restarts after device reboot when secret is available
- **GIVEN** the user previously enabled background messaging in Settings → General while running inside the Android Capacitor app shell
- **AND** the user previously logged in with a local key (nsec) and the key is stored in Android-native secure storage
- **WHEN** the device reboots and the user unlocks their Android profile
- **THEN** the Android app shell SHALL start the native background messaging foreground service without requiring the WebView to be opened
- **AND** the service SHALL be able to decrypt gift-wraps and emit preview notifications according to the background messaging requirements.

#### Scenario: Local-key service does not run after reboot when secret is missing
- **GIVEN** the user previously enabled background messaging in Settings → General
- **AND** the user previously used a local key (nsec) session
- **AND** the local secret key is no longer available in Android-native secure storage
- **WHEN** the device reboots or the app is updated
- **THEN** the Android shell SHALL disable background messaging for that installation
- **AND** it SHALL NOT keep the foreground service running in a state that cannot decrypt messages.

## ADDED Requirements

### Requirement: Android Local Key Secret Storage
When running inside the Android Capacitor app shell, the system SHALL persist local-key (nsec) authentication secrets only in Android-native, Keystore-backed storage and SHALL NOT persist the local secret key in web `localStorage`.

The Android shell SHALL expose a minimal Capacitor plugin API for the web runtime to store, retrieve, and clear the local secret key.

#### Scenario: Local-key login persists secret in Android-native secure storage
- **GIVEN** the user is running nospeak inside the Android Capacitor app shell
- **WHEN** the user logs in using a local key (nsec)
- **THEN** the system SHALL store the secret key in Android-native, Keystore-backed storage
- **AND** it SHALL persist the auth method in a non-secret form so the session can be restored.

#### Scenario: Android local-key restore requires secure secret
- **GIVEN** the user previously logged in using a local key (nsec) in the Android app shell
- **WHEN** the app attempts to restore the session on startup
- **THEN** it SHALL restore the session only if the local secret key is present in Android-native secure storage
- **AND** if the secret is missing, it SHALL require the user to re-login.

#### Scenario: Logout clears Android-native secret storage
- **GIVEN** the user is logged in using a local key (nsec) inside the Android app shell
- **WHEN** the user logs out
- **THEN** the system SHALL clear the local secret key from Android-native secure storage
- **AND** it SHALL stop Android background messaging and clear any persisted state as already specified.
