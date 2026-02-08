# chat-list Specification

## Purpose
Define the chat list UI behaviors including filter tabs, context menus, and archive integration.

## Requirements

### Requirement: Archive Tab

The chat list SHALL include an "Archive" filter tab alongside existing tabs (All, Unread, Groups).

#### Scenario: Archive tab visibility
- **GIVEN** the chat list is displayed
- **WHEN** the user views the filter tabs
- **THEN** four tabs are shown: All, Unread, Groups, Archive
- **AND** the Archive tab displays a count badge when archived chats exist

#### Scenario: Switch to Archive tab
- **GIVEN** the user is viewing the chat list
- **WHEN** the user clicks the Archive tab
- **THEN** the view updates to show only archived conversations
- **AND** archived conversations display unread indicators if applicable

### Requirement: Chat List Context Menu

Each chat item in the list SHALL provide access to a context menu for archiving.

#### Scenario: Mobile long-press context menu
- **GIVEN** the user is on a mobile device
- **WHEN** the user long-presses a chat item for 500ms
- **THEN** a context menu appears at the touch position
- **AND** the first option is "Archive" (or "Unarchive" if already archived)

#### Scenario: Desktop 3-dot context menu
- **GIVEN** the user is on a desktop device
- **WHEN** the user clicks the 3-dot menu button on a chat item
- **THEN** a context menu appears below the button
- **AND** the first option is "Archive" (or "Unarchive" if already archived)

#### Scenario: Context menu positioning
- **GIVEN** a context menu is triggered
- **WHEN** the menu would extend beyond viewport boundaries
- **THEN** the menu is repositioned to stay within viewport with 8px padding
