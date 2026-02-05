## ADDED Requirements

### Requirement: File Message Captions via Alt Tag

File messages (kind 15) SHALL support optional captions using the NIP-31 `alt` tag. When sending a file message with a caption, the client SHALL include an `['alt', caption]` tag in the kind 15 event. When receiving a file message, the client SHALL extract the `alt` tag value and store it as the message text. The caption SHALL be displayed below the media content in the message bubble using the same styling as message text.

#### Scenario: Sending file message with caption
- **GIVEN** the user has selected a file to send
- **AND** the user has entered a caption in the caption input field
- **WHEN** the file message is sent
- **THEN** a single kind 15 event is created with an `['alt', caption]` tag containing the caption text
- **AND** no separate kind 14 caption message is sent

#### Scenario: Sending file message without caption
- **GIVEN** the user has selected a file to send
- **AND** the caption input field is empty
- **WHEN** the file message is sent
- **THEN** a kind 15 event is created without an `alt` tag
- **AND** no separate message is sent

#### Scenario: Receiving file message with alt tag
- **GIVEN** the user receives a kind 15 file message
- **AND** the message contains an `['alt', caption]` tag
- **WHEN** the message is processed and stored
- **THEN** the caption text from the `alt` tag is stored in the message's text field
- **AND** the caption is displayed below the media content in the chat view

#### Scenario: Receiving file message without alt tag
- **GIVEN** the user receives a kind 15 file message
- **AND** the message does not contain an `alt` tag
- **WHEN** the message is processed and stored
- **THEN** the message's text field is empty
- **AND** no caption is displayed below the media content

#### Scenario: Searching for file message captions
- **GIVEN** a conversation contains file messages with captions stored via `alt` tag
- **WHEN** the user searches for text that matches a caption
- **THEN** the file message with that caption appears in search results
- **AND** the search highlight is applied to the caption text below the media

## REMOVED Requirements

### Requirement: Two-Message Caption Approach

**Reason**: Replaced by simpler `alt` tag approach in kind 15 messages. The two-message approach required complex caption grouping logic to link kind 14 caption messages to their parent kind 15 file messages.

**Migration**: Old caption messages (kind 14 with `parentRumorId` referencing a kind 15 message) will appear as regular standalone text messages. No automatic migration is provided.
