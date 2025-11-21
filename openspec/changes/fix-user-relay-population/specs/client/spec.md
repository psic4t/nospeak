# client Specification

## ADDED Requirements

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