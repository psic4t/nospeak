# contacts Specification

## Purpose
TBD - created by archiving change separate-chats-from-contacts. Update Purpose after archive.
## Requirements
### Requirement: Contact Storage via Kind 30000 Encrypted Follow Set
The system SHALL store the user's contacts as a Kind 30000 parameterized replaceable event with `d` tag value `dm-contacts`. Contact pubkeys SHALL be stored privately in the encrypted content field using NIP-44 self-encryption, not as public `p` tags. The event SHALL be published to both messaging relays and discovery relays when contacts change.

#### Scenario: Contact list published on contact add
- **GIVEN** the user adds a new contact via the Manage Contacts modal
- **WHEN** the contact is successfully added to local storage
- **THEN** the system SHALL publish an updated Kind 30000 event with `d: "dm-contacts"`
- **AND** the content field SHALL contain NIP-44 encrypted JSON array of `[["p", "<pubkey>"], ...]` tags
- **AND** the event SHALL be published to the user's messaging relays and discovery relays

#### Scenario: Contact list published on contact remove
- **GIVEN** the user removes a contact via the Manage Contacts modal
- **WHEN** the contact is removed from local storage
- **THEN** the system SHALL publish an updated Kind 30000 event reflecting the removal
- **AND** the encrypted content SHALL no longer include the removed contact's pubkey

#### Scenario: Contact list fetched on profile refresh
- **GIVEN** the user is authenticated and a profile refresh is triggered
- **WHEN** the system fetches profile data from relays
- **THEN** it SHALL also fetch the user's Kind 30000 event with `d: "dm-contacts"`
- **AND** decrypt the content using NIP-44
- **AND** merge any remote contacts not in local storage using union merge (never delete)

### Requirement: Contact Auto-Add and Sync on Unknown Message
When a message is received from an unknown sender, the system SHALL auto-add the sender as a contact and trigger a Kind 30000 sync to persist the new contact.

#### Scenario: Unknown sender auto-added and synced
- **GIVEN** a gift-wrap message is received from a pubkey not in the user's contacts
- **WHEN** the message is successfully decrypted and processed
- **THEN** the sender SHALL be auto-added as a contact with `lastReadAt = 0` (unread)
- **AND** the system SHALL publish an updated Kind 30000 event including the new contact

### Requirement: Manage Contacts Modal Navigation
The Manage Contacts modal SHALL allow users to navigate directly to a chat with a contact by clicking on that contact's row. Clicking a contact SHALL close the modal and navigate to the chat view for that contact. The modal SHALL NOT display a direct delete button on each contact row; instead, contact deletion SHALL be accessible via the contact context menu.

#### Scenario: Contact click opens chat
- **GIVEN** the user has opened the Manage Contacts modal
- **AND** the modal displays a list of existing contacts
- **WHEN** the user clicks on a contact row (not on the 3-dot menu button)
- **THEN** the modal SHALL close
- **AND** the system SHALL navigate to the chat view for that contact at `/chat/<npub>`
- **AND** if no prior conversation exists, an empty chat SHALL be displayed

#### Scenario: Delete button not shown on contact rows
- **GIVEN** the user has opened the Manage Contacts modal
- **WHEN** the contact list is rendered
- **THEN** there SHALL NOT be a visible delete button (trash icon) directly on each contact row
- **AND** the delete action SHALL only be accessible via the context menu

### Requirement: New Contact Button in Manage Contacts Modal
The Manage Contacts modal SHALL display a "New Contact" button at the top of the contact list that activates the search/add mode, allowing users to add contacts by npub, NIP-05, or search.

#### Scenario: New Contact button activates search mode
- **GIVEN** the user has opened the Manage Contacts modal
- **WHEN** the user clicks the "New Contact" button
- **THEN** the search input field SHALL receive focus
- **AND** the user can enter an npub, NIP-05 identifier, or search term to add a new contact

### Requirement: Chat List Sidebar with FAB Button
The main sidebar SHALL be named "Chats" (internally `chatList`) and SHALL display a floating action button (FAB) in the lower-right corner that opens the Manage Contacts modal when tapped.

#### Scenario: FAB button opens contacts modal
- **GIVEN** the user is viewing the Chats sidebar
- **WHEN** the user taps the FAB (+) button in the lower-right corner
- **THEN** the Manage Contacts modal SHALL open
- **AND** the user can view, add, or remove contacts

