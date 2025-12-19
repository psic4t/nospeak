## ADDED Requirements

### Requirement: Message-Level Unread Markers
The system SHALL persist a per-user list of unseen message IDs per conversation and SHALL visually mark those messages when the user opens the conversation.

#### Scenario: Received message while not actively viewing conversation becomes unread
- **GIVEN** the user is authenticated
- **AND** Contact A is an existing contact or is auto-added as a contact upon message receipt
- **AND** the user is NOT actively viewing Contact A’s conversation (either not on `/chat/<ContactA>`, or the app is not visible, or the app does not have focus)
- **WHEN** a new direct message is received from Contact A
- **THEN** the system SHALL append the message’s event ID to Contact A’s unread message list in `localStorage`
- **AND** the unread list SHALL NOT include messages authored by the current user.

#### Scenario: Received message while actively viewing conversation is not persisted as unread
- **GIVEN** the user is authenticated
- **AND** the user is actively viewing Contact A’s conversation (`/chat/<ContactA>`)
- **AND** the app is visible and focused
- **WHEN** a new direct message is received from Contact A
- **THEN** the system SHALL NOT persist this message in the unread list in `localStorage`.

#### Scenario: Opening a conversation displays and clears unread markers
- **GIVEN** Contact A has one or more unread message IDs stored in `localStorage`
- **WHEN** the user opens Contact A’s conversation
- **THEN** the conversation UI SHALL render a subtle visual marker (left accent) for each unread message that is present in the currently rendered message list
- **AND** the system SHALL clear *all* unread entries for Contact A (messages and reactions) from `localStorage` after opening the conversation.

#### Scenario: Sending a message clears unread markers in that conversation
- **GIVEN** Contact A has unread entries in `localStorage`
- **WHEN** the user successfully sends a message to Contact A
- **THEN** the system SHALL clear *all* unread entries for Contact A (messages and reactions) from `localStorage`.

### Requirement: Unread Activity Includes Reactions
The system SHALL treat incoming reactions as unread activity for badge counts and per-conversation unread state.

#### Scenario: Received reaction while not actively viewing conversation becomes unread activity
- **GIVEN** the user is authenticated
- **AND** the user is NOT actively viewing Contact A’s conversation (either not on `/chat/<ContactA>`, or the app is not visible, or the app does not have focus)
- **WHEN** a new reaction event is received from Contact A
- **THEN** the system SHALL append the reaction event ID to Contact A’s unread reaction list in `localStorage`
- **AND** each reaction event SHALL count as a distinct unread item.

#### Scenario: Opening conversation clears unread activity
- **GIVEN** Contact A has one or more unread reaction event IDs stored in `localStorage`
- **WHEN** the user opens Contact A’s conversation
- **THEN** the system SHALL clear Contact A’s unread reaction entries from `localStorage`.

### Requirement: First-Time Sync Does Not Create Unread Markers
The system SHALL NOT create unread markers from the first-time history sync when the local message cache is empty.

#### Scenario: First-time sync does not generate unread lists
- **GIVEN** the user logs in for the first time with an empty local message cache
- **WHEN** the application fetches historical messages from relays as part of first-time sync
- **THEN** the system SHALL NOT add any of those historical messages to the unread lists in `localStorage`.

### Requirement: PWA App Badge Reflects Unread Count
When supported, the system SHALL set the PWA app badge count to the total number of unread message IDs and unread reaction event IDs across all conversations.

#### Scenario: Badge updates when unread count changes
- **GIVEN** the browser supports the Badging API
- **WHEN** the total unread count changes due to a new unread message or reaction being recorded
- **THEN** the system SHALL call `navigator.setAppBadge(<totalUnread>)` with the updated total.

#### Scenario: Badge cleared when unread count reaches zero
- **GIVEN** the browser supports the Badging API
- **WHEN** the total unread count reaches zero
- **THEN** the system SHOULD clear the badge via `navigator.clearAppBadge()` when available.

### Requirement: Ephemeral Highlight for New Messages While Active
The system SHALL support applying an ephemeral left-accent marker to newly received messages while the user is actively viewing the conversation, without persisting them as unread.

#### Scenario: New message highlight is ephemeral
- **GIVEN** the user is actively viewing Contact A’s conversation (`/chat/<ContactA>`) and the app is visible and focused
- **WHEN** a new message is received from Contact A
- **THEN** the UI MAY highlight that message with the left-accent marker
- **AND** the system SHALL NOT write this message to the unread list in `localStorage`
- **AND** the highlight SHALL be cleared when the app loses focus, becomes hidden, or the user sends a message in that conversation.
