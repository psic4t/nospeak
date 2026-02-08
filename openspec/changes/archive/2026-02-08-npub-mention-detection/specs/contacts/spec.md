## MODIFIED Requirements

### Requirement: Profile Modal Profile Loading
The ProfileModal SHALL load profile data from the local IndexedDB cache first. When the cache does not contain a profile for the given npub, the modal SHALL fetch the profile from relays using `profileResolver.resolveProfile()` and then re-read from cache. The loading skeleton SHALL remain visible during relay-based profile fetching. When opened for an npub that is not a contact and not the current user's own profile, the modal SHALL display an "Add to contacts" button. Clicking "Add to contacts" SHALL add the user to the contact list using `addContactByNpub()` and update the button to show a confirmation state.

#### Scenario: Profile loaded from cache
- **GIVEN** the ProfileModal is opened for an npub
- **AND** a profile exists in the local IndexedDB cache for that npub
- **WHEN** the modal loads
- **THEN** the profile SHALL be displayed immediately from cache
- **AND** no relay fetch SHALL be performed

#### Scenario: Profile fetched from relays when not cached
- **GIVEN** the ProfileModal is opened for an npub
- **AND** no profile exists in the local IndexedDB cache for that npub
- **WHEN** the modal loads
- **THEN** the loading skeleton SHALL be displayed
- **AND** the modal SHALL call `profileResolver.resolveProfile()` to fetch from relays
- **AND** after the fetch completes, the profile SHALL be displayed
- **AND** if the fetch fails or returns no data, the "Profile not found" message SHALL be shown

#### Scenario: Add to contacts button shown for non-contact
- **GIVEN** the ProfileModal is opened for an npub
- **AND** the npub is not in the user's contact list
- **AND** the npub is not the current user's own npub
- **AND** a profile has been loaded (from cache or relay)
- **WHEN** the modal is displayed
- **THEN** an "Add to contacts" button SHALL be visible in the profile header area

#### Scenario: Add to contacts button not shown for existing contact
- **GIVEN** the ProfileModal is opened for an npub
- **AND** the npub is already in the user's contact list
- **WHEN** the modal is displayed
- **THEN** the "Add to contacts" button SHALL NOT be visible

#### Scenario: Add to contacts button not shown for own profile
- **GIVEN** the ProfileModal is opened for the current user's own npub
- **WHEN** the modal is displayed
- **THEN** the "Add to contacts" button SHALL NOT be visible

#### Scenario: Clicking add to contacts adds user
- **GIVEN** the ProfileModal is displaying a profile with the "Add to contacts" button visible
- **WHEN** the user clicks the "Add to contacts" button
- **THEN** the button SHALL show a loading state (e.g., "Adding...")
- **AND** `addContactByNpub()` SHALL be called with the npub
- **AND** after successful addition, the button SHALL be replaced with a "Contact added" confirmation indicator
- **AND** the confirmation SHALL remain visible for the duration of the modal session

#### Scenario: Add to contacts error handling
- **GIVEN** the ProfileModal is displaying a profile with the "Add to contacts" button visible
- **WHEN** the user clicks "Add to contacts" and the operation fails
- **THEN** the button SHALL return to its initial "Add to contacts" state
- **AND** the user MAY retry the action
