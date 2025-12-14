## ADDED Requirements

### Requirement: Messaging Relays Settings Category
The Settings interface SHALL provide a "Messaging Relays" category that allows users to configure the set of relay URLs used for sending and receiving encrypted direct messages. This category replaces the previous "Mailbox Relays" terminology and read/write relay split, and SHALL present a single list of messaging relay URLs that are published as the user's NIP-17 kind 10050 messaging relay list.

#### Scenario: Settings sidebar shows Messaging Relays category
- **GIVEN** the user is authenticated and opens the Settings modal
- **WHEN** the Settings sidebar categories are rendered
- **THEN** the sidebar SHALL contain a "Messaging Relays" entry instead of "Mailbox Relays"
- **AND** selecting this entry SHALL display the messaging relays configuration view.

#### Scenario: Messaging Relays view shows a single relay list
- **GIVEN** the user has selected the "Messaging Relays" category in Settings
- **WHEN** the messaging relays view is rendered
- **THEN** it SHALL display a single list of relay URLs representing the current user's messaging relays
- **AND** it SHALL NOT display separate read/write checkboxes or labels for each relay.

### Requirement: Messaging Relays Add/Remove Behavior
The Messaging Relays settings view SHALL allow the user to add and remove messaging relay URLs, and any changes SHALL update the locally cached profile and the user's published NIP-17 kind 10050 messaging relay list.

#### Scenario: User adds a messaging relay URL
- **GIVEN** the Messaging Relays view is open in Settings
- **WHEN** the user enters a valid relay URL (or hostname that can be normalized to `wss://…`) and confirms the add action
- **THEN** the new URL SHALL be normalized if necessary, appended to the messaging relay list if not already present, and saved to the user's profile cache
- **AND** the client SHALL publish an updated kind 10050 messaging relay list event that includes the new relay URL.

#### Scenario: User removes a messaging relay URL
- **GIVEN** the Messaging Relays view is open in Settings
- **AND** the current messaging relay list contains at least one URL
- **WHEN** the user removes a relay from the list
- **THEN** the removed URL SHALL no longer appear in the messaging relay list
- **AND** the updated list SHALL be saved to the user's profile cache
- **AND** the client SHALL publish an updated kind 10050 messaging relay list event that reflects the removal.
