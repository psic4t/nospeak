## ADDED Requirements

### Requirement: Favorite Message Storage via Kind 30000 Encrypted List

The system SHALL store the user's favorited messages as a Kind 30000 parameterized replaceable event with `d` tag value `dm-favorites`. Favorited message references SHALL be stored privately in the encrypted content field using NIP-44 self-encryption as a JSON array of `[["e", "<eventId>", "<conversationId>"], ...]` tags. The event SHALL be published to both messaging relays and discovery relays when favorites change. When favorites are fetched from relays and merged into local storage, the system SHALL use union merge (never delete local favorites).

#### Scenario: Favorites list published on favorite add
- **GIVEN** the user opens the context menu on a message that is not favorited
- **WHEN** the user taps the "Favorite" button
- **THEN** the message SHALL be added to the local favorites table with its eventId and conversationId
- **AND** the system SHALL publish an updated Kind 30000 event with `d: "dm-favorites"`
- **AND** the content field SHALL contain NIP-44 encrypted JSON array of `[["e", "<eventId>", "<conversationId>"], ...]` tags
- **AND** the event SHALL be published to the user's messaging relays and discovery relays

#### Scenario: Favorites list published on favorite remove
- **GIVEN** the user opens the context menu on a message that is already favorited
- **WHEN** the user taps the "Unfavorite" button
- **THEN** the message SHALL be removed from the local favorites table
- **AND** the system SHALL publish an updated Kind 30000 event reflecting the removal

#### Scenario: Favorites list fetched on login
- **GIVEN** the user authenticates and the login sync flow begins
- **WHEN** the system reaches the favorites sync step (after contact sync)
- **THEN** it SHALL fetch the user's Kind 30000 event with `d: "dm-favorites"`
- **AND** decrypt the content using NIP-44
- **AND** merge any remote favorites not in local storage using union merge (never delete)

#### Scenario: Favorites list fetched on delayed refresh
- **GIVEN** the user's session has been restored and the delayed profile refresh runs
- **WHEN** the system refreshes contact data from relays
- **THEN** it SHALL also fetch and merge the favorites list from relays

#### Scenario: Favorites list fetched on own profile refresh
- **GIVEN** the user manually refreshes their own profile via the Profile modal
- **WHEN** the profile refresh completes
- **THEN** the system SHALL also fetch and merge the favorites list from relays

### Requirement: Message Context Menu Favorite Toggle

The message context menu SHALL include a Favorite/Unfavorite toggle button. When the message is not favorited, the button SHALL display "Favorite". When the message is already favorited, the button SHALL display "Unfavorite". Tapping the button SHALL toggle the favorite state and close the context menu.

#### Scenario: Context menu shows Favorite for non-favorited message
- **GIVEN** the user long-presses or right-clicks a message that is not favorited
- **WHEN** the context menu opens
- **THEN** the menu SHALL display a "Favorite" button after the existing Cite and Copy buttons

#### Scenario: Context menu shows Unfavorite for favorited message
- **GIVEN** the user long-presses or right-clicks a message that is already favorited
- **WHEN** the context menu opens
- **THEN** the menu SHALL display an "Unfavorite" button after the existing Cite and Copy buttons

#### Scenario: Tapping Favorite adds to favorites and closes menu
- **GIVEN** the context menu is open with a "Favorite" button visible
- **WHEN** the user taps "Favorite"
- **THEN** the message SHALL be added to favorites
- **AND** the context menu SHALL close
- **AND** a star icon SHALL appear on the message bubble

#### Scenario: Tapping Unfavorite removes from favorites and closes menu
- **GIVEN** the context menu is open with an "Unfavorite" button visible
- **WHEN** the user taps "Unfavorite"
- **THEN** the message SHALL be removed from favorites
- **AND** the context menu SHALL close
- **AND** the star icon SHALL be removed from the message bubble

### Requirement: Favorited Message Star Indicator

Favorited messages SHALL display a star icon badge overlay in the top-right corner of the message bubble. The badge SHALL use the app's lavender accent color (`--color-lavender-rgb`) for the circular background with a white star SVG icon. The badge SHALL appear on both sent and received messages.

#### Scenario: Star icon displayed on favorited message
- **GIVEN** a message in the conversation view has been favorited
- **WHEN** the message bubble is rendered
- **THEN** a small circular lavender badge with a white star icon SHALL appear in the top-right corner of the bubble
- **AND** the badge SHALL be absolutely positioned outside the bubble's overflow-hidden container to prevent clipping
- **AND** the badge SHALL NOT affect the message content layout

