## ADDED Requirements

### Requirement: Unified Message Send Pipeline
The messaging service SHALL use a single internal delivery pipeline for all outbound message types (Kind 14 text, Kind 15 file, Kind 7 reaction) across both 1-on-1 DM and group conversations. The pipeline SHALL handle authentication, messaging relay discovery, temporary relay connections, NIP-59 gift-wrap creation per recipient, publishing with deadline, retry queue enrollment for failed relays, self-wrap delivery, and local database persistence. Message type-specific logic (rumor construction, file encryption/upload) SHALL be performed by thin caller functions that delegate to the unified pipeline for delivery.

#### Scenario: Text DM uses unified pipeline
- **WHEN** the user sends a text message to a single recipient
- **THEN** the messaging service SHALL build a Kind 14 rumor with appropriate tags
- **AND** SHALL delegate to the unified send pipeline with a single-element recipient list
- **AND** the pipeline SHALL discover recipient and sender messaging relays, create gift-wraps, publish with deadline, and save to the local database

#### Scenario: Group file message uses unified pipeline with publishWithDeadline
- **WHEN** the user sends a file message in a group conversation
- **THEN** the messaging service SHALL encrypt the file, upload to Blossom, and build a Kind 15 rumor
- **AND** SHALL delegate to the unified send pipeline with the full participant list
- **AND** the pipeline SHALL use publishWithDeadline for each participant's gift-wrap (not retry-queue-only)
- **AND** failed relays SHALL be enqueued to the retry queue after the deadline attempt

#### Scenario: Reaction in group uses unified pipeline
- **WHEN** the user sends a reaction in a group conversation
- **THEN** the messaging service SHALL build a Kind 7 rumor with appropriate e-tag and p-tags
- **AND** SHALL delegate to the unified send pipeline with the full participant list
- **AND** the pipeline SHALL create per-recipient gift-wraps and publish using the same strategy as text and file messages

#### Scenario: Pipeline handles DM vs group post-send hooks
- **GIVEN** the unified pipeline has successfully published gift-wraps and saved the message to the database
- **WHEN** the recipient list contains exactly one entry (DM mode)
- **THEN** the pipeline SHALL call autoAddContact for the recipient
- **WHEN** the recipient list contains more than one entry (group mode)
- **THEN** the pipeline SHALL call markActivity on the conversation
- **AND** SHALL NOT call autoAddContact

## MODIFIED Requirements

### Requirement: Group Message Sending
The system SHALL support sending messages to group conversations by creating and publishing a gift-wrap to each participant using publishWithDeadline with the same deadline as 1-on-1 DMs. The rumor SHALL contain a `p` tag for each recipient. On first message to a new group, the rumor SHALL include a `subject` tag with the group title. Failed relay deliveries SHALL be enqueued to the retry queue after the publish deadline expires.

#### Scenario: Group message sent to all participants
- **GIVEN** the user composes a message in a group chat with participants Alice, Bob, and Carol
- **WHEN** the user sends the message
- **THEN** the system SHALL create a rumor with `p` tags for Alice, Bob, and Carol
- **AND** SHALL create a gift-wrap addressed to Alice and publish to Alice's messaging relays using publishWithDeadline
- **AND** SHALL create a gift-wrap addressed to Bob and publish to Bob's messaging relays using publishWithDeadline
- **AND** SHALL create a gift-wrap addressed to Carol and publish to Carol's messaging relays using publishWithDeadline
- **AND** SHALL create a self-wrap and publish to the sender's messaging relays
- **AND** any relay that fails within the publish deadline SHALL be enqueued to the retry queue

#### Scenario: First group message includes subject tag
- **GIVEN** the user creates a new group chat with title "Project Team"
- **WHEN** the user sends the first message
- **THEN** the rumor SHALL include a `subject` tag with value "Project Team"
- **AND** subsequent messages in the same conversation MAY omit the `subject` tag
