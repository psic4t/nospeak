## ADDED Requirements

### Requirement: Create Group Chat Button
The Manage Contacts modal SHALL display a "Create group chat" button in the header area that opens the group chat creation interface.

#### Scenario: Create group chat button visible in modal
- **GIVEN** the user opens the Manage Contacts modal
- **WHEN** the modal renders
- **THEN** a "Create group chat" button SHALL be visible in the header area
- **AND** the button SHALL use a filled-tonal style with a group/users icon

#### Scenario: Create group chat button opens creation modal
- **GIVEN** the user is viewing the Manage Contacts modal
- **WHEN** the user clicks the "Create group chat" button
- **THEN** the group chat creation modal SHALL open
- **AND** the Manage Contacts modal MAY remain visible underneath or close

### Requirement: Group Chat Creation Modal
The system SHALL provide a dedicated modal for creating group chats that allows users to select multiple contacts. The modal SHALL include a search field for filtering contacts, a scrollable contact list with selection indicators, a count of selected contacts, and a primary "Create" button.

#### Scenario: Group creation modal displays contacts with selection
- **GIVEN** the user opens the group chat creation modal
- **AND** the user has 10 contacts in their contact list
- **WHEN** the modal renders
- **THEN** all 10 contacts SHALL be displayed with their avatar, name, and a selection indicator
- **AND** on desktop, each contact row SHALL show a checkbox
- **AND** on mobile, the entire row SHALL be tappable to toggle selection

#### Scenario: Search filters contact list
- **GIVEN** the user opens the group chat creation modal
- **AND** begins typing "Ali" in the search field
- **WHEN** the search filter is applied
- **THEN** only contacts whose name contains "Ali" SHALL be displayed
- **AND** the selection state of hidden contacts SHALL be preserved

#### Scenario: Contact selection toggles on interaction
- **GIVEN** the user is viewing the group creation modal
- **AND** contact "Alice" is not selected
- **WHEN** the user clicks/taps on Alice's row (or checkbox on desktop)
- **THEN** Alice SHALL become selected
- **AND** a visual indicator (checkmark, highlighted row) SHALL show selection state
- **AND** the selected count SHALL increment

#### Scenario: Selected count displayed
- **GIVEN** the user has selected 3 contacts in the group creation modal
- **WHEN** the modal renders
- **THEN** a count indicator SHALL display "3 selected" or similar
- **AND** the count SHALL update in real-time as contacts are selected/deselected

#### Scenario: Create button requires minimum selection
- **GIVEN** the user opens the group chat creation modal
- **AND** fewer than 2 contacts are selected
- **WHEN** the modal renders
- **THEN** the "Create" button SHALL be disabled
- **AND** a hint MAY indicate that at least 2 contacts are required

#### Scenario: Create button enabled with sufficient selection
- **GIVEN** the user has selected 2 or more contacts
- **WHEN** the modal renders
- **THEN** the "Create" button SHALL be enabled
- **AND** the user can proceed with group creation

### Requirement: Group Chat Creation and Navigation
When the user confirms group creation, the system SHALL create the conversation, generate an initial title from participant names, and navigate to the new group chat.

#### Scenario: Group created with auto-generated title
- **GIVEN** the user has selected contacts Alice, Bob, and Carol
- **WHEN** the user clicks the "Create" button
- **THEN** a new group conversation SHALL be created
- **AND** the conversation ID SHALL be derived from sorted participant pubkeys
- **AND** the initial title SHALL be "Alice, Bob, Carol" (using display names)

#### Scenario: Navigation to new group after creation
- **GIVEN** the user completes group creation
- **WHEN** the conversation is successfully created
- **THEN** the group creation modal SHALL close
- **AND** the system SHALL navigate to `/chat/<conversationId>`
- **AND** the new group chat view SHALL be displayed (empty, ready for first message)

#### Scenario: Title truncation for many participants
- **GIVEN** the user selects 6 contacts for a group
- **WHEN** the system generates the auto-title
- **THEN** the title SHALL be truncated (e.g., "Alice, Bob, Carol, +3 more")
- **AND** the total title length SHALL not exceed 50 characters
