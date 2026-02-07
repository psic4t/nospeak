## MODIFIED Requirements

### Requirement: Contact Storage via Kind 30000 Encrypted Follow Set
The system SHALL store the user's contacts as a Kind 30000 parameterized replaceable event with `d` tag value `dm-contacts`. Contact pubkeys SHALL be stored privately in the encrypted content field using NIP-44 self-encryption, not as public `p` tags. The event SHALL be published to both messaging relays and discovery relays when contacts change. When contacts are fetched from relays and merged into local storage, the system SHALL resolve profiles for newly added contacts using batch profile resolution.

At each sync point where `dm-contacts` is fetched or published, the system SHALL also perform the equivalent operation for the `dm-favorites` encrypted list (Kind 30000 with `d: "dm-favorites"`), ensuring both lists stay in sync across devices.

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

#### Scenario: Favorites list synced alongside contacts on profile refresh
- **GIVEN** the user is authenticated and a profile refresh is triggered
- **WHEN** the system fetches and merges the contact list from relays
- **THEN** it SHALL also fetch and merge the favorites list (Kind 30000 with `d: "dm-favorites"`) from relays

#### Scenario: Favorites list synced alongside contacts on login
- **GIVEN** the user authenticates and the login sync flow begins
- **WHEN** the system fetches and merges the contact list during login
- **THEN** it SHALL also fetch and merge the favorites list from relays after contact sync completes

#### Scenario: Favorites list synced alongside contacts on own profile refresh
- **GIVEN** the user manually refreshes their own profile via the Profile modal
- **WHEN** the system fetches and merges the contact list
- **THEN** it SHALL also fetch and merge the favorites list from relays

#### Scenario: Profiles resolved for contacts from Kind 30000
- **GIVEN** the user is authenticated and has a Kind 30000 event with 5 contacts on relays
- **AND** 3 of those contacts are not in local storage
- **WHEN** the system fetches and merges contacts during sync
- **THEN** the 3 new contacts SHALL be added to local storage
- **AND** the system SHALL fetch Kind 0, 10050, 10002, and 10063 events for all 3 contacts in a single batch request
- **AND** the profiles SHALL be cached so usernames and pictures are immediately available

#### Scenario: Batch profile resolution uses multi-author filter
- **GIVEN** 10 new contacts need profile resolution after Kind 30000 merge
- **WHEN** the system resolves profiles for the new contacts
- **THEN** a single relay subscription SHALL be created with `authors: [pubkey1, pubkey2, ...]` containing all 10 pubkeys
- **AND** the filter SHALL request kinds 0, 10050, 10002, and 10063
- **AND** the resolution SHALL complete within 5 seconds timeout

#### Scenario: Partial profile resolution succeeds
- **GIVEN** 5 new contacts need profile resolution
- **AND** only 3 of them have Kind 0 events available on relays
- **WHEN** the batch profile resolution completes
- **THEN** the 3 available profiles SHALL be cached with usernames and pictures
- **AND** the 2 contacts without profiles SHALL remain in the contacts list
- **AND** those 2 contacts SHALL display with truncated npub until profiles become available
