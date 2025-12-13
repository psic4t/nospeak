# Messaging Specification

## Purpose
Define requirements for chat messaging functionality including text communication and media sharing between users.
## Requirements
### Requirement: Message Input Interface
The message input area SHALL provide a media upload button instead of displaying the user's profile picture. The media upload button SHALL open a dropdown menu to select between Image and Video file types before opening the file selection dialog. On desktop devices, the message input area SHALL render the media upload button and a circular send button inside a single input bar. The send button SHALL be styled using the active Catppuccin theme green color and SHALL only be visible when the input contains non-whitespace text; on mobile devices, the inline send button SHALL be hidden and sending SHALL occur via the keyboard action instead.

#### Scenario: Media upload button interaction
- **WHEN** user clicks the media upload button
- **THEN** a dropdown menu appears with "Image" and "Video" options
- **WHEN** user selects "Image" from dropdown
- **THEN** the file selection dialog opens for image files only
- **WHEN** user selects "Video" from dropdown  
- **THEN** the file selection dialog opens for video files only

#### Scenario: Desktop inline send button visibility
- **GIVEN** the user is on a desktop device (screen width > 768px)
- **WHEN** the message input is empty or contains only whitespace
- **THEN** the inline circular send button is not displayed inside the input bar
- **WHEN** the message input contains non-whitespace text
- **THEN** the inline circular send button appears inside the input bar, styled using the active Catppuccin theme green color

#### Scenario: Mobile send behavior
- **GIVEN** the user is on a mobile device (screen width <= 768px)
- **WHEN** the user types a message in the input
- **THEN** no inline send button is shown inside the input bar
- **AND** sending the message occurs via the mobile keyboard's send/enter action

### Requirement: Media Upload Support
The system SHALL allow users to upload images, videos, and MP3 audio files to include in chat messages. Media uploads SHALL be performed via HTTPS POST requests to the canonical nospeak upload endpoint `https://nospeak.chat/api/upload`. Each media upload request SHALL include a valid NIP-98 Authorization header proving control of a Nostr key for the current session; the server SHALL reject uploads that are missing, expired, or invalid according to the NIP-98 verification rules. Uploaded media files SHALL continue to be stored under a `user_media` directory using UUID-based filenames, and message content SHALL reference the resulting URLs for rendering.

#### Scenario: User uploads image
- **WHEN** user clicks the media upload button and selects "Image"
- **AND** user selects a valid image file
- **AND** the client includes a valid NIP-98 Authorization header targeting `https://nospeak.chat/api/upload`
- **THEN** the image is uploaded to user_media directory with UUID filename
- **AND** the image URL is inserted into the message input field

#### Scenario: User uploads video
- **WHEN** user clicks the media upload button and selects "Video"  
- **AND** user selects a valid video file
- **AND** the client includes a valid NIP-98 Authorization header targeting `https://nospeak.chat/api/upload`
- **THEN** the video is uploaded to user_media directory with UUID filename
- **AND** the video URL is inserted into the message input field

#### Scenario: User uploads audio (MP3)
- **WHEN** user clicks the media upload button and selects "Music"
- **AND** user selects a valid MP3 audio file
- **AND** the client includes a valid NIP-98 Authorization header targeting `https://nospeak.chat/api/upload`
- **THEN** the audio is uploaded to the user_media directory with a UUID-based `.mp3` filename
- **AND** the audio URL is inserted into the message input field

#### Scenario: Media display in messages
- **WHEN** a message contains an image URL
- **THEN** the image is rendered inline in the message bubble
- **WHEN** a message contains a video URL
- **THEN** the video is rendered with controls in the message bubble
- **WHEN** a message contains a URL that ends with `.mp3`
- **THEN** the message bubble renders a compact audio player that displays a simple waveform visualization for the MP3
- **AND** the audio player provides basic play and pause controls so the user can listen without leaving the conversation

#### Scenario: Invalid file upload
- **WHEN** user selects an invalid file type or oversized file
- **THEN** an error message is displayed
- **AND** no upload occurs

#### Scenario: Unauthorized media upload is rejected
- **WHEN** a client attempts to upload an image, video, or MP3 audio file without a NIP-98 Authorization header, with an Authorization header that does not target `https://nospeak.chat/api/upload`, or with an Authorization header that fails signature or freshness validation
- **THEN** the server SHALL reject the upload request with an error status
- **AND** no file is stored in the `user_media` directory
- **AND** the client SHALL surface a non-blocking error message in the messaging UI.

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
- **THEN** it fetches only the most recent batch of messages (50)
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

#### Scenario: Load older messages from cache first
- **GIVEN** the user is viewing the chat
- **AND** additional older messages for this conversation exist in the local database
- **WHEN** the user scrolls to the top of the message list
- **THEN** the next batch of older messages is loaded from the database only
- **AND** inserted at the top of the list without disrupting the scroll position
- **AND** no network history fetch is triggered for this scroll action.

#### Scenario: Fallback to network when cache is exhausted
- **GIVEN** the user is viewing the chat
- **AND** the local database has no additional older messages for this conversation (or fewer than the configured page size, indicating potential gaps)
- **WHEN** the user requests older history (for example, by clicking a "Fetch older messages from relays" control shown at the top of the conversation)
- **THEN** the system MAY trigger a targeted history backfill using `fetchOlderMessages` to request older messages from relays
- **AND** any newly fetched messages are saved into the local database and then appended to the top of the visible history without creating duplicate entries.

#### Scenario: Status when no more relay history exists
- **GIVEN** the user has requested older history from relays for a conversation whose local cache is already exhausted
- **WHEN** the targeted history backfill completes and returns no additional messages from any connected relay
- **THEN** the system SHALL display a non-intrusive status near the top of the message list indicating that no more messages are available from relays for this conversation
- **AND** the UI SHALL avoid offering further relay history fetch actions for that conversation unless the user explicitly refreshes or reconnects.

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
The system SHALL display a blocking modal progress indicator during the ordered login and first-time message synchronization flow on both desktop and mobile devices. The indicator SHALL remain visible and blocking until the flow has completed all required steps and SHALL show both the current step label and the number of fetched messages, updating in real time as history sync batches are processed.

