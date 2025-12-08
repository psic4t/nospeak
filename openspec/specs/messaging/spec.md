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
The messaging interface SHALL detect HTTP(S) URLs in message content that are not recognized as direct image or video media links and MAY render a compact URL preview card under the message bubble. The preview card SHALL display, when available, the destination page title, a short description or summary, and the effective domain, and MAY include a small favicon or thumbnail image.

#### Scenario: Preview card for non-media link
- **GIVEN** a sent or received message whose content includes at least one HTTP(S) URL that does not point directly to an image or video file
- **WHEN** the message is rendered in the chat history
- **THEN** the system SHALL display a single compact URL preview card associated with that message
- **AND** the card SHALL show the link's effective domain and title when metadata is available
- **AND** the entire card SHALL be clickable and open the link in a new browser tab or window using standard safe-link behavior.

#### Scenario: No preview for media-only URLs
- **GIVEN** a message whose URLs all point directly to image or video files that are already supported by the Media Upload and Media display behavior
- **WHEN** the message is rendered in the chat history
- **THEN** the system SHALL render media inline as currently specified
- **AND** SHALL NOT render an additional non-media URL preview card for those media URLs.

#### Scenario: Graceful degradation when metadata unavailable
- **GIVEN** a message that contains a non-media HTTP(S) URL
- **AND** the system attempts to fetch preview metadata for that URL
- **WHEN** the metadata request fails, times out, or returns only partial information
- **THEN** the message text SHALL still render with a clickable link
- **AND** the system MAY omit the preview card entirely when no meaningful metadata is available
- **AND** the user SHALL NOT see an inline error message that blocks reading the message content.

#### Scenario: Multiple links in a single message
- **GIVEN** a message that contains multiple distinct non-media HTTP(S) URLs
- **WHEN** the message is rendered in the chat history
- **THEN** the system MAY render at most one URL preview card for that message (for example, for the first or primary URL)
- **AND** all URLs in the message text remain clickable regardless of whether they are represented in the preview card.

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
- **AND** message notifications are enabled in Settings  General
- **AND** the browser has granted notification permission
- **WHEN** a new message addressed to the current user is received and processed by the messaging pipeline
- **AND** the nospeak window is not the active foreground tab or is minimized
- **THEN** the system SHALL display a browser notification indicating a new message, including the sender name when available and a short message preview
- **AND** activating the notification SHALL focus the nospeak window and navigate to the conversation with that sender.

#### Scenario: Android app shows local notification for new message
- **GIVEN** the user is running nospeak inside the Android Capacitor app shell
- **AND** message notifications are enabled in Settings  General
- **AND** the Android OS has granted permission for local notifications
- **WHEN** a new message addressed to the current user is received and processed while the app is in the background or not currently visible
- **THEN** the system SHALL display an Android OS notification for the new message using the configured messages notification channel and icon
- **AND** activating the notification SHALL bring the nospeak Android app to the foreground and navigate to the conversation with that sender.

#### Scenario: Notifications suppressed when disabled or permission missing
- **GIVEN** either message notifications are disabled in Settings  General for the current device or the platform has denied notification permission
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

