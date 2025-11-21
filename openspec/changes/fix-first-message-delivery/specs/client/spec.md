# Client Specification Deltas

## MODIFIED Requirements

### Requirement: Reliable Message Delivery
The client SHALL attempt to publish events to ALL managed relays, including those that are currently connecting or disconnected.

#### Scenario: Publishing to a disconnected managed relay
- **GIVEN** a relay "wss://new.relay.com" is added to `ConnectionManager` but not yet connected
- **WHEN** `PublishEvent` is called
- **THEN** the system SHALL attempt to publish to "wss://new.relay.com"
- **THEN** the attempt SHALL fail (due to no connection)
- **THEN** the event SHALL be enqueued in the `RetryQueue` for that relay
- **THEN** the system SHALL retry publishing once the connection is established (or backoff expires)

### Requirement: Relay Management Visibility
The `ConnectionManager` SHALL provide access to the list of all managed relay URLs, regardless of their connection state.

#### Scenario: Listing managed relays
- **GIVEN** a mix of connected and disconnected relays in `ConnectionManager`
- **WHEN** `GetAllManagedRelayURLs()` is called
- **THEN** it SHALL return all unique URLs of relays currently being managed
- **THEN** the list SHALL include relays that are currently disconnected or connecting