#### Scenario: Ordered login and history sync steps
- **GIVEN** the user has successfully authenticated but the messaging environment has not yet completed initialization
- **WHEN** the application starts the login history synchronization flow
- **THEN** a blocking modal overlay appears and displays the following steps in order:
  1. Connect to discovery relays
  2. Fetch and cache the user's messaging relays
  3. Connect to the user's read relays
  4. Fetch and cache history items from relays
  5. Fetch and cache profile and relay information for created contacts
  6. Fetch and cache the current user profile
- **AND** the modal remains visible and prevents interaction with the underlying chat UI while any of these steps are in progress
- **AND** the modal highlights the current step as it runs and marks prior steps as completed before moving on
- **AND** the fetched message count displayed in the modal updates in real time during step 4 as history batches are processed.

#### Scenario: Modal dismissal and view refresh after flow completion
- **GIVEN** the blocking login history synchronization flow is in progress
- **AND** all six steps have completed successfully
- **WHEN** the flow reaches its terminal success state
- **THEN** the blocking modal overlay is dismissed
- **AND** the main chat interface is refreshed to reflect the newly synchronized history, contacts, and user profile (for example, by re-evaluating startup navigation and active conversation selection)
- **AND** normal background messaging behaviors (such as real-time subscriptions and non-blocking profile refreshes) MAY start or resume.

#### Scenario: Returning user with cached state still respects ordered flow
- **GIVEN** the user has previously logged in and some data (such as messaging relays, history, or profile) is cached locally
- **WHEN** the user logs in again and the application begins messaging initialization
- **THEN** the system SHALL still execute the ordered login history synchronization flow
- **AND** steps whose data is already fresh MAY complete quickly or be marked as skipped, but the modal SHALL remain visible until all required steps reach a completed or intentionally skipped state
- **AND** the user SHALL NOT be able to interact with the main messaging UI until the flow completes and the modal is dismissed.

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

### Requirement: Manage Contacts Modal Contact Display
The Manage Contacts modal SHALL display each contact using their profile picture and resolved username when available, with the shortened npub still visible but visually secondary.

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

### Requirement: Manage Contacts Search via NIP-50 Relay
The Manage Contacts modal SHALL support searching for users by name or phrase using a dedicated NIP-50 search relay, while preserving the existing direct-add behavior for `npub` inputs.

#### Scenario: Direct npub entry bypasses search
- **GIVEN** the user opens the Manage Contacts modal
- **AND** the user enters a value that starts with `npub` into the contact input field
- **WHEN** the user clicks the "Add" button
- **THEN** the system SHALL treat the value as an `npub`
- **AND** SHALL attempt to resolve the profile and add the contact using the existing direct-add flow without performing a search

#### Scenario: Phrase input triggers search
- **GIVEN** the user opens the Manage Contacts modal
- **AND** the user enters a non-empty value that does not start with `npub` into the contact input field
- **AND** the entered value is at least three characters long after trimming whitespace
- **WHEN** the user stops typing for a short period
- **THEN** the system SHALL send a NIP-50 `search` query to `wss://relay.nostr.band` restricted to kind `0` metadata events with a maximum of 20 results
- **AND** the system SHALL display matching users in a dropdown under the contact input field

#### Scenario: Search results display
- **GIVEN** the system has received at least one matching user from the search relay
- **WHEN** the dropdown under the contact input is rendered
- **THEN** each result SHALL show the user's avatar when a profile picture is available
- **AND** SHALL show a primary display name derived from profile metadata when available
- **AND** SHALL show the user's shortened `npub` as secondary text
- **AND** MAY display additional metadata such as NIP-05 identifier when available

#### Scenario: Selecting a search result pre-fills npub
- **GIVEN** search results are visible in the dropdown under the contact input
- **WHEN** the user clicks on a search result
- **THEN** the system SHALL populate the contact input field with the selected user's `npub`
- **AND** SHALL close the search results dropdown
- **AND** SHALL require the user to click the existing "Add" button to finalize adding the contact

#### Scenario: Adding a contact via search result behaves like direct npub add
- **GIVEN** the user has clicked a search result and the contact input field contains the selected user's `npub`
- **WHEN** the user clicks the "Add" button
- **THEN** the system SHALL resolve the user's profile and relay information using the same logic as direct `npub` entry
- **AND** SHALL add the selected user to the contacts list with the same fields and downstream behaviour as a contact added by manually entering their `npub`

### Requirement: Themed Logo and Icon Branding for Messaging
The messaging interface and related browser surfaces SHALL use the updated nospeak logo with Catppuccin-aligned coloring. In-app chat views SHALL render the nospeak logo using a theme-aware style that displays Latte Lavender in bright/light appearances and a white logo matching Frappe text color in dark appearances. Browser favicons, PWA icons, and messaging notification icons SHALL use a Latte Text-tinted version of the nospeak logo.

#### Scenario: Chat header logo reflects bright theme
- **GIVEN** the effective theme is light (Catppuccin Latte)
- **WHEN** the user views any chat conversation
- **THEN** the nospeak logo shown in the chat header appears in a bright violet consistent with Catppuccin Latte Lavender
- **AND** the logo uses a single shared styling mechanism so that other in-app uses of the nospeak logo share the same appearance.

#### Scenario: Chat header logo reflects dark theme
- **GIVEN** the effective theme is dark (Catppuccin Frappe)
- **WHEN** the user views any chat conversation
- **THEN** the nospeak logo shown in the chat header appears as a white logo that visually matches the Catppuccin Frappe text color against dark backgrounds
- **AND** changing the theme mode between Light, Dark, and System updates the header logo appearance without requiring a reload.

#### Scenario: Favicons and PWA icons use Latte Lavender
- **WHEN** the user views the nospeak web app in a browser tab or installs it as a PWA
- **THEN** the browser tab favicon, app icon, and any PWA home screen or app switcher icons use a nospeak logo tinted with Catppuccin Latte Lavender
- **AND** these icons remain Latte Lavender regardless of the runtime theme mode.

