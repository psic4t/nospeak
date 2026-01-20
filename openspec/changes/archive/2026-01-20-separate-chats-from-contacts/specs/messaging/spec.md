## MODIFIED Requirements

### Requirement: Manage Contacts Modal Contact Display
The Manage Contacts modal SHALL display each contact using their profile picture and resolved username when available, with the shortened npub still visible but visually secondary. Clicking a contact row SHALL close the modal and navigate to the chat view for that contact.

#### Scenario: Contact with cached profile metadata
- **GIVEN** the user opens the Manage Contacts modal
- **AND** Contact A has cached profile metadata including `name` or `display_name` and `picture`
- **WHEN** the contact list is rendered in the modal
- **THEN** Contact A is shown with their profile picture avatar
- **AND** Contact A's username (derived from profile metadata) is displayed as the primary text
- **AND** Contact A's shortened npub is displayed as secondary text next to or below the username

#### Scenario: Contact without cached profile metadata
- **GIVEN** the user opens the Manage Contacts modal
- **AND** Contact B does not have cached profile metadata
- **WHEN** the contact list is rendered in the modal
- **THEN** Contact B is shown with a fallback avatar based on their npub
- **AND** Contact B's shortened npub is displayed as the primary text

#### Scenario: New contact added with profile lookup
- **GIVEN** the user enters a valid npub for Contact C in the Manage Contacts modal
- **WHEN** the system successfully resolves Contact C's profile and adds them to the contact list
- **THEN** Contact C appears in the modal with their profile picture avatar when available
- **AND** Contact C's username is displayed as the primary text when available
- **AND** Contact C's shortened npub remains visible as secondary text

#### Scenario: Contact click navigates to chat
- **GIVEN** the user has opened the Manage Contacts modal
- **AND** the modal displays a list of existing contacts
- **WHEN** the user clicks on a contact row (not the remove button)
- **THEN** the modal SHALL close
- **AND** the system SHALL navigate to `/chat/<npub>` for the selected contact

### Requirement: Mobile contacts header shows app name
The chats sidebar header on mobile-sized layouts SHALL display the nospeak app name label next to the current user's avatar so that users can clearly recognize the app context when viewing or switching chats.

#### Scenario: Mobile chats header includes app name
- **GIVEN** the user is authenticated and viewing the chats list
- **AND** the viewport corresponds to a mobile-sized layout (for example, screen width <= 768px or native mobile shell)
- **WHEN** the chats sidebar header is rendered
- **THEN** the current user's avatar is shown
- **AND** a textual "nospeak" label appears adjacent to the avatar within the same header grouping
- **AND** the existing settings control remains accessible on the opposite side of the header without overlapping the label
