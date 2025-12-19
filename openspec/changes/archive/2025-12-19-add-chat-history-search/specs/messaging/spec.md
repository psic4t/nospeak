## ADDED Requirements

### Requirement: Chat History Search
The messaging UI SHALL provide a chat-history search control for an active conversation that filters locally stored (IndexedDB) messages as the user types.

#### Scenario: Search control placement and toggle
- **GIVEN** the user is viewing a 1:1 conversation chat
- **WHEN** the user views the chat header
- **THEN** a search (magnifying-glass) icon SHALL be visible on the right side of the chat top bar
- **WHEN** the user clicks the search icon
- **THEN** a search input SHALL slide out from the right side of the header and expand to the left

#### Scenario: Escape closes search and clears query
- **GIVEN** the user has the chat search input open
- **AND** the search query is non-empty
- **WHEN** the user presses Escape
- **THEN** the search UI SHALL close
- **AND** the search query SHALL be cleared
- **AND** the chat view SHALL return to the default (non-filtered) message timeline

#### Scenario: Find-as-you-type filters IndexedDB messages
- **GIVEN** the user has the chat search input open
- **WHEN** the user types a search query
- **THEN** the message list SHALL update as the user types (debounced)
- **AND** the message list SHALL include only messages whose message/caption text contains the query substring
- **AND** the filtering SHALL use messages stored locally in IndexedDB for that conversation
- **AND** the filtering SHALL be case-insensitive

#### Scenario: Caption match displays file bubble and caption
- **GIVEN** a conversation contains a file message with an associated caption message
- **WHEN** the user’s search query matches the caption text
- **THEN** the results SHALL display the file message bubble
- **AND** SHALL display the caption as part of the same visual message unit (under the file bubble)

#### Scenario: Matching text is highlighted
- **GIVEN** the message list is filtered by a non-empty search query
- **WHEN** a rendered message or caption contains a matching substring
- **THEN** the UI SHALL visually highlight the matching substring within the message bubble and caption

#### Scenario: Search is not available in the aggregated chat view
- **GIVEN** the user is viewing the aggregated chat view (`partnerNpub === 'ALL'`)
- **WHEN** the user views the chat header
- **THEN** the chat-history search control SHALL NOT be shown