#### Scenario: Messaging notifications show Latte Lavender icon
- **GIVEN** the user has granted notification permission and notifications are enabled in Settings
- **WHEN** a new message notification is shown for an incoming message
- **THEN** the notification icon and badge use a nospeak logo tinted with Catppuccin Latte Lavender
- **AND** the icon asset used for notifications is consistent with the branding used for favicons and PWA icons.

### Requirement: NIP-05 Verification for Profiles and Contacts
The messaging experience SHALL treat NIP-05 identifiers as identity hints only when they have been verified against NIP-05 DNS records, and SHALL avoid displaying verification badges or icons for identifiers that have not been validated. The system SHALL cache NIP-05 verification status per profile so that messaging UIs can consistently display whether a given contact's identifier is verified, invalid for their key, or unknown.

#### Scenario: NIP-05 verified for profile pubkey
- **GIVEN** a profile metadata event of kind 0 that includes a `nip05` field with value `<local-part>@<domain>`
- **AND** the system has decoded the user's public key for that profile
- **WHEN** the client performs a NIP-05 lookup to `https://<domain>/.well-known/nostr.json?name=<local-part>`
- **AND** the JSON response contains a `names` object whose entry for `<local-part>` matches the profile's public key in hex format
- **THEN** the system SHALL record the NIP-05 status for that profile as `valid`
- **AND** SHALL persist the last-checked time alongside the profile's cached metadata for use by messaging UIs.

#### Scenario: NIP-05 invalid for profile pubkey
- **GIVEN** a profile metadata event of kind 0 that includes a `nip05` field with value `<local-part>@<domain>`
- **AND** the system has decoded the user's public key for that profile
- **WHEN** the client performs a NIP-05 lookup to `https://<domain>/.well-known/nostr.json?name=<local-part>`
- **AND** the JSON response is successfully retrieved and parsed
- **AND** the `names` object does not contain an entry for `<local-part>` that matches the profile's public key in hex format
- **THEN** the system SHALL record the NIP-05 status for that profile as `invalid`
- **AND** SHALL persist this status and last-checked time for downstream messaging UIs.

#### Scenario: NIP-05 verification unknown due to network or CORS failure
- **GIVEN** a profile metadata event of kind 0 that includes a `nip05` field
- **WHEN** the client attempts to fetch `/.well-known/nostr.json` for that identifier
- **AND** the fetch fails due to network errors, missing resource, or browser CORS restrictions
- **THEN** the system SHALL record the NIP-05 status for that profile as `unknown`
- **AND** SHALL avoid displaying the identifier as verified in any messaging UI.

#### Scenario: `_@domain` displayed as `domain` in messaging UI
- **GIVEN** a verified or unverified NIP-05 identifier of the form `_@example.com`
- **WHEN** the identifier is rendered in any messaging UI (including profile views and search results)
- **THEN** the UI SHALL display the identifier as `example.com` while still using `_@example.com` for NIP-05 verification lookups and storage.

### Requirement: NIP-05-Aware Contact Search Ranking and Badges
The Manage Contacts modal search results SHALL prefer contacts whose NIP-05 identifiers are verified for their public keys, and SHALL surface verification status using icons next to the identifier. The search experience SHALL avoid implying verification for identifiers that are unknown, and SHALL explicitly indicate identifiers that are known to be invalid for the corresponding key.

#### Scenario: Verified NIP-05 contacts appear first in search
- **GIVEN** the user types a search phrase in the Manage Contacts modal and matching results are returned from the NIP-50 search relay
- **AND** some results include a NIP-05 identifier that has been verified as valid for the result's public key
- **AND** other results include NIP-05 identifiers that are invalid or have unknown verification status
- **WHEN** the results list is rendered
- **THEN** contacts with `valid` NIP-05 status SHALL be ordered before contacts whose NIP-05 status is `unknown` or `invalid`.

#### Scenario: Search results show green checkmark for verified NIP-05
- **GIVEN** a search result row in the Manage Contacts modal includes a NIP-05 identifier
- **AND** the system has recorded that identifier as `valid` for the result's public key
- **WHEN** the row is rendered in the dropdown
- **THEN** the UI SHALL display a small green checkmark icon next to the NIP-05 identifier
- **AND** SHALL display the identifier using the `_@domain` to `domain` visual transformation when applicable.

#### Scenario: Search results show not-verified icon for invalid NIP-05
- **GIVEN** a search result row in the Manage Contacts modal includes a NIP-05 identifier
- **AND** the system has recorded that identifier as `invalid` for the result's public key
- **WHEN** the row is rendered in the dropdown
- **THEN** the UI SHALL display a small warning or information icon next to the NIP-05 identifier
- **AND** SHALL expose a tooltip or accessible label that communicates that the NIP-05 identifier is not verified for this key.

#### Scenario: Search results avoid badges for unknown NIP-05 status
- **GIVEN** a search result row in the Manage Contacts modal includes a NIP-05 identifier
- **AND** the system has not yet attempted verification or has recorded the status as `unknown`
- **WHEN** the row is rendered in the dropdown
- **THEN** the UI SHALL display the NIP-05 identifier without a verification or not-verified icon
- **AND** the row SHALL still be sortable below entries with `valid` status.

#### Scenario: Top search results are verified eagerly
- **GIVEN** the user enters a search phrase that returns multiple results from the NIP-50 search relay
- **WHEN** the client prepares to render the dropdown of results
- **THEN** the client SHALL attempt NIP-05 verification for only the top subset of results (for example, the first 5 entries that include a NIP-05 identifier)
- **AND** SHALL update each affected row's ordering and iconography as verification results become available, without blocking the initial display of results.

