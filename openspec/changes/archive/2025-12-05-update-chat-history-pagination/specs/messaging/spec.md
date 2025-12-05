## MODIFIED Requirements
### Requirement: Message History Display
The chat interface SHALL implement infinite scrolling to handle large message histories without performance degradation.

#### Scenario: Initial load limit
- **GIVEN** a conversation with thousands of messages
- **WHEN** the user opens the chat
- **THEN** only the most recent 50 messages are loaded and rendered
- **AND** the application is responsive immediately

#### Scenario: Load older messages from cache first
- **GIVEN** the user is viewing the chat
- **AND** additional older messages for this conversation exist in the local database
- **WHEN** the user scrolls to the top of the message list
- **THEN** the next batch of older messages is loaded from the database only
- **AND** inserted at the top of the list without disrupting the scroll position
- **AND** no network history fetch is triggered for this scroll action.

#### Scenario: Fallback to network when cache is exhausted
- **GIVEN** the user is viewing the chat
- **AND** the local database has no additional older messages for this conversation (or fewer than the configured page size, indicating potential gaps)
- **WHEN** the user requests older history (for example, by clicking a "Fetch older messages from relays" control shown at the top of the conversation)
- **THEN** the system MAY trigger a targeted history backfill using `fetchOlderMessages` to request older messages from relays
- **AND** any newly fetched messages are saved into the local database and then appended to the top of the visible history without creating duplicate entries.

#### Scenario: Status when no more relay history exists
- **GIVEN** the user has requested older history from relays for a conversation whose local cache is already exhausted
- **WHEN** the targeted history backfill completes and returns no additional messages from any connected relay
- **THEN** the system SHALL display a non-intrusive status near the top of the message list indicating that no more messages are available from relays for this conversation
- **AND** the UI SHALL avoid offering further relay history fetch actions for that conversation unless the user explicitly refreshes or reconnects.

### Requirement: Message Synchronization
The system SHALL synchronize message history efficiently by downloading only missing messages and processing them in batches. On first-time sync (empty local cache), the system SHALL fetch ALL available messages from relays. On subsequent syncs, the system SHALL fetch only recent messages to fill gaps.

#### Scenario: First-time sync (empty cache)
- **GIVEN** the user logs in for the first time (no messages in local cache)
- **WHEN** the application starts message synchronization
- **THEN** it fetches ALL messages from relays in batches
- **AND** continues fetching until relays return empty results
- **AND** displays sync progress showing message count

#### Scenario: Returning user sync (existing cache)
- **GIVEN** the user has existing messages in local cache
- **WHEN** the application starts
- **THEN** it fetches only the most recent batch of messages (50)
- **AND** stops fetching when it encounters known messages

#### Scenario: Incremental history fetch
- **GIVEN** the user has existing messages up to timestamp T
- **WHEN** the application starts
- **THEN** it fetches history backwards from now
- **AND** it stops fetching automatically when it encounters messages older than T that are already stored locally

#### Scenario: Pipeline processing
- **WHEN** a batch of historical messages is received
- **THEN** the system decrypts and saves them immediately
- **AND** the UI updates to show them (if within view) before the next batch is requested
- **AND** any messages fetched via history sync that are later delivered again via the real-time subscription SHALL be identified by event ID and ignored to prevent duplication
