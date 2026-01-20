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
The Manage Contacts modal SHALL allow users to navigate directly to a chat with a contact by clicking on that contact's row. Clicking a contact SHALL close the modal and navigate to the chat view for that contact.

#### Scenario: Contact click opens chat
- **GIVEN** the user has opened the Manage Contacts modal
- **AND** the modal displays a list of existing contacts
- **WHEN** the user clicks on a contact row
- **THEN** the modal SHALL close
- **AND** the system SHALL navigate to the chat view for that contact at `/chat/<npub>`
- **AND** if no prior conversation exists, an empty chat SHALL be displayed

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