### Requirement: URL Preview for Non-Media Links
The messaging interface SHALL detect HTTP(S) URLs in message content that are not recognized as direct image or video media links and MAY render a compact URL preview card under the message bubble. The preview card SHALL display, when available, the destination page title, a short description or summary, and the effective domain, and MAY include a small favicon or thumbnail image. URL preview metadata lookups SHALL be initiated only for messages that are currently within the visible scroll viewport of the conversation, and the client SHALL avoid repeated metadata requests for the same message content once a successful or failed preview attempt has been recorded. When metadata is available from the destination, the client and preview service SHALL correctly decode common HTML entities and character encodings so that non-ASCII characters (such as umlauts) are rendered as human-readable text in the preview card.

#### Scenario: Preview card correctly decodes HTML entities
- **GIVEN** a sent or received message whose content includes at least one non-media HTTP(S) URL
- **AND** the destination page exposes a title or description that includes HTML entity-encoded characters (for example, `&uuml;`, `&ouml;`, or numeric character references)
- **WHEN** the system fetches preview metadata and renders the URL preview card while the message bubble is within the visible scroll viewport
- **THEN** the title and description in the preview card SHALL display those characters as properly decoded text (for example, `für` instead of `f&uuml;r`)
- **AND** the user SHALL NOT see raw entity sequences in the preview card text.

#### Scenario: Preview card uses expanded metadata sources
- **GIVEN** a sent or received message whose content includes at least one non-media HTTP(S) URL
- **AND** the destination page provides metadata via standard Open Graph, Twitter card, or common HTML meta tags (including `og:title`, `og:description`, `og:image`, `twitter:title`, `twitter:description`, `twitter:image`, or `meta name="description"`)
- **WHEN** the system fetches preview metadata for that URL while the message bubble is within the visible scroll viewport
- **THEN** the preview service SHALL consider these standard tags as candidates when deriving the title, description, and image for the preview card
- **AND** it SHALL resolve relative image URLs against the destination URL so that the preview card can show a thumbnail when available.

#### Scenario: Graceful behavior for consent or cookie-wall pages
- **GIVEN** a sent or received message whose content includes at least one non-media HTTP(S) URL
- **AND** the initial response for that URL is a consent, cookie-wall, or generic interstitial page that does not expose detailed article-specific metadata
- **WHEN** the system fetches preview metadata and parses the available HTML
- **THEN** the preview service MAY derive a minimal preview using whatever generic title or description is present (for example, the site name)
- **AND** any text it surfaces in the preview card SHALL still respect the entity and character decoding behavior defined above
- **AND** when no meaningful metadata beyond such generic text is available, the system MAY omit the preview card entirely while leaving the original link clickable in the message text.

### Requirement: Mobile contacts header shows app name
The contacts sidebar header on mobile-sized layouts SHALL display the nospeak app name label next to the current user's avatar so that users can clearly recognize the app context when viewing or switching contacts.

#### Scenario: Mobile contacts header includes app name
- **GIVEN** the user is authenticated and viewing the contacts list
- **AND** the viewport corresponds to a mobile-sized layout (for example, screen width <= 768px or native mobile shell)
- **WHEN** the contacts sidebar header is rendered
- **THEN** the current user's avatar is shown
- **AND** a textual "nospeak" label appears adjacent to the avatar within the same header grouping
- **AND** the existing settings control remains accessible on the opposite side of the header without overlapping the label.

### Requirement: Local Message Notifications for New Messages
When message notifications are enabled for the current device and the platform has granted notification permission, the messaging experience SHALL surface user-visible notifications for newly received messages using the platform-appropriate mechanism (browser notifications on web, OS-level notifications in the Android app) while the application is running.

#### Scenario: Web browser shows new message notification
- **GIVEN** the user is accessing nospeak in a supported web browser
- **AND** message notifications are enabled in Settings  General
- **AND** the browser has granted notification permission
- **AND** the nospeak window is not the active, focused foreground tab (for example, the user has switched to another tab, minimized the window, or switched to another application or virtual desktop)
- **WHEN** a new message addressed to the current user is received and processed by the messaging pipeline
- **THEN** the system SHALL display a browser notification indicating a new message, including the sender name when available and a short message preview
- **AND** activating the notification SHALL focus the nospeak window and navigate to the conversation with that sender.

#### Scenario: Web browser shows notification for different active conversation
- **GIVEN** the user is accessing nospeak in a supported web browser
- **AND** message notifications are enabled in Settings  General
- **AND** the browser has granted notification permission
- **AND** the nospeak window is visible and focused
- **AND** the user is currently viewing an open conversation with Contact A
- **WHEN** a new message addressed to the current user is received from Contact B (a different conversation) and processed by the messaging pipeline
- **THEN** the system SHALL display a browser notification indicating a new message from Contact B, including the sender name when available and a short message preview
- **AND** activating the notification SHALL keep or bring the nospeak window to the foreground and navigate to the conversation with Contact B.

#### Scenario: Web browser suppresses notification for active conversation
- **GIVEN** the user is accessing nospeak in a supported web browser
- **AND** message notifications are enabled in Settings  General
- **AND** the browser has granted notification permission
- **AND** the nospeak window is visible and focused
- **AND** the user is currently viewing an open conversation with Contact A
- **WHEN** a new message addressed to the current user is received from Contact A and processed by the messaging pipeline
- **THEN** the system SHALL NOT display a browser notification for that message
- **AND** the message SHALL still appear in the in-app conversation view and update unread indicators according to existing messaging requirements.

#### Scenario: Android app shows local notification for new message
- **GIVEN** the user is running nospeak inside the Android Capacitor app shell
- **AND** message notifications are enabled in Settings  General
- **AND** the Android OS has granted permission for local notifications
- **WHEN** a new message addressed to the current user is received and processed while the app is in the background or not currently visible
- **THEN** the system SHALL display an Android OS notification for the new message using the configured messages notification channel and icon
- **AND** activating the notification SHALL bring the nospeak Android app to the foreground and navigate to the conversation with that sender.

