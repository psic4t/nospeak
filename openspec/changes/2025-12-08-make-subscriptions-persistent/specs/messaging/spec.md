## MODIFIED Requirements
### Requirement: Real-Time Message Subscription and Deduplication
The real-time message subscription SHALL subscribe to all encrypted gift-wrapped messages for the current user, MAY receive both historical and new messages from relays, and MUST rely on local deduplication to avoid processing the same message more than once. The subscription lifecycle SHALL be managed as an app-global, single-instance service for each logged-in session rather than being tied to any individual route or view.

#### Scenario: Subscription receives incoming messages in real time (unchanged)
- **GIVEN** the user is logged in and the message subscription is active
- **WHEN** a new message is sent to the user
- **THEN** the corresponding gift-wrap event is received via the subscription
- **AND** the message is decrypted, saved to the local database, and displayed in the appropriate conversation without requiring a page reload

#### Scenario: Subscription tolerates backdated gift-wrap timestamps (unchanged)
- **GIVEN** the system uses NIP-59 style gift-wraps with randomized `created_at` timestamps
- **WHEN** the subscription connects or reconnects to a relay
- **THEN** it does NOT restrict events by a strict "since now" filter that would exclude backdated gift-wraps
- **AND** it allows relays to send any matching gift-wrap events for the user

#### Scenario: Historical messages deduplicated across sync and subscription (unchanged)
- **GIVEN** the user has already fetched some message history via explicit history sync
- **AND** the real-time subscription is active
- **WHEN** a relay sends a gift-wrap event that corresponds to a message already stored locally
- **THEN** the system SHALL skip decrypting and saving that message again
- **AND** the UI SHALL NOT display duplicate copies of the same message

#### Scenario: Global subscription lifecycle tied to session, not routes
- **GIVEN** the user is logged in and the ordered login history synchronization flow (or equivalent session-restore flow) has completed for the current user
- WHEN the application determines that messaging is ready to operate (for example, relays are configured and initial sync has completed)
- THEN the system SHALL start exactly one real-time subscription pipeline for that user at the app level
- AND this subscription pipeline SHALL remain active for as long as the user stays logged in and the application process remains alive, regardless of which chat route or view is currently visible
- AND the subscription SHALL only be stopped when the user logs out, switches accounts, or when messaging is intentionally shut down as part of application teardown.

#### Scenario: Android background messaging keeps subscription active while process is alive
- **GIVEN** the user is running nospeak inside the Android Capacitor app shell
- AND the Android background messaging preference is enabled as defined in the background messaging change (`2025-12-08-add-android-background-messaging`)
- AND the Android foreground service for background messaging is running and the OS has not restricted the app's background execution
- WHEN the user backgrounds the app (for example, by switching to another app or returning to the home screen)
- THEN the app-global real-time subscription pipeline SHALL remain active and keep relay connections alive as long as the process remains allowed to run
- AND newly received gift-wrap events for the user SHALL be processed and stored while the app UI is not visible
- AND existing notification requirements for new messages SHALL continue to apply (for example, Android local notifications for new messages when enabled).

#### Scenario: Subscriptions stop cleanly on logout or background messaging disable
- **GIVEN** the user is currently logged in and the app-global real-time subscription pipeline is active
- WHEN the user logs out, switches to a different account, or disables Android background messaging in Settings such that background operation is no longer eligible
- THEN the system SHALL stop the app-global real-time subscription pipeline
- AND it SHALL close associated relay connections in coordination with the connection manager
- AND it SHALL avoid leaving any orphaned subscriptions tied to previous session state.