#### Scenario: Star icon removed when unfavorited
- **GIVEN** a message in the conversation view has a star icon badge
- **WHEN** the user unfavorites the message via the context menu
- **THEN** the star icon badge SHALL be removed from the message bubble

### Requirement: Favorites Entry in Chat List

The ChatList SHALL display a dedicated "Favorites" entry at the top of the chat list when the user has at least one favorited message AND the "All" filter is active. The entry SHALL be visually separated by horizontal lines extending from both sides of the content. The entry SHALL show a small lavender-colored star icon (without circular background), the label "Favorites", and the count of favorited messages displayed inline. Tapping the entry SHALL navigate to the `/favorites` route.

#### Scenario: Favorites entry displayed when favorites exist on All filter
- **GIVEN** the user has at least one favorited message
- **AND** the "All" filter tab is active
- **WHEN** the ChatList is rendered
- **THEN** a "Favorites" entry SHALL appear at the top of the list above regular chats
- **AND** the entry SHALL have horizontal divider lines on both sides of the content
- **AND** the entry SHALL display a small lavender star icon (no circular background)
- **AND** the entry SHALL show the text "Favorites" as its name with the count inline

#### Scenario: Favorites entry hidden when no favorites
- **GIVEN** the user has no favorited messages
- **WHEN** the ChatList is rendered
- **THEN** no Favorites entry SHALL appear

#### Scenario: Favorites entry hidden on Unread or Groups filter
- **GIVEN** the user has at least one favorited message
- **AND** either the "Unread" or "Groups" filter tab is active
- **WHEN** the ChatList is rendered
- **THEN** no Favorites entry SHALL appear

#### Scenario: Favorites entry navigates to /favorites
- **GIVEN** the Favorites entry is displayed in the ChatList
- **WHEN** the user taps the Favorites entry
- **THEN** the system SHALL navigate to the `/favorites` route

### Requirement: Favorites View Page

The system SHALL provide a `/favorites` route that displays all favorited messages grouped by conversation. Each group SHALL show the conversation name (contact name or group title) as a header. Each favorited message SHALL display its content preview, sender info, and timestamp. Tapping a favorited message SHALL navigate to the original conversation and scroll to that message. The view SHALL include a back button to return to the chat list.

#### Scenario: Favorites view displays messages grouped by conversation
- **GIVEN** the user has favorited 3 messages from Contact A and 2 messages from Group B
- **WHEN** the user navigates to `/favorites`
- **THEN** the view SHALL display two sections: one for Contact A and one for Group B
- **AND** each section SHALL show the conversation name as a header
- **AND** each message SHALL display its content text (or media type label), timestamp, and direction

#### Scenario: Tapping a favorite navigates to original conversation
- **GIVEN** the user is viewing the Favorites page
- **AND** a favorited message from Contact A is displayed
- **WHEN** the user taps that message
- **THEN** the system SHALL navigate to `/chat/<conversationId>?highlight=<eventId>`
- **AND** the ChatView SHALL scroll to and visually highlight the target message

#### Scenario: Favorites view shows empty state
- **GIVEN** the user has no favorited messages
- **WHEN** the user navigates to `/favorites`
- **THEN** the view SHALL display an empty state message indicating no favorites exist

#### Scenario: Back button returns to chat list
- **GIVEN** the user is viewing the Favorites page
- **WHEN** the user taps the back button
- **THEN** the system SHALL navigate back to `/chat`

### Requirement: Favorites Local Database Storage

The system SHALL store favorites in an IndexedDB table named `favorites` with `eventId` as primary key and indices on `conversationId` and `createdAt`. The table SHALL be added in database schema version 11. A reactive Svelte store SHALL maintain an in-memory Set of favorited eventIds for efficient UI rendering lookups.

#### Scenario: Favorite persists across page reloads
- **GIVEN** the user favorites a message
- **WHEN** the user reloads the page
- **THEN** the message SHALL still be marked as favorited
- **AND** the star icon SHALL appear on the message bubble after reload

#### Scenario: Favorites store provides O(1) lookup
- **GIVEN** the favorites store has been initialized with data from IndexedDB
- **WHEN** the ChatView renders messages
- **THEN** checking if a message is favorited SHALL be an O(1) Set lookup
- **AND** SHALL NOT require an async database query per message