#### Scenario: Notifications suppressed when disabled or permission missing
- **GIVEN** either message notifications are disabled in Settings  General for the current device or the platform has denied notification permission
- **WHEN** a new message is received and processed by the messaging pipeline
- **THEN** the system SHALL NOT show a browser or Android local notification for that message
- **AND** the rest of the messaging behavior (message storage and in-app display) SHALL continue to function normally.

### Requirement: Android Native Dialog Integration for Messaging
When running inside the Android Capacitor app shell, the messaging experience SHALL use Android-native dialogs and sheets via Capacitor plugins where appropriate for confirmations, media selection, error states, and sharing, while preserving the existing messaging semantics defined in `specs/messaging/spec.md`.

#### Scenario: Native media picker for message attachments on Android
- **GIVEN** the user is running nospeak inside the Android Capacitor app
- **AND** the user taps the media upload button in the message input area
- **WHEN** the user chooses to attach an image or video
- **THEN** the app SHOULD prefer an Android-native picker or gallery selection flow exposed by Capacitor (for example, Camera or Filesystem plugins)
- **AND** upon successful selection, the chosen media SHALL be uploaded and referenced in the message content according to the existing Media Upload Support requirements.

#### Scenario: Native confirmation dialogs for irreversible messaging actions
- **GIVEN** the user is running nospeak inside the Android Capacitor app
- **AND** the user initiates an irreversible or destructive messaging-related action (for example, clearing cached data or removing a contact)
- **WHEN** a confirmation is required by the UI
- **THEN** the app SHOULD present an Android-native confirmation dialog using Capacitor's Dialog or ActionSheet plugins
- **AND** the accepted or cancelled result from the native dialog SHALL be treated identically to the equivalent confirmation in the web UI.

#### Scenario: Native share sheet for sharing links or invites
- **GIVEN** the user is running nospeak inside the Android Capacitor app
- **AND** the user invokes a "Share" action from within the messaging experience (for example, sharing an invite link or conversation URL)
- **WHEN** the share action is triggered
- **THEN** the app SHALL open the Android-native share sheet via Capacitor's Share plugin when available
- **AND** SHALL fall back to a web-based share mechanism when native sharing is not available or fails.

#### Scenario: Web behavior remains unchanged outside Android shell
- **GIVEN** the user is accessing nospeak via a standard web browser (not inside the Android Capacitor app)
- **WHEN** they perform actions that would use native dialogs on Android (media upload, confirmations, share)
- **THEN** the system SHALL continue to use the existing web-based modals, file pickers, and share mechanisms defined in the web implementation
- **AND** messaging semantics and acceptance criteria from existing `messaging` requirements SHALL continue to apply.

### Requirement: Mobile contacts last message preview
The mobile contacts list SHALL display a single-line preview of the most recent message under each contact's name when the viewport corresponds to a mobile-sized layout (for example, screen width <= 768px or a native mobile shell), using the latest stored message content for that contact. The preview SHALL be truncated when it does not fit in the available width and SHALL be omitted for contacts that have no stored messages. Desktop layouts (screen width > 768px) SHALL continue to display only the contact name and unread indicator without a message preview line.

#### Scenario: Mobile contacts list shows last message preview
- **GIVEN** the user is authenticated and viewing the contacts list
- **AND** the viewport corresponds to a mobile-sized layout (for example, screen width <= 768px or native mobile shell)
- **AND** Contact A has at least one stored message
- **WHEN** the contacts list is rendered
- **THEN** Contact A's row SHALL show their name as the primary text
- **AND** a secondary line under the name that displays a single-line truncated preview of the most recent message content for Contact A.

#### Scenario: No preview when contact has no messages
- **GIVEN** the user is authenticated and viewing the contacts list
- **AND** the viewport corresponds to a mobile-sized layout
- **AND** Contact B has no stored messages
- **WHEN** the contacts list is rendered
- **THEN** Contact B's row SHALL show their name and any unread indicator as currently specified
- **AND** SHALL NOT display an empty or placeholder last-message preview line.

#### Scenario: Desktop contacts list omits message preview
- **GIVEN** the user is authenticated and viewing the contacts list
- **AND** the viewport corresponds to a desktop-sized layout (screen width > 768px)
- **WHEN** the contacts list is rendered
- **THEN** each contact row SHALL display the contact name and unread indicator as currently specified
- **AND** SHALL NOT display a last-message preview line, even if stored messages exist for that contact.

### Requirement: Android Background Message Delivery
When running inside the Android Capacitor app shell with background messaging enabled, the messaging experience on Android SHALL delegate background message reception and notification to a native foreground service that connects to the user's read relays, subscribes to gift-wrapped messages, and triggers OS notifications even while the WebView is suspended. The native service SHALL always treat gift-wrapped events as opaque envelopes and raise only generic "new encrypted message" notifications, regardless of whether the current session uses an on-device nsec or an external signer such as Amber.

#### Scenario: Background subscriptions deliver generic notifications on Android
- **GIVEN** the user is logged in and has enabled background messaging in Settings → General while running inside the Android Capacitor app shell
- AND the native Android foreground service for background messaging is active
- WHEN a new gift-wrapped message addressed to the current user is delivered from any configured read relay while the app UI is not visible
- THEN the native service SHALL treat the event as an opaque envelope and SHALL NOT attempt to decrypt the message content
- AND it SHALL raise an Android OS notification that indicates a new encrypted message has arrived without revealing the sender's identity or message content
- AND the user SHALL only see the decrypted sender and content after returning to the app and allowing the existing foreground messaging pipeline (including Amber where applicable) to process the message.

#### Scenario: Background delivery respects notification settings and permissions
- **GIVEN** the user is running nospeak in the Android app, and the native background messaging service is active
- WHEN message notifications are disabled in Settings → General for the current device, or Android has denied local notification permission
- THEN the native background messaging service SHALL continue to maintain relay subscriptions as long as background messaging remains enabled
- AND it SHALL NOT surface OS notifications for new messages while notifications are disabled or permission is denied
- AND the rest of the background behavior (message availability when the app is brought to the foreground) SHALL continue to function according to the current authorization mode.

