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

### Requirement: NIP-65 Relay List Processing
The client SHALL correctly process and preserve all relays from NIP-65 events.

#### Scenario: Complete NIP-65 tag parsing
- **WHEN** processing a kind 10002 event with multiple relay tags
- **THEN** all tags with "r" key SHALL be examined regardless of position
- **THEN** relay URLs SHALL be extracted exactly as provided without modification
- **THEN** tag markers (read/write/unmarked) SHALL be correctly identified and processed

#### Scenario: Relay categorization accuracy
- **WHEN** categorizing relays based on NIP-65 markers
- **THEN** relays with marker "read" SHALL be added only to read relay list
- **THEN** relays with marker "write" SHALL be added only to write relay list
- **THEN** relays with no marker or unknown marker SHALL be added to both lists
- **THEN** duplicate relay URLs SHALL be removed while preserving category information

#### Scenario: Relay list deduplication
- **WHEN** removing duplicate relays from read and write lists
- **THEN** deduplication SHALL be performed separately for each list
- **THEN** relay URLs SHALL be compared case-sensitively
- **THEN** order of unique relays SHALL be preserved from original event

### Requirement: Profile Relay Integration
The client SHALL properly integrate NIP-65 relay discovery with profile resolution.

#### Scenario: Combined profile and relay fetching
- **WHEN** resolving user profiles with relay information
- **THEN** both kind 0 (profile) and kind 10002 (relay list) events SHALL be queried together
- **THEN** profile metadata and relay information SHALL be cached together
- **THEN** missing relay list SHALL not prevent profile metadata caching

#### Scenario: Relay data caching consistency
- **WHEN** caching profile with NIP-65 relay data
- **THEN** SetProfileWithRelayList SHALL receive properly separated read/write arrays
- **THEN** cache updates SHALL preserve both profile metadata and relay data atomically
- **THEN** cache expiration SHALL apply to both profile and relay data together

### Requirement: Relay Discovery Debugging
The client SHALL provide detailed debugging for NIP-65 relay discovery process.

#### Scenario: Relay discovery tracing
- **WHEN** debug mode is enabled during relay discovery
- **THEN** raw NIP-65 event tags SHALL be logged before processing
- **THEN** relay categorization decisions SHALL be logged with reasons
- **THEN** final relay counts SHALL be logged before and after deduplication
- **THEN** cache update results SHALL be logged with success/failure status

#### Scenario: Network request debugging
- **WHEN** fetching NIP-65 events from relays
- **THEN** query parameters and filter conditions SHALL be logged
- **THEN** received event count and IDs SHALL be logged
- **THEN** parsing errors SHALL be logged with detailed context

### Requirement: Selective Startup Connections
The client SHALL only connect to the user's cached read relays at startup, using discovery relays only as fallback when user relays are not cached.

#### Scenario: Startup with cached user read relays
- **GIVEN** the client is starting up
- **AND** the user's read relays are cached
- **WHEN** `Connect()` is called
- **THEN** the client SHALL connect only to the user's cached read relays
- **THEN** the client SHALL NOT connect to discovery relays
- **THEN** the client SHALL NOT connect to any contact relays

#### Scenario: Startup without cached user read relays
- **GIVEN** the client is starting up
- **AND** the user's read relays are not cached
- **WHEN** `Connect()` is called
- **THEN** the client SHALL connect to discovery relays as fallback
- **THEN** the client SHALL attempt to discover and cache the user's read relays
- **THEN** the client SHALL switch to user's read relays once discovered

#### Scenario: Persistent connection management
- **GIVEN** the client is running
- **WHEN** user's read relays are available
- **THEN** the client SHALL maintain persistent connections only to user's read relays
- **THEN** the client SHALL automatically reconnect to user's read relays if connections are lost

### Requirement: Temporary Message Delivery Connections
The client SHALL use temporary connections for contacting recipient's read relays during message sending without adding them to persistent management.

#### Scenario: Sending message to contact
- **GIVEN** the user wants to send a message to a contact
- **WHEN** `SendChatMessage()` is called
- **THEN** the client SHALL send the message to user's persistent read relays
- **THEN** the client SHALL establish temporary connections to contact's read relays
- **THEN** the client SHALL send the message to contact's read relays
- **THEN** the client SHALL clean up temporary connections after message delivery

#### Scenario: Temporary connection failure handling
- **GIVEN** temporary connection to contact's relay fails
- **WHEN** message sending is attempted
- **THEN** the client SHALL continue with available temporary connections
- **THEN** the client SHALL log the failure for debugging
- **THEN** the client SHALL NOT add failed relays to persistent management

#### Scenario: Cleanup of temporary connections
- **GIVEN** message delivery is complete (successful or failed)
- **WHEN** cleanup is performed
- **THEN** the client SHALL close all temporary connections
- **THEN** the client SHALL remove temporary relays from connection tracking
- **THEN** the client SHALL preserve persistent connections to user's read relays

### Requirement: Connection Type Distinction
The ConnectionManager SHALL distinguish between persistent and temporary relay connections with appropriate lifecycle management.

#### Scenario: Adding persistent connections
- **GIVEN** a user's read relay needs to be connected
- **WHEN** `AddPersistentRelay()` is called
- **THEN** the relay SHALL be added to persistent management
- **THEN** the relay SHALL be included in automatic reconnection logic
- **THEN** the relay SHALL be monitored for health statistics

#### Scenario: Adding temporary connections
- **GIVEN** a contact's read relay needs temporary connection
- **WHEN** `AddTemporaryRelay()` is called
- **THEN** the relay SHALL be connected for immediate use
- **THEN** the relay SHALL NOT be included in automatic reconnection logic
- **THEN** the relay SHALL be excluded from persistent health monitoring

#### Scenario: Connection status reporting
- **GIVEN** the TUI requests connection status
- **WHEN** `GetConnectionStats()` is called
- **THEN** the stats SHALL distinguish between persistent and temporary connections
- **THEN** persistent connections SHALL be prominently displayed
- **THEN** temporary connections SHALL be marked as temporary

### Requirement: Relay Discovery and Caching Integration
The client SHALL integrate relay discovery with selective connection logic, ensuring proper caching and fallback behavior.

#### Scenario: User relay discovery
- **GIVEN** the user's read relays are not cached
- **WHEN** discovery is performed during startup
- **THEN** the client SHALL use discovery relays temporarily
- **THEN** the client SHALL discover the user's read relays
- **THEN** the client SHALL cache the user's read relays
- **THEN** the client SHALL switch to persistent connections with user's read relays

#### Scenario: Contact relay discovery for messaging
- **GIVEN** a message needs to be sent to a contact
- **WHEN** contact's read relays are not cached
- **THEN** the client SHALL discover contact's read relays using persistent connections
- **THEN** the client SHALL cache the discovered relays for future use
- **THEN** the client SHALL use temporary connections for message delivery

#### Scenario: Cache invalidation and refresh
- **GIVEN** cached relay information is expired
- **WHEN** relay information is accessed
- **THEN** the client SHALL detect the expiration
- **THEN** the client SHALL refresh the relay information
- **THEN** the client SHALL update the cache with new information

