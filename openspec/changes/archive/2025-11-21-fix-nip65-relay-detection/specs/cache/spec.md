## ADDED Requirements
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