### Requirement: Energy-Efficient Background Messaging on Android
The messaging implementation for Android background messaging SHALL minimize energy usage by limiting background work to maintaining relay subscriptions, processing incoming messages, and firing notifications, and SHALL apply conservative reconnection and backoff behavior when connections are lost.

#### Scenario: No extra polling beyond relay subscriptions
- **GIVEN** background messaging is active on Android
- WHEN the app is running in background mode
- THEN the messaging pipeline SHALL avoid scheduling additional periodic polling or history sync jobs solely for background operation
- AND it SHALL rely primarily on real-time subscriptions to receive new messages.

#### Scenario: Conservative reconnection and backoff in background
- **GIVEN** background messaging is active and one or more relay connections are lost due to network changes or OS behavior
- WHEN the messaging pipeline attempts to reconnect to read relays while the app is in the background
- THEN it SHALL use a conservative reconnection strategy (for example, exponential backoff with upper bounds) to limit repeated connection attempts
- AND it SHALL stop attempting reconnections entirely if the user signs out or disables background messaging.

### Requirement: Login Screen Local Keypair Generator
The unauthenticated login screen SHALL provide a locally generated Nostr keypair option in addition to existing login methods (Amber and NIP-07 extension, and manual `nsec` entry). The keypair generator flow SHALL be accessible via a small link under the local `nsec` login control, SHALL open a dedicated modal that displays the newly generated `npub` and `nsec`, and SHALL offer controls to regenerate and to log in using the currently displayed secret key. Key generation SHALL occur entirely on the client using a standard Nostr keypair format, and the generated keys SHALL NOT be persisted by the keypair UI itself until or unless the user explicitly chooses to log in with them.

#### Scenario: User opens keypair generator from login screen
- **GIVEN** the unauthenticated login screen is visible with options for Amber, NIP-07 extension (when available), and manual `nsec` entry
- **WHEN** the user clicks the "Generate new keypair" link under the local `nsec` login section
- **THEN** a glass-style modal appears over the login background
- **AND** the modal displays a newly generated Nostr keypair where the `npub` and `nsec` are shown as bech32-encoded strings.

#### Scenario: User regenerates keypair in modal
- **GIVEN** the keypair generator modal is open and displaying a keypair
- **WHEN** the user clicks the recycle-style generate-again control
- **THEN** the system discards the previous keypair from the modal state
- **AND** generates and displays a new `npub`/`nsec` pair in the same modal without requiring the user to close and reopen it.

#### Scenario: User logs in using generated keypair
- **GIVEN** the keypair generator modal is open and displaying a generated keypair
- **WHEN** the user clicks the primary action button labeled "Use this keypair and login"
- **THEN** the system logs the user in using the currently displayed `nsec` via the existing local `nsec` login flow
- **AND** the resulting authenticated session behavior (including navigation to `/chat`, relay initialization, and first-time sync flows) SHALL match the behavior of a successful manual `nsec` login
- **AND** the underlying auth implementation MAY persist the `nsec` to local storage according to existing local login semantics, but the keypair generator modal itself SHALL NOT add any additional persistence beyond invoking the login action.

### Requirement: Post-login Empty Profile Setup Modal
After a successful login and completion of the ordered login history flow, the messaging experience SHALL display a blocking setup modal whenever the current user's profile has no configured messaging relays and no username-like metadata. The modal SHALL explain that at least one messaging relay and a basic profile identifier are required for a usable experience, SHALL pre-populate a small default set of read/write messaging relays for the user (nostr.data.haus, nos.lol, relay.damus.io) that can be edited later in Settings, and SHALL require the user to provide a simple name that is saved into their profile metadata and published to the network. The modal MAY offer a secondary dismiss action while still reappearing on future logins as long as the profile remains empty.

#### Scenario: Empty profile triggers setup modal on login
- **GIVEN** the user successfully logs into nospeak and the ordered login history/sync flow has completed
- **AND** the cached profile for the current user has no `readRelays` and no `writeRelays`
- **AND** the profile metadata does not contain a `name`, `display_name`, or `nip05` value
- **WHEN** the main messaging UI becomes active
- **THEN** a blocking modal overlay SHALL be shown informing the user that messaging relays and profile information need to be configured for this key
- **AND** the modal SHALL explain that nospeak will configure the default messaging relays `wss://nostr.data.haus`, `wss://nos.lol`, and `wss://relay.damus.io` on their behalf, with the ability to change them later in Settings
- **AND** the modal SHALL require the user to enter a non-empty name before continuing
- **AND** upon confirmation, the client SHALL persist the default relays as the user's read/write relays, update the profile metadata with the provided name, and publish both the relay list (NIP-65) and profile metadata (kind 0) to all known relays including the blaster relay
- **AND** the modal SHALL be shown again on subsequent logins while the profile continues to have no messaging relays and no username-like metadata (for example, if the user dismisses the modal or later removes all relays and name from their profile).

### Requirement: In-App Image Viewer for Messages
The messaging interface SHALL provide an in-app image viewer for inline message images so that tapping an image opens a full-screen viewer overlay instead of navigating to a separate browser tab or window. The viewer SHALL preserve the existing media rendering semantics in message bubbles while adding richer viewing controls on top.

#### Scenario: Tapping inline image opens in-app viewer
- **GIVEN** a message bubble that renders an inline image based on a media URL in the message content
- **WHEN** the user taps or clicks the image inside the message bubble
- **THEN** the system SHALL open a full-screen in-app image viewer overlay on top of the current messaging UI
- **AND** the underlying conversation view SHALL remain loaded in the background without navigating the browser or Android WebView to a different origin or tab.

#### Scenario: Viewer supports fit-to-screen and full-size panning
- **GIVEN** the in-app image viewer is open for a particular image
- **WHEN** the user activates the "full size" control in the viewer
- **THEN** the system SHALL render the image at full resolution subject to device memory and layout constraints
- **AND** the viewer content area SHALL be scrollable so that the user can pan around the image when it is larger than the viewport
- **AND** the user SHALL be able to toggle back to a fit-to-screen mode that keeps the entire image visible without requiring scrolling.

