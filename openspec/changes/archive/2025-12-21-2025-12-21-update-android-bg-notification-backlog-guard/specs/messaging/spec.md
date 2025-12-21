## MODIFIED Requirements

### Requirement: Real-Time Message Subscription and Deduplication
When Android background messaging is enabled and delegated to the native Android foreground service, the system SHALL avoid notification floods caused by historical replay while still tolerating backdated gift-wrap timestamps.

- The native foreground service SHALL use decrypted inner rumor timestamps for notification eligibility decisions when available.
- The native foreground service SHALL NOT rely on the outer gift-wrap `created_at` as a strict eligibility filter for notifications.

#### Scenario: Background notification eligibility uses inner rumor timestamp
- **GIVEN** the user is running nospeak inside the Android Capacitor app shell
- **AND** Android background messaging is enabled and the native foreground service is active
- **WHEN** a gift-wrap event decrypts to a DM rumor that contains a `created_at` timestamp
- **THEN** the service SHALL use the rumor timestamp to decide whether the message is eligible to notify
- **AND** it SHALL suppress notifications for rumors outside the configured backlog guard window.
