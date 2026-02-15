# chat-archiving Specification

## Purpose
Enable users to archive conversations, hiding them from the default chat list while preserving access and syncing state across devices via Nostr relays.

## Requirements

### Requirement: Archive Storage

The system SHALL store archived conversation IDs in an encrypted list named "dm-archive" using Kind 30000 parameterized replaceable events.

#### Scenario: Archive a conversation
- **GIVEN** a user has an active conversation
- **WHEN** the user selects "Archive" from the chat context menu
- **THEN** the conversation ID is added to the local archives table
- **AND** the archive state is published to Nostr relays as an encrypted Kind 30000 event

#### Scenario: Unarchive a conversation
- **GIVEN** a user has an archived conversation
- **WHEN** the user selects "Unarchive" from the archive view context menu
- **THEN** the conversation ID is removed from the local archives table
- **AND** the updated archive state is published to Nostr relays

#### Scenario: Sync archives across devices
- **GIVEN** a user has archived chats on Device A
- **WHEN** the user opens the app on Device B and navigates to the Archive tab in the chat list
- **THEN** the archived conversation IDs are fetched from Nostr relays
- **AND** synced into local archives using full replace strategy where the relay list is authoritative: local archives absent from the relay list are removed, and relay archives absent locally are added

### Requirement: Archive User Interface

The system SHALL provide user interface elements for archiving and viewing archived conversations.

#### Scenario: Archive via context menu (mobile)
- **GIVEN** the user is viewing the chat list
- **WHEN** the user long-presses on a chat item for 500ms
- **THEN** a context menu appears with "Archive" as the first option

#### Scenario: Archive via context menu (desktop)
- **GIVEN** the user is viewing the chat list
- **WHEN** the user clicks the 3-dot menu button on a chat item
- **THEN** a context menu appears with "Archive" as the first option

#### Scenario: View archived chats
- **GIVEN** the user has archived conversations
- **WHEN** the user selects the "Archive" tab in the chat list
- **THEN** only archived conversations are displayed
- **AND** each shows unread indicators if applicable

#### Scenario: Unarchive from archive view
- **GIVEN** the user is viewing archived chats
- **WHEN** the user opens the context menu on an archived chat
- **THEN** the first option shows "Unarchive"
- **AND** selecting it moves the chat back to the main list

### Requirement: Archive Filtering

The system SHALL filter archived conversations from the default chat list view.

#### Scenario: Archived chats hidden from All tab
- **GIVEN** the user has archived conversations
- **WHEN** the user views the "All" tab
- **THEN** archived conversations are not displayed

#### Scenario: Archived chats hidden from Unread tab
- **GIVEN** the user has archived conversations with unread messages
- **WHEN** the user views the "Unread" tab
- **THEN** archived conversations are not displayed even if unread

#### Scenario: Archived chats hidden from Groups tab
- **GIVEN** the user has archived group conversations
- **WHEN** the user views the "Groups" tab
- **THEN** archived group conversations are not displayed
