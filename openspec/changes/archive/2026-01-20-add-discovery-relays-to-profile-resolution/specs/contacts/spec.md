## ADDED Requirements

### Requirement: Profile Resolution Uses Discovery Relays
When resolving a contact's profile (kind 0, 10050, 10002, 10063 events), the system SHALL query both the user's connected messaging relays AND discovery relays. Discovery relay connections SHALL be temporary and cleaned up when the profile resolution completes.

#### Scenario: NIP-05 contact search finds profile on discovery relay
- **GIVEN** the user is searching for a contact via NIP-05 address (e.g., `alice@example.com`)
- **AND** the NIP-05 lookup successfully returns the contact's pubkey
- **AND** the contact's kind 0 profile event exists on a discovery relay but not on the user's messaging relays
- **WHEN** the system calls `ProfileResolver.resolveProfile()` for the contact
- **THEN** the system SHALL query both the user's messaging relays AND discovery relays
- **AND** the profile SHALL be successfully fetched from the discovery relay
- **AND** the contact's name and picture SHALL be displayed in the search results

#### Scenario: Discovery relay connections cleaned up after profile resolution
- **GIVEN** the system has connected to discovery relays as part of profile resolution
- **WHEN** the profile resolution subscription is closed (either by timeout or successful completion)
- **THEN** the temporary discovery relay connections that were added for this subscription SHALL be removed
- **AND** the user's persistent messaging relay connections SHALL remain active

### Requirement: Proactive Discovery Relay Connection on Search Input
When the user begins typing in the contact search field, the system SHALL proactively connect to discovery relays before the search query is executed. This ensures discovery relays are ready when the NIP-05 profile fetch is triggered.

#### Scenario: Discovery relays connected on first keystroke
- **GIVEN** the user opens the Manage Contacts modal or contacts page
- **AND** no search query has been entered yet
- **WHEN** the user types the first character in the search input field
- **THEN** the system SHALL initiate connections to all configured discovery relays
- **AND** these connections SHALL be established before the NIP-05 lookup debounce completes

#### Scenario: Discovery relay connection is idempotent
- **GIVEN** the user has already typed in the search field and discovery relays are connecting or connected
- **WHEN** the user continues typing additional characters
- **THEN** the system SHALL NOT attempt to connect to discovery relays again
- **AND** the existing connection attempts SHALL continue uninterrupted
