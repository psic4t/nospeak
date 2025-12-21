## MODIFIED Requirements

### Requirement: Android Background Messaging Foreground Service
When running inside the Android Capacitor app shell with background messaging enabled, the native Android foreground service responsible for background messaging SHALL suppress Android OS notification floods caused by historical replay on initial enable and on service restarts.

The service SHALL implement a persisted notification baseline (cutoff) that determines the earliest eligible decrypted DM rumor timestamp that may generate an Android OS notification preview.

- The baseline SHALL be stored per Android installation.
- The baseline eligibility decision SHALL be based on the decrypted inner rumor timestamp (`created_at`) when available, rather than the outer gift-wrap event timestamp.
- The service SHALL apply a maximum backlog eligibility window of 15 minutes on service restarts.

#### Scenario: First enable does not notify historical messages
- **GIVEN** the user has just logged in and the web runtime explicitly enables Android background messaging
- **AND** the native Android foreground service starts and subscribes to gift-wrapped events for the user
- **WHEN** the relays deliver historical gift-wrap events that decrypt to DM rumors created before the moment background messaging was enabled
- **THEN** the service SHALL NOT emit Android OS notifications for those historical DMs
- **AND** it MAY still update internal dedupe state without notifying.

#### Scenario: Service restart caps backlog notifications to 15 minutes
- **GIVEN** the user previously enabled Android background messaging
- **AND** the native Android foreground service restarts due to device reboot, app update, or process restart
- **WHEN** the relays deliver gift-wrap events that decrypt to DM rumors
- **THEN** only rumors whose decrypted inner rumor timestamps fall within the last 15 minutes (relative to current device time) SHALL be eligible to trigger Android OS notifications
- **AND** older rumors SHALL be suppressed to avoid notification floods.

#### Scenario: Backdated gift-wrap timestamps do not break notifications
- **GIVEN** the relays deliver gift-wrap events whose outer `created_at` timestamps are randomized or backdated
- **AND** the gift-wrap decrypts to a valid DM rumor with an inner rumor timestamp
- **WHEN** the inner rumor timestamp indicates the message is within the eligible notification cutoff window
- **THEN** the service SHALL treat the message as eligible to notify even if the outer gift-wrap timestamp is older than the cutoff
- **AND** the service SHALL NOT rely on a strict outer `since now` filter that would exclude these deliveries.
