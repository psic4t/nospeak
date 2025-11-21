# client Specification

## Purpose
TBD - created by archiving change fix-nip65-relay-detection. Update Purpose after archive.
## Requirements
### Requirement: NIP-65 Relay Discovery
The client SHALL correctly parse NIP-65 kind 10002 events to separate read and write relays according to specification requirements.

#### Scenario: Parse marked relays correctly
- **WHEN** NIP-65 event contains ["r", "wss://relay.example.com", "read"] tag
- **THEN** relay SHALL be added only to read relays list
- **WHEN** NIP-65 event contains ["r", "wss://relay.example.com", "write"] tag  
- **THEN** relay SHALL be added only to write relays list

#### Scenario: Handle unmarked relays for backward compatibility
- **WHEN** NIP-65 event contains ["r", "wss://relay.example.com"] tag without marker
- **THEN** relay SHALL be added to both read and write relays lists

#### Scenario: Remove duplicate relays
- **WHEN** same relay URL appears multiple times in same category
- **THEN** duplicates SHALL be removed maintaining first occurrence order
- **WHEN** relay appears in both read and write categories with different markers
- **THEN** relay SHALL appear in both lists with appropriate categorization

#### Scenario: Validate relay list integrity
- **WHEN** parsing NIP-65 event tags
- **THEN** read relays list SHALL contain only relays marked "read" or unmarked
- **THEN** write relays list SHALL contain only relays marked "write" or unmarked
- **THEN** no relay SHALL be incorrectly categorized due to marker parsing errors

### Requirement: Profile Resolver Legacy Field Handling
The ProfileResolver MUST NOT use removed legacy fields when interacting with the cache.

#### Scenario: Calling SetProfileWithRelayList
- **Given** the `ProfileResolver` in `client/profile_resolver.go`
- **When** calling `cache.SetProfileWithRelayList`
- **Then** it SHALL NOT pass `relayListEventID` as it is removed from the signature

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

### Requirement: Enhanced PublishEvent Return Value
The `PublishEvent` method SHALL return the count of successful relay publications alongside the existing error information.

#### Scenario: Successful publication to multiple relays
- **GIVEN** an event is published to 3 managed relays
- **WHEN** `PublishEvent` completes successfully
- **THEN** it SHALL return success count of 3 and nil error
- **THEN** the success count SHALL represent relays where immediate publication succeeded

#### Scenario: Mixed success and failure
- **GIVEN** an event is published to 3 managed relays
- **WHEN** 2 relays succeed immediately and 1 fails
- **THEN** it SHALL return success count of 2 and nil error
- **THEN** the failed relay SHALL be queued for retry by existing retry logic

#### Scenario: Complete publication failure
- **GIVEN** an event is published to 3 managed relays
- **WHEN** all relays fail immediately and no retry is possible
- **THEN** it SHALL return success count of 0 and non-nil error
- **THEN** the error SHALL represent the last encountered failure

#### Scenario: Backward compatibility preservation
- **GIVEN** existing code that only checks for error
- **WHEN** `PublishEvent` returns success count and error
- **THEN** error handling behavior SHALL remain unchanged
- **THEN** success count SHALL be ignored by existing callers