#### Scenario: Chats sidebar displays conversation list
- **GIVEN** the user is authenticated and has contacts with message history
- **WHEN** the Chats sidebar is rendered
- **THEN** it SHALL display contacts ordered by most recent message activity
- **AND** the header title SHALL display "Chats" instead of "Contacts"
- **AND** there SHALL be no "Manage" button in the header area

### Requirement: Profile Resolution Uses Discovery Relays
When resolving a contact's profile (kind 0, 10050, 10002, 10063 events), the system SHALL query both the user's connected messaging relays AND discovery relays. Discovery relay connections SHALL be temporary and cleaned up when the profile resolution completes.

#### Scenario: NIP-05 contact search finds profile on discovery relay
- **GIVEN** the user is searching for a contact via NIP-05 address (e.g., `alice@example.com`)
- **AND** the NIP-05 lookup successfully returns the contact's pubkey
- **AND** the contact's kind 0 profile event exists on a discovery relay but not on the user's messaging relays
- **WHEN** the system calls `ProfileResolver.resolveProfile()` for the contact
- **THEN** the system SHALL query both the user's messaging relays AND discovery relays
- **AND** the profile SHALL be successfully fetched from the discovery relay
- **AND** the contact's name and picture SHALL be displayed in the search results

#### Scenario: Discovery relay connections cleaned up after profile resolution
- **GIVEN** the system has connected to discovery relays as part of profile resolution
- **WHEN** the profile resolution subscription is closed (either by timeout or successful completion)
- **THEN** the temporary discovery relay connections that were added for this subscription SHALL be removed
- **AND** the user's persistent messaging relay connections SHALL remain active

### Requirement: Proactive Discovery Relay Connection on Search Input
When the user begins typing in the contact search field, the system SHALL proactively connect to discovery relays before the search query is executed. This ensures discovery relays are ready when the NIP-05 profile fetch is triggered.

#### Scenario: Discovery relays connected on first keystroke
- **GIVEN** the user opens the Manage Contacts modal or contacts page
- **AND** no search query has been entered yet
- **WHEN** the user types the first character in the search input field
- **THEN** the system SHALL initiate connections to all configured discovery relays
- **AND** these connections SHALL be established before the NIP-05 lookup debounce completes

#### Scenario: Discovery relay connection is idempotent
- **GIVEN** the user has already typed in the search field and discovery relays are connecting or connected
- **WHEN** the user continues typing additional characters
- **THEN** the system SHALL NOT attempt to connect to discovery relays again
- **AND** the existing connection attempts SHALL continue uninterrupted

### Requirement: Android Contacts Route
On the Android native app, contacts management SHALL be accessible via a dedicated `/contacts` route instead of a modal overlay. When the user navigates to `/contacts` on Android, the system SHALL display a full-screen contacts view with the same functionality as the Manage Contacts modal. On desktop and mobile web, navigating to `/contacts` SHALL redirect to `/chat` and open the Manage Contacts modal instead.

#### Scenario: Android app shows dedicated contacts route
- **GIVEN** the user is using the Android native app
- **WHEN** the user navigates to `/contacts`
- **THEN** the system SHALL display a full-screen contacts view
- **AND** the view SHALL include a header with back button and title "Contacts"
- **AND** the view SHALL include a search/add input field
- **AND** the view SHALL display the list of contacts with pull-to-refresh support

#### Scenario: Desktop redirects contacts route to modal
- **GIVEN** the user is using a desktop browser
- **WHEN** the user navigates to `/contacts`
- **THEN** the system SHALL redirect to `/chat`
- **AND** the Manage Contacts modal SHALL open automatically

#### Scenario: Android contacts route supports long-press context menu
- **GIVEN** the user is viewing the `/contacts` route on Android
- **WHEN** the user presses and holds on a contact row for at least 500ms
- **THEN** the context menu SHALL appear at the press location
- **AND** the menu SHALL display a "Delete" option

### Requirement: Contact Context Menu Interaction
The Manage Contacts modal and Android `/contacts` route SHALL provide a context menu for each contact row that allows users to perform actions such as deleting the contact. On mobile/PWA and Android, the context menu SHALL open via a long-press gesture (500ms threshold). On desktop (within the modal), the context menu SHALL also open via a 3-dot menu button that appears on hover in the lower-right area of the contact row. The menu SHALL appear at the location of the long-press or near the 3-dot button.

