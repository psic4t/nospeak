## MODIFIED Requirements

### Requirement: Message Synchronization
The system SHALL synchronize message history efficiently by downloading only missing messages and processing them in batches. On first-time sync (empty local cache), the system SHALL fetch ALL available messages from relays. On subsequent syncs, the system SHALL fetch only recent messages to fill gaps.

#### Scenario: First-time sync (empty cache)
- **GIVEN** the user logs in for the first time (no messages in local cache)
- **WHEN** the application starts message synchronization
- **THEN** it fetches ALL messages from relays in batches
- **AND** continues fetching until relays return empty results
- **AND** displays sync progress showing message count

#### Scenario: Returning user sync (existing cache)
- **GIVEN** the user has existing messages in local cache
- **WHEN** the application starts
- **THEN** it fetches only the most recent batch of messages (100)
- **AND** stops fetching when it encounters known messages

#### Scenario: Incremental history fetch
- **GIVEN** the user has existing messages up to timestamp T
- **WHEN** the application starts
- **THEN** it fetches history backwards from now
- **AND** it stops fetching automatically when it encounters messages older than T that are already stored locally

#### Scenario: Pipeline processing
- **WHEN** a batch of historical messages is received
- **THEN** the system decrypts and saves them immediately
- **AND** the UI updates to show them (if within view) before the next batch is requested

## ADDED Requirements

### Requirement: First-Time Sync Progress Indicator
The system SHALL display a progress indicator during first-time message synchronization to inform users of sync status and prevent interaction until complete.

#### Scenario: Desktop progress display
- **GIVEN** the user is on a desktop device (screen width > 768px)
- **AND** this is a first-time sync (empty cache)
- **WHEN** message synchronization is in progress
- **THEN** the empty chat area displays "Syncing messages... (X fetched)"
- **AND** the count updates in real-time as batches complete

#### Scenario: Mobile progress display
- **GIVEN** the user is on a mobile device (screen width <= 768px)
- **AND** this is a first-time sync (empty cache)
- **WHEN** message synchronization is in progress
- **THEN** a blocking modal overlay displays "Syncing messages... (X fetched)"
- **AND** the user cannot interact with the application until sync completes
- **AND** the count updates in real-time as batches complete

#### Scenario: Progress indicator dismissal
- **GIVEN** the first-time sync progress indicator is displayed
- **WHEN** message synchronization completes
- **THEN** the progress indicator is removed
- **AND** on desktop, the application navigates to the contact with the newest message

### Requirement: Real-Time Message Subscription
The real-time message subscription SHALL only receive new messages sent after the subscription starts, not historical messages.

#### Scenario: Subscription receives only new messages
- **GIVEN** the user is logged in and the message subscription is active
- **WHEN** a new message is sent to the user after the subscription started
- **THEN** the message is received and processed in real-time

#### Scenario: Historical messages excluded from subscription
- **GIVEN** the user is logged in and the message subscription is active
- **WHEN** the subscription connects to a relay
- **THEN** the relay does NOT send historical messages through the subscription
- **AND** historical messages are only fetched via explicit history sync
