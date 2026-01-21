## ADDED Requirements

### Requirement: Group Chat Message Identification
The system SHALL identify group chat messages by the presence of multiple `p` tags in the decrypted NIP-17 rumor. A message with two or more `p` tags SHALL be treated as a group message. The set of `p` tag pubkeys (including the sender) defines the conversation participants.

#### Scenario: Message with multiple p-tags identified as group
- **GIVEN** a gift-wrap event is received and decrypted
- **AND** the inner rumor contains two or more `p` tags
- **WHEN** the system processes the rumor
- **THEN** it SHALL be identified as a group chat message
- **AND** all pubkeys from `p` tags plus the sender pubkey SHALL be recorded as participants

#### Scenario: Message with single p-tag remains 1-on-1
- **GIVEN** a gift-wrap event is received and decrypted
- **AND** the inner rumor contains exactly one `p` tag
- **WHEN** the system processes the rumor
- **THEN** it SHALL be treated as a 1-on-1 direct message
- **AND** the existing `recipientNpub`-based conversation logic SHALL apply

### Requirement: Deterministic Conversation ID for Groups
The system SHALL derive a deterministic conversation ID for group chats using the SHA-256 hash of sorted participant pubkeys. The conversation ID SHALL be the first 16 hexadecimal characters of the hash. For 1-on-1 chats, the conversation ID SHALL remain the partner's npub for backward compatibility.

#### Scenario: Group conversation ID derived from participants
- **GIVEN** a group message involves participants with hex pubkeys `aaa...`, `bbb...`, and `ccc...`
- **WHEN** the system derives the conversation ID
- **THEN** it SHALL sort the pubkeys alphabetically
- **AND** concatenate them into a single string
- **AND** compute SHA-256 of the concatenated string
- **AND** use the first 16 characters of the hex-encoded hash as the conversation ID

#### Scenario: Same participants produce same conversation ID
- **GIVEN** two clients receive messages for the same group conversation
- **AND** both derive the conversation ID from the same set of participant pubkeys
- **WHEN** each client computes the conversation ID
- **THEN** both clients SHALL produce identical conversation IDs

#### Scenario: 1-on-1 conversation ID uses npub
- **GIVEN** a direct message between two users
- **WHEN** the system determines the conversation ID
- **THEN** it SHALL use the partner's npub as the conversation ID
- **AND** existing message queries by `recipientNpub` SHALL continue to work

### Requirement: Group Message Storage
The system SHALL store group messages with a `conversationId` field for efficient querying and a `participants` field containing the npubs of all conversation members. The existing `recipientNpub` field SHALL be populated with the first participant npub (excluding self) for backward compatibility with existing queries.

#### Scenario: Group message stored with conversation metadata
- **GIVEN** a group message is received or sent
- **WHEN** the system saves the message to the database
- **THEN** the `conversationId` field SHALL contain the derived group hash
- **AND** the `participants` field SHALL contain an array of all participant npubs
- **AND** the `recipientNpub` field SHALL contain the first non-self participant npub

#### Scenario: Group messages queryable by conversation ID
- **GIVEN** the user opens a group chat
- **WHEN** the system queries messages for display
- **THEN** it SHALL query by `conversationId` to retrieve all group messages
- **AND** messages SHALL be ordered by `sentAt` timestamp

### Requirement: Group Message Sending
The system SHALL support sending messages to group conversations by creating and publishing a gift-wrap to each participant. The rumor SHALL contain a `p` tag for each recipient. On first message to a new group, the rumor SHALL include a `subject` tag with the group title.

#### Scenario: Group message sent to all participants
- **GIVEN** the user composes a message in a group chat with participants Alice, Bob, and Carol
- **WHEN** the user sends the message
- **THEN** the system SHALL create a rumor with `p` tags for Alice, Bob, and Carol
- **AND** SHALL create a gift-wrap addressed to Alice and publish to Alice's messaging relays
- **AND** SHALL create a gift-wrap addressed to Bob and publish to Bob's messaging relays
- **AND** SHALL create a gift-wrap addressed to Carol and publish to Carol's messaging relays
- **AND** SHALL create a self-wrap and publish to the sender's messaging relays

#### Scenario: First group message includes subject tag
- **GIVEN** the user creates a new group chat with title "Project Team"
- **WHEN** the user sends the first message
- **THEN** the rumor SHALL include a `subject` tag with value "Project Team"
- **AND** subsequent messages in the same conversation MAY omit the `subject` tag

### Requirement: Group Chat Conversation List Display
The chat list SHALL display group conversations with visual distinction from 1-on-1 chats. Group conversations SHALL show a stacked avatar of participants (up to 3 visible) and the group title or auto-generated participant names.

#### Scenario: Group chat shows stacked avatars
- **GIVEN** the user views the chat list
- **AND** a group conversation exists with participants Alice, Bob, and Carol
- **WHEN** the chat list renders the group entry
- **THEN** it SHALL display up to 3 participant avatars in a stacked/overlapping arrangement
- **AND** the primary display name SHALL be the group title if set, otherwise "Alice, Bob, Carol"

#### Scenario: Group title truncated for long participant lists
- **GIVEN** a group conversation has 5+ participants with no custom title
- **WHEN** the system generates the display name
- **THEN** it SHALL truncate to show first names plus "+N more" (e.g., "Alice, Bob, +3 more")
- **AND** the total display name SHALL not exceed 50 characters

### Requirement: Group Chat View Header
The chat view header for group conversations SHALL display the group title, participant count, and a tappable area to view the full participant list.

#### Scenario: Group chat header shows title and count
- **GIVEN** the user opens a group chat titled "Project Team" with 4 participants
- **WHEN** the chat view renders
- **THEN** the header SHALL display "Project Team"
- **AND** SHALL display "4 participants" or similar count indicator
- **AND** SHALL show a GroupAvatar component instead of single avatar

#### Scenario: Tapping header reveals participant list
- **GIVEN** the user is viewing a group chat
- **WHEN** the user taps on the chat header
- **THEN** a participant list view SHALL appear
- **AND** SHALL show each participant's avatar, name, and npub

### Requirement: Message Sender Attribution in Groups
In group chat conversations, each message bubble SHALL display the sender's name above the message content for messages from other participants. Messages sent by the current user SHALL not show sender attribution.

#### Scenario: Received group message shows sender name
- **GIVEN** the user is viewing a group chat
- **AND** a message was sent by participant Alice
- **WHEN** the message bubble renders
- **THEN** Alice's display name SHALL appear above the message content
- **AND** the name SHALL use a muted text style

#### Scenario: Own messages do not show sender name
- **GIVEN** the user is viewing a group chat
- **AND** a message was sent by the current user
- **WHEN** the message bubble renders
- **THEN** no sender name SHALL appear above the message content
- **AND** the message SHALL be styled as an outgoing message (right-aligned)

### Requirement: Group Chat Route Handling
The chat route SHALL accept both npub identifiers (for 1-on-1 chats) and conversation ID hashes (for group chats). The system SHALL detect the format and load the appropriate conversation.

#### Scenario: Route with npub loads 1-on-1 chat
- **GIVEN** the user navigates to `/chat/npub1abc...`
- **WHEN** the route handler processes the parameter
- **THEN** it SHALL detect the `npub1` prefix
- **AND** SHALL load the 1-on-1 conversation with that contact

#### Scenario: Route with hash loads group chat
- **GIVEN** the user navigates to `/chat/a1b2c3d4e5f67890`
- **AND** a group conversation exists with that conversation ID
- **WHEN** the route handler processes the parameter
- **THEN** it SHALL detect the non-npub format
- **AND** SHALL load the group conversation metadata and messages
