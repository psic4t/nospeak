## ADDED Requirements
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
