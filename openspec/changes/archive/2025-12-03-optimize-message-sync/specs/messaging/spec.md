## ADDED Requirements
### Requirement: Message Synchronization
The system SHALL synchronize message history efficiently by downloading only missing messages and processing them in batches.

#### Scenario: Incremental history fetch
- **GIVEN** the user has existing messages up to timestamp T
- **WHEN** the application starts
- **THEN** it fetches history backwards from now
- **AND** it stops fetching automatically when it encounters messages older than T that are already stored locally

#### Scenario: Pipeline processing
- **WHEN** a batch of historical messages is received
- **THEN** the system decrypts and saves them immediately
- **AND** the UI updates to show them (if within view) before the next batch is requested

#### Scenario: Real-time subscription compatibility with NIP-59
- **GIVEN** gift-wrap events may use randomized `created_at` timestamps (NIP-59 style)
- **WHEN** optimizing history sync and live subscriptions together
- **THEN** the system SHALL avoid using a strict "since now" filter on the real-time subscription that would exclude valid backdated gift-wraps
- **AND** it SHALL rely on event ID-based deduplication so that messages fetched via history sync and messages delivered via live subscription do not appear twice

### Requirement: Message History Display
The chat interface SHALL implement infinite scrolling to handle large message histories without performance degradation.

#### Scenario: Initial load limit
- **GIVEN** a conversation with thousands of messages
- **WHEN** the user opens the chat
- **THEN** only the most recent 50 messages are loaded and rendered
- **AND** the application is responsive immediately

#### Scenario: Load older messages
- **GIVEN** the user is viewing the chat
- **WHEN** the user scrolls to the top of the message list
- **THEN** the next batch of older messages is loaded from the database
- **AND** inserted at the top of the list without disrupting the scroll position
