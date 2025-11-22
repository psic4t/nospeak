## ADDED Requirements
### Requirement: Fetch Sent Messages on Startup
The client SHALL attempt to fetch sent messages from relays when the local cache is insufficient, ensuring a complete conversation history.

#### Scenario: Fetching sent messages when cache is empty
- **GIVEN** the client starts with no cached messages for a partner
- **WHEN** `FetchStartupHistory` is called
- **THEN** the client SHALL query for Kind 1059 messages where `pubkey` is the user and `tags.p` contains the user (Self-DMs)
- **THEN** the client SHALL decrypt and cache these messages as "sent" messages

#### Scenario: Fetching recent history from partner
- **GIVEN** the client needs to populate history
- **WHEN** fetching messages
- **THEN** the client SHALL also query for messages authored by the user (sent messages) in addition to received messages

### Requirement: Send to Self (NIP-59 History)
The client SHALL send a copy of all outgoing NIP-59 messages to the user themselves to maintain recoverable history.

#### Scenario: Sending a message
- **GIVEN** the user sends a message to a recipient
- **WHEN** `SendChatMessage` is executed
- **THEN** the client SHALL create a gift wrap for the recipient
- **THEN** the client SHALL create a separate gift wrap for the sender (self)
- **THEN** both gift wraps SHALL be published to appropriate relays