#### Scenario: Long-press opens context menu on mobile
- **GIVEN** the user is viewing the Manage Contacts modal on a mobile device or PWA
- **AND** the viewport width is less than 768px
- **WHEN** the user presses and holds on a contact row for at least 500ms
- **THEN** the context menu SHALL appear at the press location
- **AND** the menu SHALL display a "Delete" option
- **AND** the context menu SHALL close if the user taps outside of it

#### Scenario: Long-press opens context menu on Android contacts route
- **GIVEN** the user is viewing the `/contacts` route on Android native app
- **WHEN** the user presses and holds on a contact row for at least 500ms
- **THEN** the context menu SHALL appear at the press location
- **AND** the menu SHALL display a "Delete" option
- **AND** the context menu SHALL close if the user taps outside of it

#### Scenario: 3-dot button opens context menu on desktop
- **GIVEN** the user is viewing the Manage Contacts modal on a desktop device
- **AND** the viewport width is 768px or greater
- **WHEN** the user hovers over a contact row
- **THEN** a 3-dot menu button SHALL appear in the lower-right area of the row
- **AND** clicking the 3-dot button SHALL open the context menu near the button
- **AND** the context menu SHALL display a "Delete" option

#### Scenario: Context menu closes on outside click
- **GIVEN** the contact context menu is open
- **WHEN** the user clicks or taps outside the context menu
- **THEN** the context menu SHALL close immediately
- **AND** no action SHALL be performed

#### Scenario: Long-press cancelled by touch move
- **GIVEN** the user begins a long-press on a contact row on mobile or Android
- **WHEN** the user moves their finger more than 10 pixels before 500ms elapses
- **THEN** the long-press SHALL be cancelled
- **AND** the context menu SHALL NOT open

### Requirement: Contact Delete Confirmation Dialog
When the user selects "Delete" from the contact context menu, the system SHALL display a confirmation dialog asking "Are you sure you want to delete {contact name}?" with Cancel and Delete buttons. The contact SHALL only be removed if the user explicitly confirms the deletion.

#### Scenario: Delete option shows confirmation dialog
- **GIVEN** the contact context menu is open for a contact named "Alice"
- **WHEN** the user clicks/taps the "Delete" option
- **THEN** the context menu SHALL close
- **AND** a confirmation dialog SHALL appear with title "Delete Contact"
- **AND** the message SHALL read "Are you sure you want to delete Alice?"
- **AND** the dialog SHALL display Cancel and Delete buttons

#### Scenario: User confirms contact deletion
- **GIVEN** the delete confirmation dialog is open for contact "Alice"
- **WHEN** the user clicks/taps the "Delete" button
- **THEN** the contact SHALL be removed from local storage
- **AND** an updated Kind 30000 event SHALL be published to sync the removal
- **AND** the confirmation dialog SHALL close

#### Scenario: User cancels contact deletion
- **GIVEN** the delete confirmation dialog is open
- **WHEN** the user clicks/taps the "Cancel" button or clicks outside the dialog
- **THEN** the confirmation dialog SHALL close
- **AND** the contact SHALL NOT be removed

### Requirement: Reusable Confirm Dialog Component
The application SHALL provide a reusable ConfirmDialog component for confirmation prompts throughout the app. The component SHALL support customizable title, message, button labels, and a danger variant for destructive actions. The dialog SHALL follow the glassmorphism visual design system.

#### Scenario: ConfirmDialog renders with custom props
- **GIVEN** a ConfirmDialog is rendered with title="Delete Item", message="Are you sure?", confirmText="Delete", cancelText="Cancel", confirmVariant="danger"
- **WHEN** the dialog is displayed
- **THEN** the dialog SHALL show the custom title and message
- **AND** the confirm button SHALL use danger styling (red)
- **AND** the cancel button SHALL use secondary styling

#### Scenario: ConfirmDialog follows glassmorphism styling
- **GIVEN** a ConfirmDialog is displayed
- **WHEN** rendered in light or dark theme
- **THEN** the dialog SHALL use semi-transparent glass backgrounds with blur
- **AND** the dialog SHALL have rounded corners consistent with other modals
- **AND** text colors SHALL respect the active Catppuccin theme

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

