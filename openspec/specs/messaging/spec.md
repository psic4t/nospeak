# Messaging Specification

## Purpose
Define requirements for chat messaging functionality including text communication and media sharing between users.
## Requirements
### Requirement: Message Input Interface
The message input area SHALL provide a media upload button instead of displaying the user's profile picture. The media upload button SHALL open a dropdown menu to select between Image and Video file types before opening the file selection dialog.

#### Scenario: Media upload button interaction
- **WHEN** user clicks the media upload button
- **THEN** a dropdown menu appears with "Image" and "Video" options
- **WHEN** user selects "Image" from dropdown
- **THEN** the file selection dialog opens for image files only
- **WHEN** user selects "Video" from dropdown  
- **THEN** the file selection dialog opens for video files only

### Requirement: Media Upload Support
The system SHALL allow users to upload images and videos to include in chat messages.

#### Scenario: User uploads image
- **WHEN** user clicks media upload button and selects "Image"
- **AND** user selects a valid image file
- **THEN** the image is uploaded to user_media directory with UUID filename
- **AND** the image URL is inserted into the message input field

#### Scenario: User uploads video
- **WHEN** user clicks media upload button and selects "Video"  
- **AND** user selects a valid video file
- **THEN** the video is uploaded to user_media directory with UUID filename
- **AND** the video URL is inserted into the message input field

#### Scenario: Media display in messages
- **WHEN** a message contains an image URL
- **THEN** the image is rendered inline in the message bubble
- **WHEN** a message contains a video URL
- **THEN** the video is rendered with controls in the message bubble

#### Scenario: Invalid file upload
- **WHEN** user selects an invalid file type or oversized file
- **THEN** an error message is displayed
- **AND** no upload occurs

### Requirement: Unread Message Indicator
The system SHALL display a visual indicator for contacts with unread messages.

#### Scenario: New message from inactive contact
- **GIVEN** the user is viewing the contact list
- **AND** the user is NOT currently chatting with Contact A
- **WHEN** a new message arrives from Contact A
- **THEN** a green dot appears next to Contact A's name

#### Scenario: Switching to contact clears indicator
- **GIVEN** Contact A has an unread message indicator
- **WHEN** the user selects Contact A to view the chat
- **THEN** the green dot is removed from Contact A

### Requirement: Message Interface Layout
The chat interface SHALL maintain a fixed layout on all screen sizes.

#### Scenario: Mobile Scroll Behavior
- **GIVEN** a user is on a mobile device
- **AND** the chat history is longer than the screen
- **WHEN** the user scrolls the messages
- **THEN** the contact header remains fixed at the top
- **AND** the message input bar remains fixed at the bottom
- **AND** only the message list area scrolls

### Requirement: Message Synchronization
The system SHALL synchronize message history efficiently by downloading only missing messages and processing them in batches. On first-time sync (empty local cache), the system SHALL fetch ALL available messages from relays. On subsequent syncs, the system SHALL fetch only recent messages to fill gaps.

#### Scenario: First-time sync (empty cache)
- **GIVEN** the user logs in for the first time (no messages in local cache)
- **WHEN** the application starts message synchronization
- **THEN** it fetches ALL messages from relays in batches
- **AND** continues fetching until relays return empty results
- **AND** displays sync progress showing message count

#### Scenario: Returning user sync (existing cache)
- **GIVEN** the user has existing messages in local cache
- **WHEN** the application starts
- **THEN** it fetches only the most recent batch of messages (100)
- **AND** stops fetching when it encounters known messages

#### Scenario: Incremental history fetch
- **GIVEN** the user has existing messages up to timestamp T
- **WHEN** the application starts
- **THEN** it fetches history backwards from now
- **AND** it stops fetching automatically when it encounters messages older than T that are already stored locally

#### Scenario: Pipeline processing
- **WHEN** a batch of historical messages is received
- **THEN** the system decrypts and saves them immediately
- **AND** the UI updates to show them (if within view) before the next batch is requested
- **AND** any messages fetched via history sync that are later delivered again via the real-time subscription SHALL be identified by event ID and ignored to prevent duplication

### Requirement: Message History Display
The chat interface SHALL implement infinite scrolling to handle large message histories without performance degradation.

#### Scenario: Initial load limit
- **GIVEN** a conversation with thousands of messages
- **WHEN** the user opens the chat
- **THEN** only the most recent 50 messages are loaded and rendered
- **AND** the application is responsive immediately

#### Scenario: Load older messages
- **GIVEN** the user is viewing the chat
- **WHEN** the user scrolls to the top of the message list
- **THEN** the next batch of older messages is loaded from the database
- **AND** inserted at the top of the list without disrupting the scroll position

### Requirement: Startup Navigation
The system SHALL handle application startup navigation differently based on the device form factor to optimize user experience.

