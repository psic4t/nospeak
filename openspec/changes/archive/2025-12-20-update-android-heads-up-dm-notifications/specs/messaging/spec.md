## ADDED Requirements

### Requirement: Heads-Up Defaults for Android Background DMs
When running inside the Android Capacitor app shell with background messaging enabled and active, the Android-native background messaging service SHALL configure its message notification channel so that new decrypted DM notifications are Heads-Up eligible by default.

#### Scenario: Message channel defaults allow Heads-Up notifications
- **GIVEN** the user is running nospeak inside the Android Capacitor app shell
- **AND** background messaging is enabled and the native Android foreground service for background messaging is active
- **WHEN** the Android notification channel used for background DM notifications is created
- **THEN** it SHALL use an importance level equivalent to `IMPORTANCE_HIGH`
- **AND** it SHALL enable sound and vibration by default
- **AND** it SHALL allow lockscreen content visibility (subject to user OS privacy settings).

## MODIFIED Requirements

### Requirement: Android Background Message Delivery
When running inside the Android Capacitor app shell with background messaging enabled, the messaging experience on Android SHALL delegate background message reception and notification to a native foreground service that connects to the user's read relays, subscribes to gift-wrapped messages, and triggers OS notifications even while the WebView is suspended.

#### Scenario: Background subscriptions deliver plaintext previews on Android
- **GIVEN** the user is logged in and has enabled background messaging in Settings → General while running inside the Android Capacitor app shell
- **AND** the native Android foreground service for background messaging is active
- **AND** message notifications are enabled and Android has granted local notification permission
- **WHEN** a new gift-wrapped message addressed to the current user is delivered from any configured read relay while the app UI is not visible
- **THEN** the native service SHALL attempt to decrypt the gift-wrap using the active Android signer integration
- **AND** when the inner rumor is a Kind 14 text message authored by another user, it SHALL raise an Android OS notification whose body includes a truncated plaintext preview
- **AND** when the inner rumor is a Kind 15 file message authored by another user, it SHALL raise an Android OS notification whose body includes the phrase `Message: Sent you an attachment`
- **AND** when the decrypted inner rumor is a NIP-25 `kind 7` reaction, it SHALL NOT raise an Android OS notification for that reaction
- **AND** when decryption is not available or fails, it SHALL NOT raise a generic "new encrypted message" notification.

#### Scenario: Background notifications show cached sender identity when available
- **GIVEN** the same background messaging setup as above
- **AND** the web runtime has previously resolved and cached the sender's Nostr kind `0` metadata on this Android installation
- **WHEN** the native background messaging service raises an Android OS notification for conversation activity from that sender
- **THEN** it SHOULD use the cached **username** derived from kind `0.name` as the notification title
- **AND** it SHOULD display the cached avatar derived from kind `0.picture` as the notification large icon on a best-effort basis
- **AND** it SHALL fall back to existing generic notification titling when no cached username is available
- **AND** it SHALL NOT subscribe to kind `0` metadata events from relays as part of notification emission.

### Requirement: Local Notifications for Message Reactions
When message notifications are enabled for the current device and the platform has granted notification permission, the messaging experience SHALL surface foreground notifications for newly received NIP-25 `kind 7` reactions on NIP-17 encrypted direct messages using the same channels, suppression rules, and navigation semantics as existing message notifications, while continuing to keep reactions out of the visible chat message list.

#### Scenario: Web browser shows notification for reaction in different or inactive conversation
- **GIVEN** the user is accessing nospeak in a supported web browser
- **AND** message notifications are enabled in Settings → General
- **AND** the browser has granted notification permission
- **AND** either the nospeak window is not the active, focused foreground tab or the user is currently viewing an open conversation with Contact A
- **WHEN** a new NIP-25 `kind 7` reaction addressed to the current user is received from Contact B (a different conversation) and processed by the messaging pipeline
- **THEN** the system SHALL display a browser notification indicating that Contact B reacted to the user's message (for example, including the sender name and reaction emoji when available)
- **AND** activating the notification SHALL keep or bring the nospeak window to the foreground and navigate to the conversation with Contact B.

#### Scenario: Android app does not raise reaction notifications from background service
- **GIVEN** the user is running nospeak inside the Android Capacitor app shell
- **AND** message notifications are enabled in Settings → General
- **AND** the Android OS has granted permission for local notifications
- **AND** Android background messaging is enabled and the native foreground service for background messaging is active
- **WHEN** a new NIP-25 `kind 7` reaction addressed to the current user is received while the app UI is not visible
- **THEN** the native foreground service SHALL NOT emit an Android OS notification for that reaction.

### Requirement: Background Messaging Covers Reaction Gift-Wrap Events
When running inside the Android Capacitor app shell with background messaging enabled, the Android-native foreground service responsible for background messaging SHALL handle gift-wrapped events whose inner rumor is a NIP-25 `kind 7` reaction without surfacing an Android OS notification preview for them.

#### Scenario: Background service suppresses reaction preview notifications for reaction gift-wrap
- **GIVEN** the user is logged in, has enabled background messaging in Settings → General, and is running inside the Android Capacitor app shell
- **AND** the native Android foreground service for background messaging is active and subscribed to NIP-17 DM gift-wrapped events addressed to the user
- **AND** message notifications are enabled and Android has granted local notification permission
- **WHEN** a gift-wrapped event is delivered from any configured read relay whose decrypted inner rumor is a NIP-25 `kind 7` reaction authored by another user
- **THEN** the native service SHALL NOT raise an Android OS notification for that reaction.
