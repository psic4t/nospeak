# cache Specification

## Purpose
TBD - created by archiving change fix-nip65-relay-detection. Update Purpose after archive.
## Requirements
### Requirement: NIP-65 Data Migration Correction
The cache SHALL fix existing corrupted relay data caused by the migration bug that duplicated legacy relay lists to both read and write fields.

#### Scenario: Correct migration-duplicated data
- **WHEN** cache initialization finds profiles with identical read_relays and write_relays content
- **THEN** system SHALL clear write_relays field to force fresh NIP-65 discovery
- **THEN** system SHALL keep read_relays field as fallback discovery relays
- **THEN** affected profiles SHALL have fresh NIP-65 discovery on next access

#### Scenario: Handle migration data integrity
- **WHEN** migrating from legacy relay_list to NIP-65 fields
- **THEN** read_relays SHALL receive legacy relay list data
- **THEN** write_relays SHALL be set to empty array "[]"
- **THEN** future NIP-65 discovery SHALL populate write_relays correctly

### Requirement: NIP-65 Relay Storage
The cache SHALL store read and write relays in separate database fields without mixing or duplication.

#### Scenario: Store separated relay lists
- **WHEN** SetNIP65Relays is called with distinct read and write relay arrays
- **THEN** read_relays field SHALL contain JSON array of read relays only
- **THEN** write_relays field SHALL contain JSON array of write relays only
- **THEN** no relay SHALL appear in both fields unless explicitly provided in both arrays

#### Scenario: Retrieve separated relay lists
- **WHEN** GetProfile returns cached profile with NIP-65 data
- **THEN** GetReadRelays() SHALL return only read relays from read_relays field
- **THEN** GetWriteRelays() SHALL return only write relays from write_relays field
- **THEN** methods SHALL parse JSON arrays correctly without cross-contamination

#### Scenario: Handle empty relay lists
- **WHEN** user has no read relays but has write relays
- **THEN** read_relays field SHALL be empty JSON array "[]"
- **THEN** write_relays field SHALL contain write relays JSON array
- **WHEN** user has no write relays but has read relays
- **THEN** write_relays field SHALL be empty JSON array "[]"
- **THEN** read_relays field SHALL contain read relays JSON array

#### Scenario: Maintain data integrity
- **WHEN** updating existing cached relays
- **THEN** read and write relay fields SHALL be updated independently
- **THEN** no data from read_relays SHALL leak into write_relays field
- **THEN** no data from write_relays SHALL leak into read_relays field

### Requirement: Optimized Profile Schema
The profile cache schema SHALL exclude redundant legacy fields to optimize storage.

#### Scenario: Absence of legacy fields in ProfileEntry
- **Given** the `ProfileEntry` struct in `cache/interface.go`
- **Then** `RelayListEventID` field SHALL NOT exist
- **And** `RelayListUpdatedAt` field SHALL NOT exist

#### Scenario: Absence of legacy columns in database
- **Given** the `profile_cache` table in `cache/sqlite.go`
- **Then** the `relay_list_event_id` column SHALL NOT exist
- **And** the `relay_list_updated_at` column SHALL NOT exist

### Requirement: Profile Freshness Strategy
Freshness checks SHALL rely on the main cached timestamp.

#### Scenario: Use cached_at for freshness
- **Given** a cached profile
- **When** checking if the profile or relay list is up to date
- **Then** `cached_at` SHALL be used instead of `relay_list_updated_at`

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

