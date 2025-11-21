# cache Specification

## ADDED Requirements

### Requirement: User Relay Population Verification
The cache SHALL correctly populate and maintain users' own read and write relay lists from NIP-65 events.

#### Scenario: Complete NIP-65 relay preservation
- **WHEN** processing a valid NIP-65 event (kind 10002) with multiple relay tags
- **THEN** all relay URLs SHALL be preserved in appropriate read/write relay fields
- **THEN** no relay SHALL be lost during parsing, deduplication, or caching
- **THEN** read_relays and write_relays fields SHALL contain complete JSON arrays

#### Scenario: Relay list parsing accuracy
- **WHEN** parsing NIP-65 relay list tags with different markers
- **THEN** relays marked "read" SHALL be stored only in read_relays field
- **THEN** relays marked "write" SHALL be stored only in write_relays field
- **THEN** unmarked relays SHALL be stored in both read and write fields
- **THEN** relay URL format SHALL be preserved exactly as received

#### Scenario: Cache update integrity
- **WHEN** SetNIP65Relays is called with valid relay arrays
- **THEN** both read_relays and write_relays fields SHALL be updated atomically
- **THEN** existing relay data SHALL not be partially overwritten
- **THEN** JSON serialization SHALL produce valid array format for both fields

### Requirement: Relay Data Validation and Repair
The cache SHALL provide mechanisms to validate and repair corrupted relay data.

#### Scenario: Corrupted relay detection
- **WHEN** validating cached profiles
- **THEN** profiles with identical read/write relay content from migration SHALL be identified
- **THEN** profiles with empty write_relays but non-empty read_relays SHALL be flagged for refresh
- **THEN** invalid JSON in relay fields SHALL be detected and reported

#### Scenario: Automatic data repair
- **WHEN** corrupted relay data is detected
- **THEN** system SHALL attempt to refresh NIP-65 data from network
- **THEN** persistent cache corruption SHALL trigger field reset to force rediscovery
- **THEN** repair operations SHALL not affect valid existing relay data

### Requirement: Relay Population Debugging
The cache SHALL provide debugging capabilities for relay population issues.

#### Scenario: Relay population tracing
- **WHEN** debug mode is enabled during relay discovery
- **THEN** raw NIP-65 event content SHALL be logged
- **THEN** parsing steps and intermediate results SHALL be logged
- **THEN** final cached relay counts SHALL be logged for verification

#### Scenario: Cache inspection
- **WHEN** inspecting cached relay data for specific users
- **THEN** current read and write relay arrays SHALL be retrievable
- **THEN** cache expiration status SHALL be visible
- **THEN** relay data source (network/cached) SHALL be identifiable