#### Scenario: Viewer provides close and download controls
- **GIVEN** the in-app image viewer is open for a particular image
- **WHEN** the user activates the close control
- **THEN** the system SHALL dismiss the viewer overlay and return focus to the underlying conversation view
- **AND** the message list and scroll position SHALL remain unchanged.
- **WHEN** the user activates the download control
- **THEN** the system SHALL initiate a download or save flow for the current image using the platform-appropriate download behavior
- **AND** this download action SHALL NOT navigate away from the nospeak messaging UI.

### Requirement: Camera Capture for Message Media Upload
The message input area SHALL provide a camera capture option labeled "Take photo" in the media upload affordance on supported devices so that users can capture and send photos directly from the chat UI. Camera-captured photos SHALL be treated as image uploads that use the existing NIP-98 authenticated media upload endpoint and rendering semantics, and the client SHALL resize captured photos client-side to a maximum dimension of 2048px (width or height) and encode them as JPEG before upload when feasible.

#### Scenario: Camera capture option available on mobile and Android app shell
- **GIVEN** the user is composing a message in the chat input
- **AND** the device is either running the nospeak Android Capacitor app shell or a mobile browser environment that supports camera capture via file input
- **WHEN** the user opens the media upload dropdown from the message input
- **THEN** the dropdown SHALL include a "Take photo" option in addition to existing Image and Video options.

#### Scenario: Captured photo is resized and uploaded as image
- **GIVEN** the user selects "Take photo" from the media upload dropdown
- **AND** the user successfully captures a photo using the device camera
- **WHEN** the client processes the captured image
- **THEN** the client SHALL resize the photo so that neither width nor height exceeds 2048px while preserving aspect ratio
- **AND** the client SHALL encode the resized photo as a JPEG with reasonable quality before uploading it as an image to the canonical media upload endpoint using a valid NIP-98 Authorization header.

#### Scenario: Captured photo URL is inserted into message input
- **GIVEN** a captured photo has been successfully uploaded as an image via the media upload endpoint
- **WHEN** the upload completes successfully
- **THEN** the resulting media URL SHALL be inserted into the message input content using the same format as existing image uploads
- **AND** when the message is sent, the photo SHALL be rendered inline in the conversation according to existing media rendering rules.

#### Scenario: Camera capture failure is non-blocking
- **GIVEN** the user selects "Take photo" from the media upload dropdown
- **WHEN** camera access is denied, the capture is cancelled, or the capture operation fails
- **THEN** the system SHALL display a non-blocking error or informational message indicating that the photo could not be captured or uploaded
- **AND** the rest of the messaging input and sending behavior SHALL remain usable.

### Requirement: Desktop Message List Page-Key Scrolling
On desktop devices, the chat interface message list SHALL support PageUp, PageDown, Home, and End keys for scrolling long conversations while a chat is active, including when the message input has focus.

#### Scenario: PageUp and PageDown scroll the message list
- **GIVEN** the user is on a desktop device (screen width > 768px)
- **AND** a chat conversation is open with enough messages to require scrolling
- **AND** either the message list or the message input textarea has focus
- **WHEN** the user presses the PageDown key
- **THEN** the message list scrolls down by approximately one visible page of messages without changing the active conversation
- **AND** the top and bottom chat header and input bar remain fixed.
- **WHEN** the user presses the PageUp key
- **THEN** the message list scrolls up by approximately one visible page of messages without changing the active conversation
- **AND** when the scroll position reaches the top threshold, any existing infinite scroll behavior for loading older messages continues to function.

#### Scenario: Home and End jump to top or bottom of history
- **GIVEN** the user is on a desktop device (screen width > 768px)
- **AND** a chat conversation is open with enough messages to require scrolling
- **AND** either the message list or the message input textarea has focus
- **WHEN** the user presses the End key
- **THEN** the message list scrolls to the bottom so the most recent message is visible
- **AND** the existing behavior that auto-scrolls on sending a message continues to work.
- **WHEN** the user presses the Home key
- **THEN** the message list scrolls to the top of the currently loaded history
- **AND** any existing infinite scroll behavior for requesting older messages remains available when the top of the list is reached.

#### Scenario: Mobile and non-chat views are unaffected
- **GIVEN** the user is on a mobile device (screen width <= 768px) or using an Android native shell
- OR the user is viewing a non-chat page or modal outside the main chat view
- WHEN** the user presses PageUp, PageDown, Home, or End
- **THEN** the messaging-specific page-key scrolling behavior does not interfere with the current view's normal keyboard behavior.

### Requirement: Android Back Navigation from Chat Detail to Contact List
When running inside the Android Capacitor app shell on a mobile form factor, the messaging experience SHALL treat the Android system back action (hardware back or OS back swipe) from a chat detail view as a request to return to the contact list rather than exiting the app or navigating to an unrelated screen.

#### Scenario: Android back from chat detail returns to contact list
- **GIVEN** the user is running nospeak inside the Android Capacitor app shell on a mobile device
- **AND** the user is currently viewing a specific conversation at URL `/chat/<npub>`
- **AND** no full-screen overlays or global modals are open
- **WHEN** the user triggers the Android system back action (via hardware back or OS back swipe)
- **THEN** the application SHALL navigate to the contact list view at `/chat`
- **AND** the app SHALL NOT exit from this back action.

#### Scenario: Android back from contact list behaves like root navigation
- **GIVEN** the user is running nospeak inside the Android Capacitor app shell on a mobile device
- **AND** the user is currently viewing the contact list root at `/chat`
- **AND** no full-screen overlays or global modals are open
- **WHEN** the user triggers the Android system back action
- **THEN** the application SHALL treat this as a root-level back navigation consistent with Android expectations (for example, delegating to browser history or exiting the app when no further in-app history is available)
- **AND** the behavior SHALL remain compatible with the existing Startup Navigation requirements for desktop and mobile.