#### Scenario: Desktop Startup
- **GIVEN** the user is on a desktop device (screen width > 768px)
- **WHEN** the user navigates to the root chat URL (`/chat`)
- **THEN** the system automatically redirects to the most recently active conversation

#### Scenario: Mobile Startup
- **GIVEN** the user is on a mobile device (screen width <= 768px)
- **WHEN** the user navigates to the root chat URL (`/chat`)
- **THEN** the system displays the contact list
- **AND** does not redirect to a conversation

#### Scenario: URL Persistence on Reload
- **GIVEN** the user is viewing a specific conversation (e.g., `/chat/<npub>`)
- **WHEN** the user reloads the page
- **THEN** the system restores the same conversation view
- **AND** does not redirect to a different conversation or the contact list

### Requirement: Startup Relay Initialization and Profile Refresh
The system SHALL initialize relay connections for returning authenticated users using cached relay configuration when available, and SHALL refresh the current user's profile and relay configuration in the background when the cached profile has expired.

#### Scenario: Returning user uses cached relays
- **GIVEN** the user is already authenticated
- **AND** a cached profile for the user exists with at least one relay URL
- **WHEN** the application restores the session on startup
- **THEN** it connects to the cached relays without performing full relay discovery
- **AND** the main chat interface becomes usable without waiting for relay discovery to complete

#### Scenario: First-time or missing relays still trigger discovery
- **GIVEN** the user is already authenticated
- **AND** no cached profile with relay information exists for the user
- **WHEN** the application restores the session on startup
- **THEN** it performs relay discovery for the user before initializing messaging
- **AND** uses the discovered relays for subsequent cached startups

#### Scenario: Background refresh on expired profile
- **GIVEN** the user is authenticated and the application has finished initial startup
- **AND** a cached profile exists for the user whose TTL has expired
- **WHEN** the delayed background refresh runs after startup
- **THEN** the system performs relay discovery for the user without blocking the UI
- **AND** updates the cached profile and relay configuration

#### Scenario: Profile refresh status indicator
- **GIVEN** the delayed background refresh is running for the current user
- **WHEN** the system begins refreshing the current user's profile and relays
- **THEN** a transient status indicator is shown in the UI to inform the user that a profile refresh is in progress
- **AND** the indicator updates to confirm completion or failure
- **AND** the indicator automatically hides after a short period

### Requirement: First-Time Sync Progress Indicator
The system SHALL display a progress indicator during first-time message synchronization to inform users of sync status and prevent interaction until complete.

#### Scenario: Desktop progress display
- **GIVEN** the user is on a desktop device (screen width > 768px)
- **AND** this is a first-time sync (empty cache)
- **WHEN** message synchronization is in progress
- **THEN** the empty chat area displays "Syncing messages... (X fetched)"
- **AND** the count updates in real-time as batches complete

#### Scenario: Mobile progress display
- **GIVEN** the user is on a mobile device (screen width <= 768px)
- **AND** this is a first-time sync (empty cache)
- **WHEN** message synchronization is in progress
- **THEN** a blocking modal overlay displays "Syncing messages... (X fetched)"
- **AND** the user cannot interact with the application until sync completes
- **AND** the count updates in real-time as batches complete

#### Scenario: Progress indicator dismissal
- **GIVEN** the first-time sync progress indicator is displayed
- **WHEN** message synchronization completes
- **THEN** the progress indicator is removed
- **AND** on desktop, the application navigates to the contact with the newest message

### Requirement: Real-Time Message Subscription and Deduplication
The real-time message subscription SHALL subscribe to all encrypted gift-wrapped messages for the current user, MAY receive both historical and new messages from relays, and MUST rely on local deduplication to avoid processing the same message more than once.

#### Scenario: Subscription receives incoming messages in real time
- **GIVEN** the user is logged in and the message subscription is active
- **WHEN** a new message is sent to the user
- **THEN** the corresponding gift-wrap event is received via the subscription
- **AND** the message is decrypted, saved to the local database, and displayed in the appropriate conversation without requiring a page reload

#### Scenario: Subscription tolerates backdated gift-wrap timestamps
- **GIVEN** the system uses NIP-59 style gift-wraps with randomized `created_at` timestamps
- **WHEN** the subscription connects or reconnects to a relay
- **THEN** it does NOT restrict events by a strict "since now" filter that would exclude backdated gift-wraps
- **AND** it allows relays to send any matching gift-wrap events for the user

#### Scenario: Historical messages deduplicated across sync and subscription
- **GIVEN** the user has already fetched some message history via explicit history sync
- **AND** the real-time subscription is active
- **WHEN** a relay sends a gift-wrap event that corresponds to a message already stored locally
- **THEN** the system SHALL skip decrypting and saving that message again
- **AND** the UI SHALL NOT display duplicate copies of the same message

