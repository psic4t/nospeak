## MODIFIED Requirements

### Requirement: NIP-25 Message Reactions for Encrypted DMs
The messaging experience SHALL support NIP-25 `kind 7` reactions for individual messages inside the existing NIP-17 encrypted direct message flow.

#### Scenario: Reaction Targeting using Rumor ID
- **GIVEN** a NIP-17 encrypted message (Kind 14 Rumor wrapped in Kind 1059 Gift Wrap)
- **WHEN** a user reacts to this message
- **THEN** the reaction event (Kind 7) SHALL reference the **Rumor ID** (the hash of the inner Kind 14 event) in its `e` tag, NOT the Gift Wrap ID.
- **AND** the system SHALL calculate this Rumor ID deterministically upon sending and receiving to ensure both parties share the same target ID.

#### Scenario: Storing Rumor ID
- **WHEN** a message is saved to the local database (whether sent or received)
- **THEN** the system SHALL calculate the hash of the inner Rumor event and store it as `rumorId`.
- **AND** the UI SHALL use this `rumorId` to associate and display reactions.