### Requirement: Android Contact QR Scan Add Flow
The messaging experience SHALL allow users running the Android Capacitor app shell to add a new contact by scanning a `nostr:npub` QR code from the contacts header using a live camera preview.

#### Scenario: Android contact QR scan button visible
- **GIVEN** the user is authenticated and viewing the contacts list
- **AND** the app is running inside the Android Capacitor app shell
- **WHEN** the contacts header is rendered
- **THEN** the header SHALL display an Android-only "+" control immediately to the right of the "Contacts" label
- **AND** this control SHALL NOT be rendered when the app is running in a standard web browser outside the Android shell.

#### Scenario: Live camera preview opens from contacts header
- **GIVEN** the user is running nospeak inside the Android Capacitor app shell and viewing the contacts list
- **WHEN** the user taps the "+" control in the contacts header
- **THEN** the system SHALL open a glass-style full-screen "Scan contact QR" modal
- **AND** the modal SHALL show a live camera preview from the device's rear-facing camera while it is open
- **AND** the modal SHALL continuously sample frames from the preview to attempt QR decoding until either a valid contact QR is found, the user closes the modal, or an unrecoverable camera error occurs.

#### Scenario: Valid nostr npub QR opens confirmation modal
- **GIVEN** the "Scan contact QR" modal is open with an active live camera preview inside the Android Capacitor app shell
- **WHEN** the system successfully decodes a QR code from the preview whose text payload is either exactly a `npub` value or a `nostr:npub` URI (for example, `nostr:npub1…`)
- **THEN** the system SHALL normalize this payload to the underlying `npub` string
- **AND** SHALL stop the live camera preview and close the "Scan contact QR" modal
- **AND** SHALL open a separate "Contact from QR" confirmation modal that displays at least the resolved display name (or a shortened `npub` fallback) and profile picture when available for the scanned `npub`.

#### Scenario: Confirming add contact from QR creates a new contact
- **GIVEN** the "Contact from QR" confirmation modal is open for a scanned `npub` value that is not yet present in the user's contacts
- **WHEN** the user confirms by choosing to add the contact
- **THEN** the system SHALL invoke the same "add by npub" contact flow used by the Manage Contacts modal, including any profile resolution behavior
- **AND** upon success, the new contact SHALL appear in the contacts list with the same fields and display behavior as a contact added via direct `npub` entry.

#### Scenario: Already-existing contacts detected from QR
- **GIVEN** the "Contact from QR" confirmation modal is open for a scanned `npub` value
- **WHEN** the system determines that this `npub` is already present in the user's contacts
- **THEN** the modal SHALL indicate that the contact is already in the user's contacts
- **AND** SHALL NOT present an option to add a duplicate contact
- **AND** SHALL allow the user to dismiss the modal without modifying the contacts list.

#### Scenario: Non-npub QR codes are rejected gracefully
- **GIVEN** the "Scan contact QR" modal is open with an active live camera preview
- **WHEN** the system decodes a QR code whose text payload is not a `npub` value and does not match the `nostr:npub` URI form
- **THEN** the system SHALL treat this QR as invalid for the contact scan feature
- **AND** SHALL display a non-blocking error message indicating that the QR code does not contain a valid contact `npub`
- **AND** the modal SHALL remain open so the user can attempt to scan a different QR code or close the modal.

#### Scenario: Scan feature remains Android-only
- **GIVEN** the user is accessing nospeak in a standard web browser rather than the Android Capacitor app shell
- **WHEN** the contacts list is rendered and the user manages contacts
- **THEN** no "Scan QR" control SHALL be shown in the contacts header
- **AND** no live camera-based QR scan modal SHALL be exposed as part of the manage-contacts experience.

### Requirement: Contact QR Scanning on Camera-Capable Browsers
The system SHALL allow users to scan contact QR codes using the device camera from the contact list header in any environment where browser camera access is available. The Scan Contact QR trigger SHALL be visible whenever the runtime environment exposes a functional getUserMedia camera API, including the Android app shell, mobile web/PWA, and desktop browsers with webcams. QR decoding SHALL continue to interpret nostr: and npub1 payloads to extract a contact npub before opening the add-contact flow.

#### Scenario: Scan contact QR in Android app
- **GIVEN** the user is running nospeak inside the Android Capacitor app shell
- **AND** the device camera is available and permission has been granted
- **WHEN** the user taps the Scan Contact QR button in the contact list header
- **THEN** a camera preview modal opens and scans for QR codes
- **AND** when a QR containing a valid nostr npub is detected, the system opens the contact-from-QR result view pre-populated with that npub.

#### Scenario: Scan contact QR in mobile web or PWA
- **GIVEN** the user is accessing nospeak in a mobile browser or installed PWA on a device whose browser exposes navigator.mediaDevices.getUserMedia for the camera
- **AND** the user has granted camera permission to nospeak
- **WHEN** the user taps the Scan Contact QR button in the contact list header
- **THEN** a camera preview modal opens and scans for QR codes using the rear or environment-facing camera when available
- **AND** when a QR containing a valid nostr npub is detected, the system opens the contact-from-QR result view pre-populated with that npub.

#### Scenario: Scan contact QR in desktop browser with webcam
- **GIVEN** the user is accessing nospeak in a desktop browser that exposes navigator.mediaDevices.getUserMedia and has at least one usable camera or webcam
- **AND** the browser has granted camera permission to nospeak
- **WHEN** the user clicks the Scan Contact QR button in the contact list header
- **THEN** a camera preview modal opens and scans for QR codes using an available camera
- **AND** when a QR containing a valid nostr npub is detected, the system opens the contact-from-QR result view pre-populated with that npub.

#### Scenario: No camera or permission available for scanning
- **GIVEN** the user is accessing nospeak in an environment where navigator.mediaDevices.getUserMedia is not available, no camera devices are present, or camera access is denied
- **WHEN** the contact list view is rendered
- **THEN** the Scan Contact QR trigger SHALL NOT be shown in the header
- **OR** if shown due to partial capability detection, activating it SHALL result in a non-blocking camera-error state in the scanning modal without crashing the application.

