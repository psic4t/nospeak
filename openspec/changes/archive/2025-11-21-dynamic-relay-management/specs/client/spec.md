# Client Specification Deltas

## ADDED Requirements

### Requirement: Dynamic Relay Management
The `ConnectionManager` SHALL support dynamic addition and removal of relays during runtime without requiring a restart.

#### Scenario: Removing an active relay
- **GIVEN** a connected relay "wss://relay.old.com"
- **WHEN** `RemoveRelay("wss://relay.old.com")` is called
- **THEN** the connection to the relay SHALL be closed
- **THEN** the relay SHALL be removed from the health monitoring list
- **THEN** the relay SHALL be removed from the active relays list
- **THEN** no further reconnection attempts SHALL be made for this relay

### Requirement: NIP-65 Bootstrapping
The client SHALL use hardcoded discovery relays to fetch the user's relay list on startup and then switch to using those relays.

#### Scenario: Startup with no cached relays
- **GIVEN** the client is starting up
- **WHEN** `Connect` is called
- **THEN** the client SHALL connect to the hardcoded discovery relays
- **THEN** the client SHALL query for the user's Kind 10002 event on these relays
- **THEN** the client SHALL parse the "read" relays from the event
- **THEN** the client SHALL add these user relays to the `ConnectionManager`
- **THEN** the client SHALL remove discovery relays that are not in the user's list from the `ConnectionManager`

#### Scenario: Fallback when NIP-65 not found
- **GIVEN** the client is starting up
- **WHEN** the user's Kind 10002 event cannot be found on discovery relays
- **THEN** the client SHALL continue using the discovery relays as the active set (or a default fallback set)
