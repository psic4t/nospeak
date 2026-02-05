# Messaging Specification

## Purpose
Define requirements for chat messaging functionality including text communication and media sharing between users.
## Requirements
### Requirement: Message Input Interface
The message input area SHALL provide a media upload button instead of displaying the user's profile picture. The media upload button SHALL open a dropdown menu to select between Image, Video, Audio, and File types before opening the file selection dialog. On desktop devices, the message input area SHALL render the media upload button and a circular send button inside a single input bar. The send button SHALL be styled using the active Catppuccin theme green color and SHALL only be visible when the input contains non-whitespace text; on mobile devices, the inline send button SHALL be hidden and sending SHALL occur via the keyboard action instead.

#### Scenario: Media upload button interaction
- **WHEN** user clicks the media upload button
- **THEN** a dropdown menu appears with "Image", "Video", "Audio", and "File" options
- **WHEN** user selects "Image" from dropdown
- **THEN** the file selection dialog opens for image files only
- **WHEN** user selects "Video" from dropdown  
- **THEN** the file selection dialog opens for video files only
- **WHEN** user selects "Audio" from dropdown
- **THEN** the file selection dialog opens for audio files only
- **WHEN** user selects "File" from dropdown
- **THEN** the file selection dialog opens for all file types

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
The system SHALL allow users to upload images, videos, MP3 audio files, and generic files as encrypted attachments in NIP-17 conversations.

Uploads SHALL be performed using Blossom servers:
- If the user has one or more configured Blossom servers, the client SHALL upload the encrypted blob to Blossom servers using BUD-03 server ordering and Blossom authorization events (kind `24242`) as defined by BUD-01/BUD-02.
- If the user has zero configured Blossom servers and attempts an upload, the client SHALL automatically configure the default Blossom server list (deployment-configurable; defaults: `https://blossom.data.haus`, `https://blossom.primal.net`), SHALL display an in-app informational modal indicating these servers were set, and SHALL then upload using Blossom as normal.

Generic file uploads SHALL be limited to 10 MB maximum file size, validated client-side before upload.

When Blossom uploads are used:
- The client MUST attempt to upload the blob to at least the first configured Blossom server.
- After the first successful upload, the client SHOULD attempt to mirror the blob to the remaining configured servers using BUD-04 `PUT /mirror` with the origin blob `url` in the request body.
- Mirroring SHOULD be best-effort and MUST NOT block the message send that depends on the primary upload.
- If a target Blossom server responds to `PUT /mirror` with HTTP `404`, `405`, or `501`, the client MAY fall back to re-uploading the blob to that server using `PUT /upload` on a best-effort basis.

#### Scenario: Client uploads generic file to Blossom
- **GIVEN** the user has at least one configured Blossom server URL
- **AND** the user selects a generic file under 10 MB via the "File" option
- **WHEN** the client encrypts and uploads the file
- **THEN** the file is uploaded to the first Blossom server using `PUT /upload`
- **AND** a kind 15 file message is sent with the encrypted file URL, original MIME type, and decryption metadata

#### Scenario: Client mirrors to a secondary Blossom server using BUD-04
- **GIVEN** the user has at least two configured Blossom server URLs
- **WHEN** the client uploads an encrypted blob to the first server using `PUT /upload` and receives a blob descriptor with a `url`
- **THEN** the client SHOULD send `PUT /mirror` to the second server with JSON body `{ "url": <primary url> }`
- **AND** the request SHOULD include a valid Blossom authorization event (kind `24242` with `t=upload` and an `x` tag matching the blob’s SHA-256)
- **AND** any failure to mirror MUST NOT prevent sending the file message using the primary server `url`.

#### Scenario: Mirror endpoint unsupported triggers fallback upload
- **GIVEN** the user has at least two configured Blossom server URLs
- **AND** the secondary server responds to `PUT /mirror` with HTTP `404`, `405`, or `501`
- **WHEN** the client attempts best-effort mirroring
- **THEN** the client MAY fall back to uploading the blob to the secondary server using `PUT /upload`.

#### Scenario: Mirror endpoint auth failure does not trigger fallback upload
- **GIVEN** the user has at least two configured Blossom server URLs
- **AND** the secondary server responds to `PUT /mirror` with HTTP `401` or `403`
- **WHEN** the client attempts best-effort mirroring
- **THEN** the client MUST NOT fall back to re-uploading the blob to that server.

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
The system SHALL synchronize message history efficiently by downloading only missing messages and processing them in batches. On first-time sync (empty local cache), the system SHALL fetch gift-wrap events with `created_at` timestamps approximately within the last 30 days (hardcoded). On subsequent syncs, the system SHALL fetch only recent messages to fill gaps. Messages older than the 30-day window remain available via explicit user action in a conversation.

**Note**: The 30-day boundary is approximate because NIP-59 gift-wrap `created_at` timestamps may be randomized by clients to obscure message timing. Contacts with no activity in the last ~30 days won't be auto-created during first sync; they'll be created when older history is backfilled.

#### Scenario: First-time sync fetches ~30-day window only
- **GIVEN** the user logs in for the first time (no messages in local cache)
- **WHEN** the application starts message synchronization
- **THEN** it fetches gift-wrap events from relays in batches, starting from now
- **AND** continues fetching backward until the `until` parameter would drop below now minus 30 days
- **AND** displays sync progress showing message count
- **AND** stops paging even if relays still have older events

#### Scenario: Returning user sync (existing cache) [unchanged]
- **GIVEN** the user has existing messages in local cache
- **WHEN** the application starts
- **THEN** it fetches only the most recent batch of messages (50)
- **AND** stops fetching when it encounters known messages

#### Scenario: Incremental history fetch [unchanged]
- **GIVEN** the user has existing messages up to timestamp T
- **WHEN** the application starts
- **THEN** it fetches history backwards from now
- **AND** it stops fetching automatically when it encounters messages older than T that are already stored locally

#### Scenario: Pipeline processing [unchanged]
- **WHEN** a batch of historical messages is received
- **THEN** the system decrypts and saves them immediately
- **AND** the UI updates to show them (if within view) before the next batch is requested
- **AND** any messages fetched via history sync that are later delivered again via the real-time subscription SHALL be identified by event ID and ignored to prevent duplication

#### Scenario: Older history available on-demand after first-sync
- **GIVEN** the user has completed first-time sync (local DB contains messages up to ~30 days)
- **AND** the user opens a specific conversation
- **WHEN** the user scrolls to the top of the message list and local cache is exhausted
- **THEN** the "Fetch older messages from relays" control is shown
- **AND** clicking it triggers `fetchOlderMessages` to request older history beyond the 30-day window
- **AND** newly fetched messages are saved into the local database and displayed

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

### Requirement: Scroll Positioning and Media Loading
The chat interface SHALL ensure correct scroll positioning at the bottom of the conversation when opened, even when recent messages contain media.

#### Scenario: Eager loading for recent media attachments
- **GIVEN** the user opens a chat or switches conversations
- **WHEN** the message list renders the most recent messages
- **THEN** any media attachments (images) within the last 3 messages SHALL be forced to load eagerly (`loading="eager"`)
- **AND** older messages SHALL continue to use lazy loading (`loading="lazy"`)
- **AND** this ensures the browser resolves media dimensions immediately, preventing "false bottom" issues where the scroll position stops short of the actual latest content.

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
The system SHALL initialize relay connections for returning authenticated users using cached relay configuration when available, and SHALL refresh the current user's profile and relay configuration in the background when the cached profile has expired. Relay discovery for messaging relays SHALL prefer NIP-17 kind 10050 "messaging relay" lists for the current user and contacts, and MAY fall back to NIP-65 kind 10002 mailbox relay lists only when no kind 10050 list exists for a given profile.

#### Scenario: Returning user uses cached messaging relays
- **GIVEN** the user is already authenticated
- **AND** a cached profile for the user exists with at least one relay URL in its messaging relay configuration (derived from either kind 10050 or 10002)
- **WHEN** the application restores the session on startup
- **THEN** it connects to the cached messaging relays without performing full relay discovery
- **AND** the main chat interface becomes usable without waiting for relay discovery to complete

#### Scenario: First-time or missing messaging relays still trigger discovery
- **GIVEN** the user is already authenticated
- **AND** no cached profile with messaging relay information exists for the user
- **WHEN** the application restores the session on startup
- **THEN** it performs relay discovery for the user, first attempting to fetch kind 10050 messaging relay events and only falling back to kind 10002 mailbox relay events when no kind 10050 list is found
- **AND** uses the discovered messaging relays for subsequent cached startups

#### Scenario: Background refresh on expired profile prefers NIP-17 messaging relays
- **GIVEN** the user is authenticated and the application has finished initial startup
- **AND** a cached profile exists for the user whose TTL has expired
- **WHEN** the delayed background refresh runs after startup
- **THEN** the system performs relay discovery for the user without blocking the UI
- **AND** it prefers kind 10050 messaging relay lists when updating the cached configuration, only using kind 10002 lists when no messaging relay list is published for that profile.

### Requirement: First-Time Sync Progress Indicator
The system SHALL display a blocking modal progress indicator during the ordered login and first-time message synchronization flow on both desktop and mobile devices. The indicator SHALL remain visible and blocking until the flow has completed all required steps, has timed out, or has been dismissed by the user, and SHALL show both the current step label and the number of fetched messages, updating in real time as history sync batches are processed.

The sync flow SHALL enforce a global timeout of 5 minutes. When the timeout is reached, the modal SHALL display an error state showing which relays encountered errors and during which step, along with options to retry or skip. After 2 minutes of sync progress, the modal SHALL offer a "Continue in background" option that dismisses the modal while allowing sync to complete silently; when background sync completes, the system SHALL display a toast notification.

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

#### Scenario: Discovery relays used for profile fetching steps
- **GIVEN** the login history synchronization flow has completed step 4 (fetch history)
- **AND** discovery relays have been cleaned up after step 3
- **WHEN** the system begins step 5 (fetch contact profiles) or step 6 (fetch user profile)
- **THEN** the system SHALL temporarily reconnect to discovery relays alongside the user's persistent messaging relays
- **AND** profile resolution queries SHALL be sent to both discovery relays and the user's messaging relays
- **AND** after both steps 5 and 6 complete, the system SHALL clean up the temporary discovery relay connections while keeping the user's persistent messaging relays connected.

#### Scenario: Profile fetching succeeds when user has blank messaging relay
- **GIVEN** the user has configured a single messaging relay that is new or does not have contact profiles cached
- **AND** the login history synchronization flow is executing steps 5 and 6
- **WHEN** the system attempts to fetch contact profiles and user profile
- **THEN** profile resolution SHALL query both the user's messaging relay and discovery relays
- **AND** profiles published to discovery relays (such as purplepag.es, relay.damus.io, nos.lol) SHALL be successfully fetched even when absent from the user's messaging relay.

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

#### Scenario: Global sync timeout triggers error state
- **GIVEN** the blocking login history synchronization flow is in progress
- **WHEN** 5 minutes have elapsed since the flow started without reaching completion
- **THEN** the sync flow SHALL be aborted
- **AND** the modal SHALL transition to an error state displaying:
  - An error title indicating sync failed
  - A message indicating the sync timed out after 5 minutes
  - A list of relay errors showing which relay URLs failed and during which step
- **AND** the modal SHALL display a "Retry" button and a "Skip and continue" button.

#### Scenario: Relay error tracking during sync
- **GIVEN** the login history synchronization flow is executing a step that involves relay communication
- **WHEN** a relay fails to connect, times out, or returns an error during that step
- **THEN** the system SHALL record the relay URL, error message, and current step identifier
- **AND** these errors SHALL be displayed in the error state UI when the sync fails or times out.

#### Scenario: Retry button restarts sync flow
- **GIVEN** the sync modal is displaying the error state with "Retry" and "Skip and continue" buttons
- **WHEN** the user clicks the "Retry" button
- **THEN** the system SHALL reset the sync state (clearing errors, progress, and step statuses)
- **AND** SHALL restart the login history synchronization flow from the beginning
- **AND** the modal SHALL return to the normal progress display.

#### Scenario: Skip button dismisses modal and continues in background
- **GIVEN** the sync modal is displaying the error state with "Retry" and "Skip and continue" buttons
- **WHEN** the user clicks the "Skip and continue" button
- **THEN** the blocking modal overlay SHALL be dismissed immediately
- **AND** the sync flow SHALL continue executing in the background (if not already terminated)
- **AND** the main chat interface SHALL become usable
- **AND** when the background sync completes (successfully or not), a toast notification SHALL be displayed.

#### Scenario: Continue in background option after 2 minutes
- **GIVEN** the blocking login history synchronization flow is in progress
- **AND** the modal is displaying normal progress (not error state)
- **WHEN** 2 minutes have elapsed since the flow started
- **THEN** the modal SHALL display a "Continue in background" button
- **AND** clicking this button SHALL dismiss the modal, allow the sync to continue in the background, and display a toast notification when sync completes.

#### Scenario: Toast notification on background sync completion
- **GIVEN** the user has dismissed the sync modal via "Skip and continue" or "Continue in background"
- **AND** the sync flow is continuing in the background
- **WHEN** the background sync flow completes (either successfully or by exhausting retries)
- **THEN** a toast notification SHALL be displayed indicating whether sync completed successfully or with errors.

### Requirement: Real-Time Message Subscription and Deduplication
When Android background messaging is enabled and delegated to the native Android foreground service, the system SHALL avoid notification floods caused by historical replay while still tolerating backdated gift-wrap timestamps.

- The native foreground service SHALL use decrypted inner rumor timestamps for notification eligibility decisions when available.
- The native foreground service SHALL NOT rely on the outer gift-wrap `created_at` as a strict eligibility filter for notifications.

#### Scenario: Background notification eligibility uses inner rumor timestamp
- **GIVEN** the user is running nospeak inside the Android Capacitor app shell
- **AND** Android background messaging is enabled and the native foreground service is active
- **WHEN** a gift-wrap event decrypts to a DM rumor that contains a `created_at` timestamp
- **THEN** the service SHALL use the rumor timestamp to decide whether the message is eligible to notify
- **AND** it SHALL suppress notifications for rumors outside the configured backlog guard window.

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

### Requirement: Manage Contacts Search via NIP-50 Relay
The Manage Contacts modal SHALL support searching for users by name or phrase using a dedicated NIP-50 search relay, by NIP-05 identifier using web-based lookup, and by `npub` for direct entry, while preserving the existing direct-add behavior for `npub` inputs.

The NIP-50 search relay URL SHALL be deployment-configurable at runtime (default: `wss://relay.nostr.band`) and MUST use `wss://`.

NIP-05 lookup SHALL be performed by fetching `https://<domain>/.well-known/nostr.json?name=<local-part>` for a valid NIP-05 address of the form `localpart@domain` and converting the returned hex public key to an `npub`.

#### Scenario: Direct npub entry bypasses search
- **GIVEN** the user opens the Manage Contacts modal
- **AND** the user enters a value that starts with `npub` into the contact input field
- **WHEN** the user clicks the "Add" button
- **THEN** the system SHALL treat the value as an `npub`
- **AND** SHALL attempt to resolve the profile and add the contact using the existing direct-add flow without performing a search

#### Scenario: Phrase input triggers search
- **GIVEN** the user opens the Manage Contacts modal
- **AND** the user enters a non-empty value that does not start with `npub` and does not match NIP-05 format into the contact input field
- **AND** the entered value is at least three characters long after trimming whitespace
- **WHEN** the user stops typing for a short period
- **THEN** the system SHALL send a NIP-50 `search` query to the configured NIP-50 search relay (default: `wss://relay.nostr.band`) restricted to kind `0` metadata events with a maximum of 20 results
- **AND** the system SHALL display matching users in a dropdown under the contact input field

#### Scenario: NIP-05 input triggers immediate lookup
- **GIVEN** the user opens the Manage Contacts modal
- **AND** the user enters a value in NIP-05 format (`localpart@domain` where both parts are non-empty) into the contact input field
- **WHEN** the user completes entering the NIP-05 address
- **THEN** the system SHALL immediately fetch `https://<domain>/.well-known/nostr.json?name=<local-part>`
- **AND** SHALL NOT trigger the NIP-50 relay-based search
- **AND** SHALL display a loading state while the lookup is in progress

#### Scenario: NIP-05 lookup displays user with avatar and username
- **GIVEN** the user has entered a valid NIP-05 address
- **AND** the system has successfully fetched the NIP-05 JSON response
- **AND** the response contains a hex public key for the requested `localpart`
- **WHEN** the system converts the hex public key to an `npub`
- **THEN** the system SHALL resolve the user's profile metadata from relays using `profileResolver`
- **AND** SHALL display a single result under the input field showing:
  - The user's avatar when profile metadata includes a `picture` URL
  - The user's username derived from `name` or `display_name` in profile metadata
  - The shortened `npub` as secondary text
  - An "Already added" badge if the `npub` already exists in the user's contacts list

#### Scenario: NIP-05 for already-added contact shows badge
- **GIVEN** the user has entered a valid NIP-05 address
- **AND** the system has resolved the hex public key and converted it to an `npub`
- **AND** the resolved `npub` already exists in the user's contacts list
- **WHEN** the NIP-05 result is displayed in the dropdown
- **THEN** the result row SHALL display an "Already added" badge
- **AND** the result row SHALL be disabled and non-interactive so clicking it does not populate the input field

#### Scenario: NIP-05 invalid format displays error
- **GIVEN** the user opens the Manage Contacts modal
- **AND** the user enters a value that does not match the NIP-05 format (e.g., `missing@domain`, `@domain`, `user@`, or plain text without `@`)
- **WHEN** the system attempts to parse the input as a NIP-05 address
- **THEN** the system SHALL display an error message indicating invalid NIP-05 format
- **AND** SHALL suggest the correct format (`name@domain.com`)
- **AND** SHALL NOT perform NIP-05 lookup or relay-based search

#### Scenario: NIP-05 not found displays error
- **GIVEN** the user enters a valid NIP-05 format (`localpart@domain`)
- **AND** the system successfully fetches the NIP-05 JSON response from `https://<domain>/.well-known/nostr.json?name=<local-part>`
- **AND** the response does not contain an entry for the requested `localpart`
- **WHEN** the lookup completes
- **THEN** the system SHALL display an error message indicating the NIP-05 was not found
- **AND** SHALL NOT display any user result

#### Scenario: NIP-05 network error displays error
- **GIVEN** the user enters a valid NIP-05 format (`localpart@domain`)
- **AND** the system attempts to fetch `https://<domain>/.well-known/nostr.json?name=<local-part>`
- **AND** the fetch fails due to network error, CORS restrictions, or HTTP error status
- **WHEN** the lookup fails
- **THEN** the system SHALL display an error message indicating the NIP-05 lookup failed
- **AND** MAY include specific error details (e.g., HTTP status or network error)

#### Scenario: Selecting NIP-05 result pre-fills npub for adding
- **GIVEN** the user has entered a valid NIP-05 address
- **AND** the system has successfully resolved the NIP-05 to an `npub` and displayed the result
- **AND** the resolved `npub` is not already in the user's contacts list
- **WHEN** the user clicks on the NIP-05 result row
- **THEN** the system SHALL populate the contact input field with the resolved `npub`
- **AND** SHALL close the NIP-05 results dropdown
- **AND** SHALL require the user to click the existing "Add" button to finalize adding the contact

#### Scenario: Adding a contact via NIP-05 behaves like direct npub add
- **GIVEN** the user has clicked a NIP-05 result and the contact input field contains the resolved `npub`
- **WHEN** the user clicks the "Add" button
- **THEN** the system SHALL resolve the user's profile and relay information using the same logic as direct `npub` entry
- **AND** SHALL add the selected user to the contacts list with the same fields and downstream behaviour as a contact added by manually entering their `npub`
- **AND** SHALL NOT store the original NIP-05 address (profile metadata fetching via `profileResolver` will retrieve the NIP-05 from the profile if published)

#### Scenario: NIP-05 mode takes precedence over relay search
- **GIVEN** the user opens the Manage Contacts modal
- **AND** the user types text that matches NIP-05 format (contains `@` with non-empty local part and domain)
- **WHEN** the input contains a valid NIP-05 format
- **THEN** the system SHALL NOT trigger the NIP-50 relay-based search
- **AND** SHALL only perform the NIP-05 web lookup

#### Scenario: Typing "@" after local-part triggers NIP-05 mode
- **GIVEN** the user opens the Manage Contacts modal
- **AND** the user has typed a local-part (e.g., "alice")
- **WHEN** the user types the `@` character
- **THEN** the system SHALL recognize the input as a potential NIP-05 address
- **AND** SHALL enter NIP-05 lookup mode once the domain is entered
- **AND** SHALL NOT trigger relay-based search

#### Scenario: Removing "@" from input reverts to relay search
- **GIVEN** the user has entered a partial NIP-05 address (e.g., "alice@")
- **AND** the system is in NIP-05 lookup mode
- **WHEN** the user removes the `@` character
- **THEN** the system SHALL exit NIP-05 lookup mode
- **AND** SHALL treat the input as plain text for relay-based search if it is 3+ characters long

#### Scenario: Search results display
- **GIVEN** the system has received at least one matching user from the search relay
- **WHEN** the dropdown under the contact input is rendered
- **THEN** each result SHALL show the user's avatar when a profile picture is available
- **AND** SHALL show a primary display name derived from profile metadata when available
- **AND** SHALL show the user's shortened `npub` as secondary text
- **AND** MAY display additional metadata such as NIP-05 identifier when available

#### Scenario: Selecting a search result pre-fills npub
- **GIVEN** search results are visible in the dropdown under the contact input (from relay search, not NIP-05)
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
The messaging interface and related browser surfaces SHALL use the updated nospeak logo with Catppuccin-aligned coloring. In-app chat views SHALL render the nospeak logo using a theme-aware style that displays Latte Lavender in bright/light appearances and a white logo matching Frappe text color in dark appearances. Browser favicons and PWA icons SHALL use a Latte Text-tinted version of the nospeak logo. Messaging notifications SHALL use the Latte Text-tinted nospeak logo for their badge and for any platform-required small status-bar icon.

#### Scenario: Messaging notifications show Latte Lavender branded badge
- **GIVEN** the user has granted notification permission and notifications are enabled in Settings
- **WHEN** a new message notification is shown for an incoming message
- **THEN** the notification badge uses a nospeak logo tinted with Catppuccin Latte Lavender
- **AND** where the platform requires a small status-bar icon (for example Android), it uses the same branded Latte Lavender nospeak icon asset.

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
The chats sidebar header on mobile-sized layouts SHALL display the nospeak app name label next to the current user's avatar so that users can clearly recognize the app context when viewing or switching chats.

#### Scenario: Mobile chats header includes app name
- **GIVEN** the user is authenticated and viewing the chats list
- **AND** the viewport corresponds to a mobile-sized layout (for example, screen width <= 768px or native mobile shell)
- **WHEN** the chats sidebar header is rendered
- **THEN** the current user's avatar is shown
- **AND** a textual "nospeak" label appears adjacent to the avatar within the same header grouping
- **AND** the existing settings control remains accessible on the opposite side of the header without overlapping the label

### Requirement: Local Message Notifications for New Messages
When message notifications are enabled for the current device and the platform has granted notification permission, the messaging experience SHALL surface user-visible notifications for newly received messages using the platform-appropriate mechanism (browser notifications on web, OS-level notifications in the Android app) while the application is running.

When the received message is a media attachment (file message with a MIME type), the notification body SHALL display a localized media-type label with an icon instead of the raw file URL. When the received message is a location message (message with a `location` field), the notification body SHALL display `📍` followed by a localized "Location" label instead of the raw `geo:` coordinate string.

#### Scenario: Web browser shows new message notification
- **GIVEN** the user is accessing nospeak in a supported web browser
- **AND** message notifications are enabled in Settings → General
- **AND** the browser has granted notification permission
- **AND** the nospeak window is not the active, focused foreground tab (for example, the user has switched to another tab, minimized the window, or switched to another application or virtual desktop)
- **WHEN** a new message addressed to the current user is received and processed by the messaging pipeline
- **THEN** the system SHALL display a browser notification indicating a new message, including the sender name when available and a short message preview
- **AND** activating the notification SHALL focus the nospeak window and navigate to the conversation with that sender.

#### Scenario: Web browser shows notification for different active conversation
- **GIVEN** the user is accessing nospeak in a supported web browser
- **AND** message notifications are enabled in Settings → General
- **AND** the browser has granted notification permission
- **AND** the nospeak window is visible and focused
- **AND** the user is currently viewing an open conversation with Contact A
- **WHEN** a new message addressed to the current user is received from Contact B (a different conversation) and processed by the messaging pipeline
- **THEN** the system SHALL display a browser notification indicating a new message from Contact B, including the sender name when available and a short message preview
- **AND** activating the notification SHALL keep or bring the nospeak window to the foreground and navigate to the conversation with Contact B.

#### Scenario: Web browser suppresses notification for active conversation
- **GIVEN** the user is accessing nospeak in a supported web browser
- **AND** message notifications are enabled in Settings → General
- **AND** the browser has granted notification permission
- **AND** the nospeak window is visible and focused
- **AND** the user is currently viewing an open conversation with Contact A
- **WHEN** a new message addressed to the current user is received from Contact A and processed by the messaging pipeline
- **THEN** the system SHALL NOT display a browser notification for that message
- **AND** the message SHALL still appear in the in-app conversation view and update unread indicators according to existing messaging requirements.

#### Scenario: Android app shows local notification for new message via background service
- **GIVEN** the user is running nospeak inside the Android Capacitor app shell
- **AND** message notifications are enabled in Settings → General
- **AND** the Android OS has granted permission for local notifications
- **AND** Android background messaging is enabled and the native foreground service for background messaging is active
- **WHEN** a new message addressed to the current user is received while the app UI is not visible
- **THEN** the native foreground service SHALL emit an Android OS notification for the new message
- **AND** the notification body SHALL include a short plaintext preview when decryption via the active signer is available
- **AND** activating the notification SHALL bring the nospeak Android app to the foreground and navigate to the conversation with that sender.

#### Scenario: Android app uses JS-driven notifications only when background messaging disabled
- **GIVEN** the user is running nospeak inside the Android Capacitor app shell
- **AND** message notifications are enabled in Settings → General
- **AND** the Android OS has granted permission for local notifications
- **AND** Android background messaging is disabled
- **WHEN** a new message addressed to the current user is received and processed while the app UI is not visible
- **THEN** the web runtime MAY emit an Android OS notification via the existing notification service
- **AND** this notification behavior SHALL remain eligible only while the web runtime is executing.

#### Scenario: Notifications suppressed when disabled or permission missing
- **GIVEN** either message notifications are disabled in Settings → General for the current device or the platform has denied notification permission
- **WHEN** a new message is received (regardless of whether it is processed by the web runtime or the Android background service)
- **THEN** the system SHALL NOT show a browser or Android OS notification for that message
- **AND** the rest of the messaging behavior (message storage and in-app display) SHALL continue to function normally.

#### Scenario: Location message notification shows localized label
- **GIVEN** message notifications are enabled and the platform has granted notification permission
- **AND** the user is not currently viewing the conversation with the sender
- **WHEN** a new location message (message with a `location` field) is received and processed by the messaging pipeline
- **THEN** the notification body SHALL display `📍` followed by the localized location label (for example "Location" in English, "Standort" in German)
- **AND** SHALL NOT display the raw `geo:lat,lng` coordinate string as the notification body.

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

When the most recent message is a media attachment (file message with a MIME type), the preview SHALL display a localized media-type label with an icon (for example `🎤 Voice Message`, `📷 Image`) instead of the raw file URL. When the most recent message is a location message (message with a `location` field), the preview SHALL display `📍` followed by a localized "Location" label instead of the raw `geo:` coordinate string.

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

#### Scenario: Location message shows localized label in preview
- **GIVEN** the user is authenticated and viewing the contacts list
- **AND** the viewport corresponds to a mobile-sized layout
- **AND** the most recent message from Contact C is a location message (has a `location` field with latitude and longitude)
- **WHEN** the contacts list is rendered
- **THEN** the preview line for Contact C SHALL display `📍` followed by the localized location label (for example "Location" in English, "Standort" in German)
- **AND** SHALL NOT display the raw `geo:lat,lng` coordinate string.

### Requirement: Android Background Message Delivery
When running inside the Android Capacitor app shell with background messaging enabled, the messaging experience on Android SHALL delegate background message reception and notification to a native foreground service that connects to the user's read relays, subscribes to gift-wrapped messages, and triggers OS notifications even while the WebView is suspended.

#### Scenario: Background subscriptions deliver plaintext previews on Android
- **GIVEN** the user is logged in and has enabled background messaging in Settings → General while running inside the Android Capacitor app shell
- **AND** the native Android foreground service for background messaging is active
- **AND** message notifications are enabled and Android has granted local notification permission
- **WHEN** a new gift-wrapped message addressed to the current user is delivered from any configured read relay while the app UI is not visible
- **THEN** the native service SHALL attempt to decrypt the gift-wrap using the active Android signer integration
- **AND** when the inner rumor is a Kind 14 text message authored by another user, it SHALL raise an Android OS notification whose body includes a truncated plaintext preview
- **AND** when the inner rumor is a Kind 14 location message (has a `location` tag or content starting with `geo:`) authored by another user, it SHALL raise an Android OS notification whose body is `📍 Location`
- **AND** when the inner rumor is a Kind 15 file message authored by another user, it SHALL raise an Android OS notification whose body includes the phrase `Message: Sent you an attachment`
- **AND** when the decrypted inner rumor is a NIP-25 `kind 7` reaction, it SHALL NOT raise an Android OS notification for that reaction
- **AND** when decryption is not available or fails, it SHALL NOT raise a generic "new encrypted message" notification.

#### Scenario: Background notifications show cached sender identity when available
- **GIVEN** the same background messaging setup as above
- **AND** the web runtime has previously resolved and cached the sender's Nostr kind `0` metadata on this Android installation
- **WHEN** the native background messaging service raises an Android OS notification for conversation activity from that sender
- **THEN** it SHOULD use the cached **username** derived from kind `0.name` as the notification title
- **AND** it SHOULD display the cached avatar derived from kind `0.picture` as the notification large icon on a best-effort basis
- **AND** it SHALL fall back to existing generic notification titling when no cached username is available
- **AND** it SHALL NOT subscribe to kind `0` metadata events from relays as part of notification emission.

### Requirement: Energy-Efficient Background Messaging on Android
The messaging implementation for Android background messaging SHALL minimize energy usage by limiting background work to maintaining relay subscriptions, processing incoming messages, and firing notifications, and SHALL apply conservative reconnection and backoff behavior when connections are lost.

To reduce unnecessary wakeups and background network work while preserving near-realtime message delivery, the Android-native foreground service responsible for background messaging SHOULD:
- Use adaptive heartbeat behavior (as defined by the `android-app-shell` background messaging connection reliability requirements) to reduce WebSocket keepalive frequency while the device is locked.
- Avoid non-essential network and CPU work that is not required to deliver message notifications (for example, avatar fetching and conversation shortcut publishing) while the device is locked.

#### Scenario: No extra polling beyond relay subscriptions
- **GIVEN** background messaging is active on Android
- **WHEN** the app is running in background mode
- **THEN** the messaging pipeline SHALL avoid scheduling additional periodic polling or history sync jobs solely for background operation
- **AND** it SHALL rely primarily on real-time subscriptions to receive new messages.

#### Scenario: Conservative reconnection and backoff in background
- **GIVEN** background messaging is active and one or more relay connections are lost due to network changes or OS behavior
- **WHEN** the messaging pipeline attempts to reconnect to read relays while the app is in the background
- **THEN** it SHALL use a conservative reconnection strategy (for example, exponential backoff with upper bounds) to limit repeated connection attempts
- **AND** it SHALL stop attempting reconnections entirely if the user signs out or disables background messaging.

#### Scenario: Locked background operation avoids non-essential enrichment
- **GIVEN** the user is running nospeak inside the Android Capacitor app shell
- **AND** background messaging is enabled and the native foreground service is active
- **AND** the device is locked
- **WHEN** the foreground service emits Android OS message notifications for newly received messages
- **THEN** it SHOULD avoid non-essential enrichment work that would trigger additional background network usage (such as avatar downloads)
- **AND** it SHOULD avoid non-essential platform integration work that is not required for notification delivery (such as publishing conversation shortcuts) while locked.

### Requirement: Login Screen Local Keypair Generator
The unauthenticated login screen SHALL provide a locally generated Nostr keypair option in addition to existing login methods (Amber, which on Android uses a NIP-55-compatible external signer when running inside the Android app shell, NIP-07 extension when available, and manual `nsec` entry). The keypair generator flow SHALL be accessible via a small link under the local `nsec` login control, SHALL open a dedicated modal that displays the newly generated `npub` and `nsec`, and SHALL offer controls to regenerate and to log in using the currently displayed secret key. Key generation SHALL occur entirely on the client using a standard Nostr keypair format, and the generated keys SHALL NOT be persisted by the keypair UI itself until or unless the user explicitly chooses to log in with them.

#### Scenario: User opens keypair generator from login screen
- **GIVEN** the unauthenticated login screen is visible with options for Amber (which, when running inside the Android app shell, uses a NIP-55-compatible external signer), NIP-07 extension (when available), and manual `nsec` entry
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
After a successful login and completion of the ordered login history flow, the messaging experience SHALL display a blocking setup modal whenever the current user's profile has no configured messaging relays and no username-like metadata. The modal SHALL explain that at least one messaging relay and a basic profile identifier are required for a usable experience, SHALL pre-populate a small default set of messaging relays for the user (deployment-configurable; defaults: `wss://nostr.data.haus`, `wss://nos.lol`, `wss://relay.damus.io`) that can be edited later in Settings, and SHALL require the user to provide a simple name that is saved into their profile metadata and published to the network. The modal MAY offer a secondary dismiss action while still reappearing on future logins as long as the profile remains empty.

#### Scenario: Empty profile triggers messaging-relay setup modal on login
- **GIVEN** the user successfully logs into nospeak and the ordered login history/sync flow has completed
- **AND** the cached profile for the current user has no configured messaging relays (no kind 10050 list and no mailbox relay list translated into messaging relays)
- **AND** the profile metadata does not contain a `name`, `display_name`, or `nip05` value
- **WHEN** the main messaging UI becomes active
- **THEN** a blocking modal overlay SHALL be shown informing the user that messaging relays and profile information need to be configured for this key
- **AND** the modal SHALL explain that nospeak will configure the default messaging relays (deployment-configurable; defaults: `wss://nostr.data.haus`, `wss://nos.lol`, `wss://relay.damus.io`) on their behalf, with the ability to change them later in Settings → Messaging Relays
- **AND** the modal SHALL require the user to enter a non-empty name before continuing
- **AND** upon confirmation, the client SHALL persist the default relays as the user's messaging relays, update the profile metadata with the provided name, and publish both a NIP-17 messaging relay list (kind 10050 with `relay` tags) and profile metadata (kind 0) to all known relays including the blaster relay (deployment-configurable; default: `wss://sendit.nosflare.com`)
- **AND** the modal SHALL be shown again on subsequent logins while the profile continues to have no messaging relays and no username-like metadata (for example, if the user dismisses the modal or later removes all relays and name from their profile).

### Requirement: Auto-Set Default Relays for Existing Users

When a user with existing profile metadata (username) but no configured messaging relays logs in or returns to the app, the system SHALL automatically configure the default messaging relays and notify the user via a non-blocking toast notification. This ensures existing users can send and receive messages without requiring manual relay configuration.

#### Scenario: Existing user without relays gets auto-configured on login
- **GIVEN** the user successfully logs into nospeak and the ordered login history/sync flow has completed
- **AND** the cached profile for the current user has no configured messaging relays
- **AND** the profile metadata contains a `name`, `display_name`, or `nip05` value (i.e., the user has a username)
- **WHEN** the empty profile check runs after login flow completion
- **THEN** the system SHALL automatically configure the default messaging relays (deployment-configurable; defaults: `wss://nostr.data.haus`, `wss://nos.lol`, `wss://relay.damus.io`)
- **AND** the system SHALL publish a NIP-17 messaging relay list (kind 10050 with `relay` tags) to all known relays including the blaster relay
- **AND** the system SHALL display a non-blocking toast notification informing the user that messaging relays have been configured
- **AND** the toast message SHALL indicate that the user can change the relays in Settings

#### Scenario: Existing user without relays gets auto-configured on app resume
- **GIVEN** the user is logged into nospeak
- **AND** the app returns from background (visibility changes to visible)
- **AND** the cached profile for the current user has no configured messaging relays
- **AND** the profile metadata contains a username-like value
- **WHEN** the visibility change handler runs
- **THEN** the system SHALL automatically configure the default messaging relays
- **AND** the system SHALL display the same toast notification as the login scenario

#### Scenario: Auto-relay notification is shown only once per session
- **GIVEN** the user has been auto-configured with default relays in the current session
- **WHEN** any subsequent check for missing relays occurs (login retry, app resume, etc.)
- **THEN** the system SHALL NOT display an additional toast notification
- **AND** the system SHALL NOT attempt to re-publish the relay list

#### Scenario: Auto-relay check does not affect new users
- **GIVEN** the user logs into nospeak
- **AND** the cached profile has no configured messaging relays
- **AND** the profile metadata does not contain a `name`, `display_name`, or `nip05` value
- **WHEN** the empty profile check runs
- **THEN** the system SHALL display the EmptyProfileModal as per the existing requirement
- **AND** the system SHALL NOT auto-configure relays or display a toast

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

#### Scenario: Android viewer supports pinch-zoom, pan, and double-tap reset
- **GIVEN** the user is running nospeak inside the Android Capacitor app shell
- **AND** the in-app image viewer is open for a particular image
- **WHEN** the user performs a two-finger pinch gesture on the image
- **THEN** the viewer SHALL adjust the zoom level smoothly within reasonable bounds without zooming the entire page or WebView
- **AND** when zoomed in, the user SHALL be able to pan the image within the viewer using a drag gesture.
- **WHEN** the user double-taps the image while the viewer is open
- **THEN** the viewer SHALL reset the zoom level and panning offsets so that the image returns to a fit-to-screen state.

### Requirement: Camera Capture for Message Media Upload
The message input area SHALL provide a camera capture option labeled "Take photo" in the media upload affordance on supported devices so that users can capture and send photos directly from the chat UI. Camera-captured photos SHALL be treated as image uploads that use the same Blossom upload behaviour defined by the Media Upload Support requirement, and the client SHALL resize captured photos client-side to a maximum dimension of 2048px (width or height) and encode them as JPEG before upload when feasible.

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
- **AND** the client SHALL encode the resized photo as a JPEG with reasonable quality before uploading it as an image using Blossom servers.

#### Scenario: Captured photo URL is inserted into message input
- **GIVEN** a captured photo has been successfully uploaded as an image using Blossom servers
- **WHEN** the upload completes successfully
- **THEN** the resulting media URL SHALL be inserted into the message input content using the same format as existing image uploads
- **AND** when the message is sent, the photo SHALL be rendered inline in the conversation according to existing media rendering rules.

#### Scenario: Camera capture failure is non-blocking
- **GIVEN** the user selects "Take photo" from the media upload dropdown
- **WHEN** camera access is denied, the capture is cancelled, or the capture operation fails
- **THEN** the system SHALL display a non-blocking error or informational message indicating that the photo could not be captured or uploaded
- **AND** the rest of the messaging input and sending behaviour SHALL remain usable.

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

### Requirement: NIP-25 Message Reactions for Encrypted DMs
The messaging experience SHALL support NIP-25 `kind 7` reactions for individual messages inside the existing NIP-17 encrypted direct message flow.

#### Scenario: Reaction Targeting using Rumor ID
- **GIVEN** a NIP-17 encrypted message (Kind 14 Rumor wrapped in Kind 1059 Gift Wrap)
- **WHEN** a user reacts to this message
- **THEN** the reaction event (Kind 7) SHALL reference the **Rumor ID** (the hash of the inner Kind 14 event) in its `e` tag, NOT the Gift Wrap ID.
- **AND** the system SHALL calculate this Rumor ID deterministically upon sending and receiving to ensure both parties share the same target ID.

#### Scenario: Storing Rumor ID
- **WHEN** a message is saved to the local database (whether sent or received)
- **THEN** the system SHALL calculate the hash of the inner Rumor event and store it as `rumorId`.
- **AND** the UI SHALL use this `rumorId` to associate and display reactions.

### Requirement: Message Interaction Menu Shows Standard Reactions
The message interaction menu for each chat message SHALL expose a fixed set of standard reactions: thumb up, thumb down, heart, and laugh. The interaction menu SHALL be accessible via context menu or long-press interactions on a message bubble, SHALL clearly present these reaction options with touch-friendly targets, and SHALL invoke the NIP-25 reaction send path when a reaction is chosen.

#### Scenario: Desktop user opens interaction menu and chooses a reaction
- **GIVEN** the user is viewing a one-to-one conversation on a desktop or laptop device
- **WHEN** the user right-clicks or otherwise invokes the context menu on a message bubble
- **THEN** the message interaction menu SHALL appear near the pointer and display the thumb up, thumb down, heart, and laugh reactions as selectable options
- **AND** when the user selects one of these reactions, the client SHALL call the NIP-25 reaction send path for that message and close the interaction menu.

#### Scenario: Mobile user long-presses a message to react
- **GIVEN** the user is viewing a one-to-one conversation on a touch device
- **WHEN** the user long-presses a message bubble for at least a short threshold duration
- **THEN** the message interaction menu SHALL appear anchored to that bubble and display the thumb up, thumb down, heart, and laugh reactions as selectable options
- **AND** when the user taps one of these reactions, the client SHALL send the corresponding NIP-25 reaction for that message and dismiss the menu.

### Requirement: Reactions Render Under Messages with Viewport-Aware Hydration
The messaging interface SHALL render reactions as aggregated emoji chips directly under the corresponding message bubble and SHALL only hydrate and render reaction summaries for messages that are currently within the visible scroll viewport. For each message, the client SHALL group reactions by emoji, display a count when more than one participant has used the same emoji, and visually distinguish emojis that include at least one reaction from the current user.

#### Scenario: Reactions appear as chips under a visible message
- **GIVEN** a message in a one-to-one conversation has at least one stored reaction associated with its DM gift-wrap event id
- **AND** that message bubble is currently visible within the scroll viewport of the conversation
- **WHEN** the message list is rendered
- **THEN** the UI SHALL display a compact row of emoji chips directly under the message content representing each distinct reaction emoji
- **AND** each chip SHALL show the emoji and, when more than one reaction exists for that emoji, a numeric count.

#### Scenario: Current user’s reactions are visually highlighted
- **GIVEN** the current user has reacted to a particular message with one or more emojis
- **AND** the message bubble is visible within the scroll viewport
- **WHEN** the reaction chips are rendered under that message
- **THEN** any chip that includes at least one reaction from the current user SHALL be visually distinguished from chips with only the other participant’s reactions (for example, by a different border or background intensity).

#### Scenario: Reaction hydration is limited to messages in the viewport
- **GIVEN** a conversation with a long message history that includes many messages with stored reactions
- **WHEN** the user scrolls the message list so that only a subset of messages are within the visible viewport
- **THEN** the client SHALL only query, aggregate, and subscribe to reaction data for message bubbles that are currently within or entering the viewport
- **AND** SHALL avoid performing reaction aggregation work for messages that are scrolled far above or below the current view, while still preserving stored reaction data for those messages.

### Requirement: NIP-17 Kind 15 File Messages
The messaging experience SHALL represent binary attachments (such as images, videos, and audio files) sent over encrypted direct messages as unsigned NIP-17 file message rumors using Kind 15, sealed and gift-wrapped via the existing NIP-59 DM pipeline. Each file message SHALL carry enough metadata in its tags to describe the media type, basic size information, content hashes, and visual metadata (dimensions and blurhash placeholder), and SHALL reference an HTTPS URL where the encrypted file bytes can be fetched.

#### Scenario: Sending a file as a NIP-17 Kind 15 DM
- **GIVEN** the user is composing a one-to-one encrypted conversation and chooses an image, video, or audio file from the media upload affordance
- **WHEN** the client prepares the DM payload for this attachment
- **THEN** it SHALL construct an **unsigned** Kind 15 rumor whose tags include at minimum:
  - a `p` tag for the recipient pubkey
  - a `file-type` tag containing the original MIME type (for example, `image/jpeg`, `video/mp4`, or `audio/mpeg`)
  - an `x` tag containing the SHA-256 hash of the uploaded file bytes (encrypted or plaintext)
  - a `size` tag indicating the file size in bytes
- **AND** the rumor `.content` SHALL be set to the HTTPS URL returned from the Blossom upload.

#### Scenario: Sending an image or video includes dim and blurhash tags
- **GIVEN** the user is composing a one-to-one or group encrypted conversation and chooses an image or video file from the media upload affordance
- **WHEN** the client extracts the media dimensions and computes a blurhash before constructing the Kind 15 rumor
- **THEN** the Kind 15 rumor tags SHALL include a `dim` tag in the NIP-94 format `<width>x<height>` representing the pixel dimensions of the original media
- **AND** the Kind 15 rumor tags SHALL include a `blurhash` tag containing the blurhash-encoded placeholder string computed from the image pixels or video first frame
- **AND** for videos, the blurhash SHALL be computed from the first frame of the video file.

#### Scenario: Dimension and blurhash extraction failure does not block send
- **GIVEN** the user is sending an image or video file
- **WHEN** dimension extraction or blurhash computation fails (for example, due to an unsupported codec or canvas restriction)
- **THEN** the client SHALL still send the Kind 15 file message without `dim` and `blurhash` tags
- **AND** the send operation SHALL NOT be blocked or produce a user-visible error for metadata extraction failure.

#### Scenario: Receiving and displaying a NIP-17 Kind 15 DM
- **GIVEN** the messaging service unwraps a NIP-59 gift-wrap whose inner rumor is Kind 15
- **WHEN** the tags include a `p` tag for the current user and a `file-type` tag describing the media type
- **THEN** the system SHALL persist a message record that captures at least the file URL, MIME type, basic size/hash information, and any `dim` and `blurhash` tag values from the rumor tags
- **AND** the conversation UI SHALL render this record as a file attachment bubble that uses the MIME type to decide whether to show an inline image, video player, or audio player, consistent with the existing Media Upload Support behavior.

#### Scenario: Receiving dim and blurhash tags from Kind 15 messages
- **GIVEN** the messaging service unwraps a Kind 15 file message rumor
- **WHEN** the rumor tags include a `dim` tag in the format `<width>x<height>`
- **THEN** the system SHALL parse the width and height as integers and store them in the message record as `fileWidth` and `fileHeight`
- **AND** when the rumor tags include a `blurhash` tag, the system SHALL store the blurhash string in the message record as `fileBlurhash`.

#### Scenario: Fallback when a client only supports Kind 14 text messages
- **GIVEN** a remote client sends media by embedding a bare HTTP(S) URL in a Kind 14 chat message instead of using Kind 15
- **WHEN** nospeak receives and unwraps this message
- **THEN** the system SHALL continue to treat the message as a text chat bubble with media URL detection as defined in existing messaging requirements
- **AND** this behavior SHALL remain supported even after nospeak starts sending attachments using Kind 15 for its own clients.

#### Scenario: Optional caption sent via alt tag in Kind 15 message
- **GIVEN** the user has entered non-empty caption text while preparing a file attachment in the media preview for a NIP-17 conversation
- **WHEN** the messaging service sends the Kind 15 file message rumor and corresponding gift-wrap for that attachment
- **THEN** the Kind 15 message SHALL include an `alt` tag (NIP-31) whose value is the caption text
- **AND** no separate Kind 14 caption message SHALL be sent
- **AND** the conversation UI SHALL present the file attachment bubble and caption text as a single visual message unit by rendering the caption text directly below the file preview inside the same bubble.

#### Scenario: Kind 15 tags include MIME type, size, and hash
- **WHEN** nospeak sends a Kind 15 file message rumor for any attachment
- **THEN** it SHALL include:
  - `file-type` with the MIME type of the original, unencrypted file
  - `size` with the byte length of the encrypted file blob that will be uploaded (matching what is served at the content URL)
  - `x` with the SHA-256 hex-encoded hash of the encrypted file blob
  - `encryption-algorithm` with the value `aes-gcm`
  - `decryption-key` carrying the serialized AES-GCM key material needed to decrypt the blob
  - `decryption-nonce` carrying the serialized AES-GCM nonce associated with this blob
- **AND** when nospeak receives Kind 15 file messages from other clients that do not include these encryption tags, it SHALL still attempt to render the attachment based on the available URL and MIME metadata without attempting decryption.

#### Scenario: Kind 15 messages are stored distinctly from text rumors
- **WHEN** a Kind 15 file message is persisted in the local database
- **THEN** the stored message record SHALL identify that the underlying rumor kind is 15 and SHALL preserve file metadata (such as MIME type, URL, dimensions, and blurhash) separately from any freeform text content
- **AND** the UI and history views SHALL be able to distinguish between text-only messages (Kind 14) and file messages (Kind 15) even when both appear in the same conversation.

#### Scenario: Caption extraction from alt tag for received Kind 15 messages
- **GIVEN** a NIP-17 conversation history that contains a Kind 15 file message `F`
- **WHEN** `F` includes an `alt` tag (NIP-31) with a non-empty value
- **THEN** the conversation UI SHALL extract the `alt` tag value and render it as the caption text directly below the file preview inside the same message bubble
- **AND** when the `alt` tag is absent or empty, no caption SHALL be displayed for that file message.

### Requirement: File Message Metadata for Interoperability
The messaging implementation for Kind 15 file messages SHALL standardize on a minimal tag set so that other NIP-17 clients can reliably interpret nospeak file DMs without needing to understand internal upload semantics. For image and video attachments, the tag set SHALL additionally include NIP-94 compatible `dim` and `blurhash` tags to enable receiving clients to pre-render media placeholders.

#### Scenario: Kind 15 tags include MIME type, size, and hash
- **WHEN** nospeak sends a Kind 15 file message rumor for any attachment
- **THEN** it SHALL include:
  - `file-type` with the MIME type of the original, unencrypted file
  - `size` with the byte length of the encrypted file blob that will be uploaded (matching what is served at the content URL)
  - `x` with the SHA-256 hex-encoded hash of the encrypted file blob
  - `encryption-algorithm` with the value `aes-gcm`
  - `decryption-key` carrying the hex-encoded AES-GCM key material (64 hex characters for AES-256, 32 hex characters for AES-128) needed to decrypt the blob
  - `decryption-nonce` carrying the hex-encoded 16-byte AES-GCM nonce (32 hex characters) associated with this blob
- **AND** when nospeak receives Kind 15 file messages from other clients that do not include these encryption tags, it SHALL still attempt to render the attachment based on the available URL and MIME metadata without attempting decryption.

#### Scenario: Kind 15 tags include dim and blurhash for images and videos
- **WHEN** nospeak sends a Kind 15 file message rumor for an image or video attachment
- **AND** the client has successfully extracted dimensions and computed a blurhash
- **THEN** it SHALL include:
  - `dim` with the value `<width>x<height>` representing the pixel dimensions of the original media (for example, `1920x1080`)
  - `blurhash` with the blurhash-encoded placeholder string (for example, `LEHV6nWB2yk8pyo0adR*.7kCMdnj`)
- **AND** audio attachments SHALL NOT include `dim` or `blurhash` tags.

#### Scenario: Decryption accepts hex or base64url encoded keys and nonces
- **WHEN** nospeak receives a Kind 15 file message with `decryption-key` and `decryption-nonce` tags
- **THEN** it SHALL auto-detect the encoding format by checking if the value is valid hex (only characters 0-9, a-f, A-F)
- **AND** if the value is valid hex, it SHALL decode using hex decoding
- **AND** if the value is not valid hex, it SHALL decode using base64url decoding
- **AND** it SHALL validate that the decoded key is either 16 bytes (AES-128) or 32 bytes (AES-256) and reject keys of other sizes with a descriptive error

#### Scenario: Encrypted file uploads use octet-stream content type
- **WHEN** nospeak uploads an encrypted file blob to a Blossom server
- **THEN** it SHALL set the content type to `application/octet-stream` regardless of the original file MIME type
- **AND** this ensures the resulting URL ends with `.bin` for consistency with other NIP-17 implementations

#### Scenario: Kind 15 messages are stored distinctly from text rumors
- **WHEN** a Kind 15 file message is persisted in the local database
- **THEN** the stored message record SHALL identify that the underlying rumor kind is 15 and SHALL preserve file metadata (such as MIME type, URL, dimensions, and blurhash) separately from any freeform text content
- **AND** the UI and history views SHALL be able to distinguish between text-only messages (Kind 14) and file messages (Kind 15) even when both appear in the same conversation.

### Requirement: Messaging Relays Discovery and Fallback
The messaging implementation SHALL treat NIP-17 kind 10050 events with `relay` tags as the primary source of messaging relays for both the current user and contacts, and SHALL fall back to NIP-65 kind 10002 mailbox relay lists only when no kind 10050 list exists for a given profile.

#### Scenario: Contact messaging relays resolved from kind 10050
- **GIVEN** the client resolves a contact's profile from relays
- **AND** at least one kind 10050 event with one or more `relay` tags is found for that profile
- **WHEN** the messaging layer derives the contact's messaging relays
- **THEN** it SHALL treat the URLs from the `relay` tags as the contact's messaging relays
- **AND** it SHALL use these URLs when choosing where to publish gift-wrapped DMs to that contact.

#### Scenario: Contact messaging relays resolved from kind 10002 when no 10050 exists
- **GIVEN** the client resolves a contact's profile from relays
- **AND** no kind 10050 messaging relay list is found for that profile
- **AND** at least one kind 10002 mailbox relay list is found
- **WHEN** the messaging layer derives the contact's messaging relays
- **THEN** it MAY interpret the NIP-65 relay list and derive a messaging relay set from it (for example, by combining read/write URLs)
- **AND** it SHALL use these URLs as the contact's messaging relays for DM routing.

### Requirement: DM Sending Uses Messaging Relays
The DM sending pipeline for Kind 14 text rumors, Kind 15 file rumors, and Kind 7 reactions SHALL route gift-wrapped events using messaging relays derived from NIP-17 kind 10050 or fallback NIP-65 lists, sending each recipient and self copy only to the corresponding user's own messaging relays.

#### Scenario: Sending a DM routes recipient gift-wrap to contact messaging relays
- **GIVEN** the user composes a new encrypted DM (Kind 14 rumor wrapped in Kind 1059 gift-wrap)
- **AND** the messaging layer has resolved the contact's messaging relays
- **AND** the messaging layer has resolved the current user's own messaging relays
- **WHEN** the client publishes the recipient gift-wrap for this DM
- **THEN** it SHALL enqueue and publish that gift-wrap only to the contact's messaging relays
- **AND** it SHALL NOT publish the recipient gift-wrap to relays that belong exclusively to the current user.

#### Scenario: Sending a DM routes self gift-wrap to user messaging relays
- **GIVEN** the same DM as above
- **WHEN** the client creates and publishes the self gift-wrap for the current user
- **THEN** it SHALL enqueue and publish that self gift-wrap only to the current user's messaging relays
- **AND** it SHALL NOT publish the self gift-wrap to relays that belong exclusively to the contact.

#### Scenario: Sending a DM fails when contact has no messaging relays
- **GIVEN** the user attempts to send an encrypted DM to a contact
- **AND** relay discovery cannot find any messaging relays for that contact from either kind 10050 or kind 10002 events
- **WHEN** the messaging pipeline prepares to send the message
- **THEN** it SHALL fail the send attempt
- **AND** the UI SHALL surface a clear, non-crashing error state indicating that the contact has no messaging relays configured and cannot receive NIP-17 DMs.

### Requirement: Profile Modal Shows Unified Messaging Relays
The profile modal in the messaging experience SHALL display a single "Messaging Relays" section for each profile instead of separate "Read Relays" and "Write Relays" sections, using the union of known relay URLs for that profile.

#### Scenario: Profile modal shows unified messaging relay list
- **GIVEN** a profile has one or more relay URLs discovered from either kind 10050 or kind 10002 events
- **WHEN** the user opens the profile modal for that contact or for themselves
- **THEN** the modal SHALL display a single "Messaging Relays" heading
- **AND** SHALL render a deduplicated list of relay URLs under that heading
- **AND** if no relay URLs are known, it SHALL instead display the existing "None" state for relays.

### Requirement: Message Media Preview Modal
The messaging interface SHALL present a media preview surface when the user selects a file attachment from the message input media menu, before any file or caption is sent to the conversation. The preview SHALL show the selected file, allow the user to optionally enter caption text, and SHALL offer explicit send and cancel controls. On desktop layouts the preview SHALL appear as a centered modal overlay; on mobile-sized layouts (including the Android app shell) it SHALL appear as a bottom sheet anchored to the bottom of the viewport.

#### Scenario: Media preview opens after selecting a file
- **WHEN** the user selects a valid image, video, or MP3 audio file from the media menu in the message input
- **THEN** the system SHALL open a blocking media preview surface (modal on desktop, bottom sheet on mobile) showing the selected file and an optional caption input
- **AND** no new messages SHALL be sent to the conversation until the user explicitly confirms sending in the preview.

#### Scenario: Preview send sends file and optional caption
- **GIVEN** the media preview is open with a selected file and an optional caption
- **WHEN** the user presses the primary Send action in the preview
- **THEN** the system SHALL send a NIP-17 Kind 15 file message for the selected attachment according to the Media Upload Support and NIP-17 Kind 15 File Messages requirements
- **AND** if the caption input is non-empty, the Kind 15 message SHALL include an `alt` tag (NIP-31) whose value is the caption text
- **AND** the media preview surface SHALL be dismissed after the send operation is initiated.

#### Scenario: Closing preview discards pending attachment
- **GIVEN** the media preview is open with a selected file and optional caption
- **WHEN** the user closes or cancels the preview without pressing Send
- **THEN** the system SHALL NOT send any Kind 15 or Kind 14 messages for that file or caption
- **AND** any existing draft text in the normal message input SHALL remain unchanged.

### Requirement: Reactions Drive Unread Indicators
Incoming NIP-25 `kind 7` reactions associated with NIP-17 encrypted direct messages SHALL be treated as conversation activity for the purposes of contact unread indicators, without being promoted to standalone chat message bubbles.

#### Scenario: New reaction from inactive contact shows unread indicator
- **GIVEN** the user is viewing the contact list
- **AND** the user is NOT currently viewing an open conversation with Contact A
- **AND** Contact A has at least one existing NIP-17 encrypted direct message with the user
- **WHEN** a new NIP-25 `kind 7` reaction from Contact A targeting one of these messages is received and processed
- **THEN** the system SHALL update Contact A's activity state so that the unread indicator (green dot) appears next to Contact A in the contact list
- **AND** this indicator SHALL remain until the user views Contact A's conversation and it is marked as read according to existing messaging requirements.

#### Scenario: Reaction from current conversation does not create unread indicator
- **GIVEN** the user is actively viewing an open conversation with Contact B
- **WHEN** a new NIP-25 `kind 7` reaction from Contact B targeting a message in that same conversation is received and processed
- **THEN** the system SHALL render the reaction under the target message as defined by existing reaction requirements
- **AND** it SHALL NOT create or leave a persistent unread indicator for Contact B once the conversation view has been refreshed.

### Requirement: Local Notifications for Message Reactions
When message notifications are enabled for the current device and the platform has granted notification permission, the messaging experience SHALL surface foreground notifications for newly received NIP-25 `kind 7` reactions on NIP-17 encrypted direct messages using the same channels, suppression rules, and navigation semantics as existing message notifications, while continuing to keep reactions out of the visible chat message list.

#### Scenario: Web browser shows notification for reaction in different or inactive conversation
- **GIVEN** the user is accessing nospeak in a supported web browser
- **AND** message notifications are enabled in Settings → General
- **AND** the browser has granted notification permission
- **AND** either the nospeak window is not the active, focused foreground tab or the user is currently viewing an open conversation with Contact A
- **WHEN** a new NIP-25 `kind 7` reaction addressed to the current user is received from Contact B (a different conversation) and processed by the messaging pipeline
- **THEN** the system SHALL display a browser notification indicating that Contact B reacted to the user's message (for example, including the sender name and reaction emoji when available)
- **AND** activating the notification SHALL keep or bring the nospeak window to the foreground and navigate to the conversation with Contact B.

#### Scenario: Android app does not raise reaction notifications from background service
- **GIVEN** the user is running nospeak inside the Android Capacitor app shell
- **AND** message notifications are enabled in Settings → General
- **AND** the Android OS has granted permission for local notifications
- **AND** Android background messaging is enabled and the native foreground service for background messaging is active
- **WHEN** a new NIP-25 `kind 7` reaction addressed to the current user is received while the app UI is not visible
- **THEN** the native foreground service SHALL NOT emit an Android OS notification for that reaction.

### Requirement: Background Messaging Covers Reaction Gift-Wrap Events
When running inside the Android Capacitor app shell with background messaging enabled, the Android-native foreground service responsible for background messaging SHALL handle gift-wrapped events whose inner rumor is a NIP-25 `kind 7` reaction without surfacing an Android OS notification preview for them.

#### Scenario: Background service suppresses reaction preview notifications for reaction gift-wrap
- **GIVEN** the user is logged in, has enabled background messaging in Settings → General, and is running inside the Android Capacitor app shell
- **AND** the native Android foreground service for background messaging is active and subscribed to NIP-17 DM gift-wrapped events addressed to the user
- **AND** message notifications are enabled and Android has granted local notification permission
- **WHEN** a gift-wrapped event is delivered from any configured read relay whose decrypted inner rumor is a NIP-25 `kind 7` reaction authored by another user
- **THEN** the native service SHALL NOT raise an Android OS notification for that reaction.

### Requirement: Sender Avatar Fallback for Messaging Notifications
When a message or reaction notification is shown for a specific sender, the system SHALL prefer showing the sender’s profile picture when available. When the sender has no profile picture, the system SHALL instead use a deterministic robohash avatar derived from the sender’s `npub` using the same seed logic as the in-app avatar fallback. The robohash base URL SHALL default to `https://robohash.org/` and MAY be overridden by deployment runtime configuration; the base URL MUST use `https://`. If the avatar cannot be resolved due to platform limitations or fetch failures, the system SHALL fall back to the branded nospeak icon while still showing the notification.

#### Scenario: Web notification uses sender profile picture when available
- **GIVEN** the user has granted notification permission and notifications are enabled in Settings
- **AND** Contact A has `metadata.picture` set to a non-empty URL
- **WHEN** a new message notification is shown for an incoming message from Contact A
- **THEN** the web/PWA notification icon uses Contact A’s `metadata.picture` URL.

#### Scenario: Web notification uses robohash avatar when profile picture missing
- **GIVEN** the user has granted notification permission and notifications are enabled in Settings
- **AND** Contact B has no profile picture (`metadata.picture` is missing or empty)
- **WHEN** a new message notification is shown for an incoming message from Contact B
- **THEN** the web/PWA notification icon uses the deterministic robohash avatar URL derived from Contact B’s `npub`.

#### Scenario: Android notification shows sender avatar as large icon
- **GIVEN** the user is running nospeak inside the Android Capacitor app shell
- **AND** message notifications are enabled in Settings → General
- **AND** the Android OS has granted permission for local notifications
- **WHEN** a new message notification is shown for an incoming message from Contact C
- **THEN** the Android notification uses the branded nospeak icon as the small status-bar icon
- **AND** it SHOULD show Contact C’s avatar as the large icon, using Contact C’s profile picture when available and otherwise using the deterministic robohash avatar.

#### Scenario: Android notifications still fire when sender avatar cannot be resolved
- **GIVEN** the user is running nospeak inside the Android Capacitor app shell
- **AND** message notifications are enabled in Settings → General
- **AND** the Android OS has granted permission for local notifications
- **AND** Contact D has no profile picture
- **AND** the robohash avatar cannot be fetched or stored (for example due to lack of network access)
- **WHEN** a new message notification is shown for an incoming message from Contact D
- **THEN** the Android OS notification is still shown
- **AND** it uses the branded nospeak icon assets required for Android notifications.

### Requirement: Message-Level Unread Markers
The system SHALL persist a per-user list of unseen message IDs per conversation and SHALL visually mark those messages when the user opens the conversation.

#### Scenario: Received message while not actively viewing conversation becomes unread
- **GIVEN** the user is authenticated
- **AND** Contact A is an existing contact or is auto-added as a contact upon message receipt
- **AND** the user is NOT actively viewing Contact A’s conversation (either not on `/chat/<ContactA>`, or the app is not visible, or the app does not have focus)
- **WHEN** a new direct message is received from Contact A
- **THEN** the system SHALL append the message’s event ID to Contact A’s unread message list in `localStorage`
- **AND** the unread list SHALL NOT include messages authored by the current user.

#### Scenario: Received message while actively viewing conversation is not persisted as unread
- **GIVEN** the user is authenticated
- **AND** the user is actively viewing Contact A’s conversation (`/chat/<ContactA>`)
- **AND** the app is visible and focused
- **WHEN** a new direct message is received from Contact A
- **THEN** the system SHALL NOT persist this message in the unread list in `localStorage`.

#### Scenario: Opening a conversation displays and clears unread markers
- **GIVEN** Contact A has one or more unread message IDs stored in `localStorage`
- **WHEN** the user opens Contact A’s conversation
- **THEN** the conversation UI SHALL render a subtle visual marker (left accent) for each unread message that is present in the currently rendered message list
- **AND** the system SHALL clear *all* unread entries for Contact A (messages and reactions) from `localStorage` after opening the conversation.

#### Scenario: Sending a message clears unread markers in that conversation
- **GIVEN** Contact A has unread entries in `localStorage`
- **WHEN** the user successfully sends a message to Contact A
- **THEN** the system SHALL clear *all* unread entries for Contact A (messages and reactions) from `localStorage`.

### Requirement: Unread Activity Includes Reactions
The system SHALL treat incoming reactions as unread activity for badge counts and per-conversation unread state.

#### Scenario: Received reaction while not actively viewing conversation becomes unread activity
- **GIVEN** the user is authenticated
- **AND** the user is NOT actively viewing Contact A’s conversation (either not on `/chat/<ContactA>`, or the app is not visible, or the app does not have focus)
- **WHEN** a new reaction event is received from Contact A
- **THEN** the system SHALL append the reaction event ID to Contact A’s unread reaction list in `localStorage`
- **AND** each reaction event SHALL count as a distinct unread item.

#### Scenario: Opening conversation clears unread activity
- **GIVEN** Contact A has one or more unread reaction event IDs stored in `localStorage`
- **WHEN** the user opens Contact A’s conversation
- **THEN** the system SHALL clear Contact A’s unread reaction entries from `localStorage`.

### Requirement: First-Time Sync Does Not Create Unread Markers
The system SHALL NOT create unread markers from the first-time history sync when the local message cache is empty.

#### Scenario: First-time sync does not generate unread lists
- **GIVEN** the user logs in for the first time with an empty local message cache
- **WHEN** the application fetches historical messages from relays as part of first-time sync
- **THEN** the system SHALL NOT add any of those historical messages to the unread lists in `localStorage`.

### Requirement: PWA App Badge Reflects Unread Count
When supported, the system SHALL set the PWA app badge count to the total number of unread message IDs and unread reaction event IDs across all conversations.

#### Scenario: Badge updates when unread count changes
- **GIVEN** the browser supports the Badging API
- **WHEN** the total unread count changes due to a new unread message or reaction being recorded
- **THEN** the system SHALL call `navigator.setAppBadge(<totalUnread>)` with the updated total.

#### Scenario: Badge cleared when unread count reaches zero
- **GIVEN** the browser supports the Badging API
- **WHEN** the total unread count reaches zero
- **THEN** the system SHOULD clear the badge via `navigator.clearAppBadge()` when available.

### Requirement: Ephemeral Highlight for New Messages While Active
The system SHALL support applying an ephemeral left-accent marker to newly received messages while the user is actively viewing the conversation, without persisting them as unread.

#### Scenario: New message highlight is ephemeral
- **GIVEN** the user is actively viewing Contact A’s conversation (`/chat/<ContactA>`) and the app is visible and focused
- **WHEN** a new message is received from Contact A
- **THEN** the UI MAY highlight that message with the left-accent marker
- **AND** the system SHALL NOT write this message to the unread list in `localStorage`
- **AND** the highlight SHALL be cleared when the app loses focus, becomes hidden, or the user sends a message in that conversation.

### Requirement: Optimistic Outgoing Message Rendering
The messaging UI SHALL render a newly submitted outgoing message immediately in the conversation view, without waiting for local persistence or relay publishing to complete.

#### Scenario: Text message appears immediately with sending status
- **GIVEN** the user is viewing an encrypted DM conversation
- **WHEN** the user submits a text message
- **THEN** the message SHALL appear immediately in the chat as an outgoing bubble
- **AND** the message input SHALL be cleared immediately
- **AND** the latest outgoing message bubble SHALL display a `sending...` status until delivery is confirmed

#### Scenario: Media message appears immediately after confirmation
- **GIVEN** the user is viewing an encrypted DM conversation
- **AND** the user has opened the media preview with a selected attachment
- **WHEN** the user confirms sending the attachment
- **THEN** the conversation SHALL immediately display an outgoing attachment bubble
- **AND** the latest outgoing message bubble SHALL display a `sending...` status until delivery is confirmed

#### Scenario: Only the latest outgoing message shows status
- **GIVEN** the conversation contains multiple outgoing messages
- **WHEN** the UI renders delivery status text
- **THEN** it SHALL display the status text only for the latest outgoing message

### Requirement: Relay Publish Confirmation Window
For outgoing encrypted DMs, the system SHALL confirm delivery based on recipient relay publish acknowledgements observed within a bounded confirmation window.

#### Scenario: Delivery is confirmed when any recipient relay acknowledges within 5 seconds
- **GIVEN** the user submits an outgoing encrypted DM
- **AND** the system determines a list of recipient messaging relays for that contact
- **WHEN** the client attempts to publish the recipient gift-wrap to those recipient relays
- **THEN** the send attempt SHALL be considered successful if at least one recipient relay acknowledges the publish within 5 seconds
- **AND** the UI SHALL update the latest outgoing message to show `sent to x/x relays` after the first successful acknowledgement

#### Scenario: Delivery fails when no recipient relay acknowledges within 5 seconds
- **GIVEN** the user submits an outgoing encrypted DM
- **AND** the system determines a list of recipient messaging relays for that contact
- **WHEN** the client attempts to publish the recipient gift-wrap to those recipient relays
- **AND** no recipient relay acknowledges the publish within 5 seconds
- **THEN** the UI SHALL remove the optimistic message bubble from the conversation
- **AND** the UI SHALL display an error message indicating that sending failed

#### Scenario: Text send failure restores the draft input
- **GIVEN** the user submits a text message
- **WHEN** the send attempt fails due to no recipient relay acknowledgement within 5 seconds
- **THEN** the system SHALL restore the message text into the input field

#### Scenario: Media send failure restores the media preview
- **GIVEN** the user confirms sending an attachment from the media preview
- **WHEN** the send attempt fails due to no recipient relay acknowledgement within 5 seconds
- **THEN** the system SHALL restore the media preview state including the selected file and any caption input

### Requirement: NIP-42 Authentication for Messaging Reads and Writes
The messaging stack SHALL support NIP-42 relay authentication for both reads (subscriptions) and writes (publishing events) when interacting with messaging relays.

- The system SHALL only authenticate when required by a relay, as indicated by either a relay `AUTH` challenge or an `auth-required:` rejection.
- When authentication is required and a signer is available, the system SHALL authenticate and then retry the original operation exactly once.
- When authentication is required but no signer is available, the system SHALL treat the relay as auth failed (see `relay-management` auth visibility requirements) and the affected messaging operation SHALL proceed according to existing failure semantics (for example, DM sending fails when no recipient relay acknowledges within the confirmation window).

#### Scenario: Subscription recovers after relay closes with auth-required
- **GIVEN** the user is logged in and the real-time gift-wrap subscription is active
- **AND** a connected relay requires NIP-42 authentication to serve DM subscriptions
- **WHEN** the relay closes the subscription with an `auth-required:` reason
- **THEN** the client SHALL authenticate to that relay using NIP-42
- **AND** SHALL re-open the subscription exactly once after authentication succeeds
- **AND** upon success, subsequent gift-wrap events delivered on that relay SHALL be processed normally.

#### Scenario: DM publish succeeds after auth-required challenge
- **GIVEN** the user submits an outgoing encrypted DM gift-wrap
- **AND** at least one recipient messaging relay requires NIP-42 authentication for accepting publishes
- **WHEN** the client attempts to publish the gift-wrap to that relay
- **AND** the relay rejects the publish with an `auth-required:` reason
- **THEN** the client SHALL authenticate using NIP-42 and retry the publish once
- **AND** if the relay acknowledges the publish after the retry within the existing confirmation window, the send attempt SHALL be treated as successful.

#### Scenario: DM send fails when all recipient relays require auth and signer is missing
- **GIVEN** the user submits an outgoing encrypted DM gift-wrap
- **AND** all recipient messaging relays require NIP-42 authentication
- **AND** the session has no signer available
- **WHEN** the client attempts to publish the gift-wrap to the recipient relays
- **THEN** the client SHALL mark auth as failed for those relays with `lastAuthError="Missing signer"`
- **AND** the send attempt SHALL fail according to existing DM delivery confirmation requirements.

### Requirement: Chat History Search
The messaging UI SHALL provide a chat-history search control for an active conversation that filters locally stored (IndexedDB) messages as the user types.

#### Scenario: Search control placement and toggle
- **GIVEN** the user is viewing a 1:1 conversation chat
- **WHEN** the user views the chat header
- **THEN** a search (magnifying-glass) icon SHALL be visible on the right side of the chat top bar
- **WHEN** the user clicks the search icon
- **THEN** a search input SHALL slide out from the right side of the header and expand to the left

#### Scenario: Escape closes search and clears query
- **GIVEN** the user has the chat search input open
- **AND** the search query is non-empty
- **WHEN** the user presses Escape
- **THEN** the search UI SHALL close
- **AND** the search query SHALL be cleared
- **AND** the chat view SHALL return to the default (non-filtered) message timeline

#### Scenario: Find-as-you-type filters IndexedDB messages
- **GIVEN** the user has the chat search input open
- **WHEN** the user types a search query
- **THEN** the message list SHALL update as the user types (debounced)
- **AND** the message list SHALL include only messages whose message/caption text contains the query substring
- **AND** the filtering SHALL use messages stored locally in IndexedDB for that conversation
- **AND** the filtering SHALL be case-insensitive

#### Scenario: Caption match displays file bubble and caption
- **GIVEN** a conversation contains a file message with a caption stored via `alt` tag
- **WHEN** the user's search query matches the caption text
- **THEN** the results SHALL display the file message bubble
- **AND** SHALL display the caption as part of the same visual message unit (under the file bubble)

#### Scenario: Matching text is highlighted
- **GIVEN** the message list is filtered by a non-empty search query
- **WHEN** a rendered message or caption contains a matching substring
- **THEN** the UI SHALL visually highlight the matching substring within the message bubble and caption

#### Scenario: Search is not available in the aggregated chat view
- **GIVEN** the user is viewing the aggregated chat view (`partnerNpub === 'ALL'`)
- **WHEN** the user views the chat header
- **THEN** the chat-history search control SHALL NOT be shown

### Requirement: Android Conversation Notifications Use MessagingStyle
When running inside the Android Capacitor app shell with Android background messaging enabled, the native foreground service SHALL render per-conversation OS notifications using `NotificationCompat.MessagingStyle` so that notifications appear as message conversations in Android's notification UI.

Conversation notifications SHALL include exactly one message row representing the latest incoming conversation activity (for example a Kind 14 plaintext preview, `📍 Location` for Kind 14 location messages, `Message: Sent you an attachment` for Kind 15, or `Reaction: …` for Kind 7), and SHALL NOT aggregate multiple unseen items into a single prefixed string such as `N new items · ...`.

When cached sender identity data is available on the device, the native service SHOULD represent the sender using a `Person` whose name is derived from the cached username and whose icon is derived from the cached avatar bitmap on a best-effort basis. When cached identity data is not available, the notification SHALL fall back to the existing generic conversation titling behavior.

#### Scenario: Android conversation notification renders latest activity as MessagingStyle
- **GIVEN** the user is running nospeak inside the Android Capacitor app shell
- **AND** Android background messaging is enabled and the native foreground service for background messaging is active
- **AND** message notifications are enabled in Settings → General
- **AND** the Android OS has granted permission for local notifications
- **WHEN** the native service raises an Android OS notification for conversation activity from a contact while the app UI is not visible
- **THEN** the notification SHALL be rendered using `NotificationCompat.MessagingStyle`
- **AND** the notification SHALL include exactly one `MessagingStyle.Message` whose text is the latest conversation activity preview
- **AND** when cached sender identity is available, the sender `Person` SHOULD use the cached username and cached avatar as its icon on a best-effort basis
- **AND** activating the notification SHALL bring the nospeak Android app to the foreground and navigate to the conversation with that sender.

### Requirement: Heads-Up Defaults for Android Background DMs
When running inside the Android Capacitor app shell with background messaging enabled and active, the Android-native background messaging service SHALL configure its message notification channel so that new decrypted DM notifications are Heads-Up eligible by default.

#### Scenario: Message channel defaults allow Heads-Up notifications
- **GIVEN** the user is running nospeak inside the Android Capacitor app shell
- **AND** background messaging is enabled and the native Android foreground service for background messaging is active
- **WHEN** the Android notification channel used for background DM notifications is created
- **THEN** it SHALL use an importance level equivalent to `IMPORTANCE_HIGH`
- **AND** it SHALL enable sound and vibration by default
- **AND** it SHALL allow lockscreen content visibility (subject to user OS privacy settings).

### Requirement: Legacy nospeak internal media URLs render a placeholder
The messaging UI SHALL treat `https://nospeak.chat/api/user_media/...` URLs as deprecated internal-storage media links and SHALL NOT attempt to fetch or render them as media.

#### Scenario: Legacy internal media URL renders placeholder
- **GIVEN** a message contains a media URL whose origin is `https://nospeak.chat`
- **AND** the URL pathname starts with `/api/user_media/`
- **WHEN** the message is rendered in the conversation UI
- **THEN** the UI SHALL render a placeholder indicating the media is unavailable
- **AND** the UI SHALL NOT attempt to load or decrypt bytes from that URL.

### Requirement: Location Sharing via Encrypted DMs
The messaging system SHALL allow users to send their current GPS location to contacts as encrypted NIP-17 direct messages using Kind 14 rumors, and SHALL receive and display location messages sent by other nospeak clients. Location coordinates SHALL be transmitted as `geo:lat,lng` content format with supporting tags for interoperability. Location messages SHALL NOT expire and SHALL persist indefinitely in message history alongside text and file attachments.

#### Scenario: Sending a location message
- **GIVEN** a user is viewing an encrypted DM conversation with a contact
- **AND** location sharing is supported on their platform (Android with GPS or web with geolocation API)
- **AND** location permissions are granted
- **WHEN** the user selects "Location" from the media upload menu
- **THEN** the system SHALL fetch the current GPS coordinates `{ latitude, longitude }`
- **AND** the system SHALL present a preview modal showing an interactive OpenStreetMap view
- **WHEN** the user confirms "Send" in the preview modal
- **THEN** the system SHALL create a Kind 14 rumor with content `geo:52.5200,13.4050`
- **AND** the rumor SHALL include tags `['p', 'location']` where the location tag value is `52.5200,13.4050`
- **AND** the system SHALL gift-wrap and publish the rumor to the contact's messaging relays
- **AND** an optimistic location message SHALL appear immediately in the conversation view
- **AND** the message SHALL persist in IndexedDB with a `location` field containing `{ latitude: 52.5200, longitude: 13.4050 }`

#### Scenario: Receiving a location message
- **GIVEN** a contact sends a Kind 14 gift-wrapped message containing `geo:lat,lng` content and a `['location']` tag
- **WHEN** the messaging service receives and unwraps the gift-wrap
- **THEN** the system SHALL parse the coordinates from the location tag into `{ latitude, longitude }`
- **AND** the system SHALL store the message with the `location` field in IndexedDB
- **AND** the conversation UI SHALL render the message as a location preview

#### Scenario: Location message persists indefinitely
- **GIVEN** a location message has been sent or received and saved to the conversation history
- **WHEN** the user views the conversation later (hours, days, or weeks later)
- **THEN** the location message SHALL remain visible and accessible in the message list
- **AND** the system SHALL NOT automatically expire or remove location messages
- **AND** the location map SHALL remain visible inline in the message bubble

#### Scenario: Location appears alongside other message types
- **GIVEN** a conversation contains text messages, file attachments, reactions, and location messages
- **WHEN** the message list is rendered
- **THEN** location messages SHALL display consistently with text and file messages in chronological order
- **AND** the UI SHALL distinguish location messages with a location label and an inline map view
- **AND** users SHALL be able to react to, cite, and copy location messages using the same interaction menu as text and file messages

#### Scenario: Backward compatibility with location format
- **GIVEN** a remote nospeak client sends a location message
- **AND** the message content is `geo:lat,lng` and includes a `['location']` tag
- **WHEN** nospeak receives this message
- **THEN** the system SHALL interpret and display the location correctly
- **AND** if a remote client sends ONLY `geo:lat,lng` without a location tag, the system SHALL still render the location by parsing the geo URI from content
- **AND** if a remote client sends ONLY a location tag without geo URI content, the system SHALL still parse and render using the tag data

### Requirement: Location Preview Modal Before Sending
Before sending a location message, the messaging interface SHALL display an interactive OpenStreetMap iframe in a preview modal (reusing `AttachmentPreviewModal` with `mode="location"`) so the user can confirm the map content before sending. The modal SHALL support Cancel and Send actions and SHALL not send the location message until the user confirms Send.

#### Scenario: Selecting Location shows preview modal
- **GIVEN** a user is viewing an encrypted DM conversation with a contact
- **WHEN** the user selects "Location" from the media upload menu
- **THEN** the system SHALL fetch GPS coordinates
- **AND** the AttachmentPreviewModal SHALL open with `mode="location"`
- **AND** the modal SHALL display an interactive OpenStreetMap iframe centered on the fetched coordinates
- **AND** the iframe SHALL support pan and zoom interactions

#### Scenario: OpenStreetMap iframe renders at correct coordinates
- **GIVEN** the AttachmentPreviewModal is open with `mode="location"` and location `{ latitude: 52.5200, longitude: 13.4050 }`
- **WHEN** the modal renders the iframe
- **THEN** the iframe SHALL load OpenStreetMap with coordinates `52.5200, 13.4050`
- **AND** the map view SHALL show the correct geographic location
- **AND** a marker or pin SHALL be displayed at the coordinates (via OSM marker parameter if supported)

#### Scenario: Preview modal provides Cancel and Send
- **GIVEN** the AttachmentPreviewModal is open with `mode="location"` as a pre-send preview
- **WHEN** the modal content is rendered
- **THEN** the caption input field SHALL be hidden
- **AND** the modal SHALL show a Cancel button
- **AND** the modal SHALL show a Send confirmation button
- **AND** no file preview (image, video, audio) SHALL be shown
- **AND** choosing Cancel SHALL NOT send the location message
- **AND** choosing Send SHALL send the encrypted location message

#### Scenario: External link to full OpenStreetMap (optional)
- **GIVEN** the AttachmentPreviewModal is open with `mode="location"` at `{ latitude: 52.5200, longitude: 13.4050 }`
- **WHEN** the modal renders an OpenStreetMap external-link action
- **THEN** activating the link SHALL open `https://www.openstreetmap.org/?mlat=52.5200&mlon=13.4050&zoom=15` in a new browser tab

#### Scenario: Modal supports both media and location modes
- **GIVEN** the AttachmentPreviewModal is designed to support both media preview and location map
- **WHEN** opened with `mode="media"` after a user selects an image/video/audio attachment
- **THEN** the modal SHALL render the existing file preview interface with caption input and send/confirm buttons
- **WHEN** opened with `mode="location"` as a pre-send preview
- **THEN** the modal SHALL render the interactive OSM iframe
- **AND** the modal SHALL handle dismissal and user interactions consistently in both modes

### Requirement: Group Chat Message Identification
The system SHALL identify group chat messages by the presence of multiple `p` tags in the decrypted NIP-17 rumor. A message with two or more `p` tags SHALL be treated as a group message. The set of `p` tag pubkeys (including the sender) defines the conversation participants.

#### Scenario: Message with multiple p-tags identified as group
- **GIVEN** a gift-wrap event is received and decrypted
- **AND** the inner rumor contains two or more `p` tags
- **WHEN** the system processes the rumor
- **THEN** it SHALL be identified as a group chat message
- **AND** all pubkeys from `p` tags plus the sender pubkey SHALL be recorded as participants

#### Scenario: Message with single p-tag remains 1-on-1
- **GIVEN** a gift-wrap event is received and decrypted
- **AND** the inner rumor contains exactly one `p` tag
- **WHEN** the system processes the rumor
- **THEN** it SHALL be treated as a 1-on-1 direct message
- **AND** the existing `recipientNpub`-based conversation logic SHALL apply

### Requirement: Deterministic Conversation ID for Groups
The system SHALL derive a deterministic conversation ID for group chats using the SHA-256 hash of sorted participant pubkeys. The conversation ID SHALL be the first 16 hexadecimal characters of the hash. For 1-on-1 chats, the conversation ID SHALL remain the partner's npub for backward compatibility.

#### Scenario: Group conversation ID derived from participants
- **GIVEN** a group message involves participants with hex pubkeys `aaa...`, `bbb...`, and `ccc...`
- **WHEN** the system derives the conversation ID
- **THEN** it SHALL sort the pubkeys alphabetically
- **AND** concatenate them into a single string
- **AND** compute SHA-256 of the concatenated string
- **AND** use the first 16 characters of the hex-encoded hash as the conversation ID

#### Scenario: Same participants produce same conversation ID
- **GIVEN** two clients receive messages for the same group conversation
- **AND** both derive the conversation ID from the same set of participant pubkeys
- **WHEN** each client computes the conversation ID
- **THEN** both clients SHALL produce identical conversation IDs

#### Scenario: 1-on-1 conversation ID uses npub
- **GIVEN** a direct message between two users
- **WHEN** the system determines the conversation ID
- **THEN** it SHALL use the partner's npub as the conversation ID
- **AND** existing message queries by `recipientNpub` SHALL continue to work

### Requirement: Group Message Storage
The system SHALL store group messages with a `conversationId` field for efficient querying and a `participants` field containing the npubs of all conversation members. The existing `recipientNpub` field SHALL be populated with the first participant npub (excluding self) for backward compatibility with existing queries.

#### Scenario: Group message stored with conversation metadata
- **GIVEN** a group message is received or sent
- **WHEN** the system saves the message to the database
- **THEN** the `conversationId` field SHALL contain the derived group hash
- **AND** the `participants` field SHALL contain an array of all participant npubs
- **AND** the `recipientNpub` field SHALL contain the first non-self participant npub

#### Scenario: Group messages queryable by conversation ID
- **GIVEN** the user opens a group chat
- **WHEN** the system queries messages for display
- **THEN** it SHALL query by `conversationId` to retrieve all group messages
- **AND** messages SHALL be ordered by `sentAt` timestamp

### Requirement: Group Message Sending
The system SHALL support sending messages to group conversations by creating and publishing a gift-wrap to each participant using publishWithDeadline with the same deadline as 1-on-1 DMs. The rumor SHALL contain a `p` tag for each recipient. On first message to a new group, the rumor SHALL include a `subject` tag with the group title. Failed relay deliveries SHALL be enqueued to the retry queue after the publish deadline expires.

#### Scenario: Group message sent to all participants
- **GIVEN** the user composes a message in a group chat with participants Alice, Bob, and Carol
- **WHEN** the user sends the message
- **THEN** the system SHALL create a rumor with `p` tags for Alice, Bob, and Carol
- **AND** SHALL create a gift-wrap addressed to Alice and publish to Alice's messaging relays using publishWithDeadline
- **AND** SHALL create a gift-wrap addressed to Bob and publish to Bob's messaging relays using publishWithDeadline
- **AND** SHALL create a gift-wrap addressed to Carol and publish to Carol's messaging relays using publishWithDeadline
- **AND** SHALL create a self-wrap and publish to the sender's messaging relays
- **AND** any relay that fails within the publish deadline SHALL be enqueued to the retry queue

#### Scenario: First group message includes subject tag
- **GIVEN** the user creates a new group chat with title "Project Team"
- **WHEN** the user sends the first message
- **THEN** the rumor SHALL include a `subject` tag with value "Project Team"
- **AND** subsequent messages in the same conversation MAY omit the `subject` tag

### Requirement: Group Chat Conversation List Display
The chat list SHALL display group conversations with visual distinction from 1-on-1 chats. Group conversations SHALL show a stacked avatar of participants (up to 3 visible) and the group title or auto-generated participant names.

#### Scenario: Group chat shows stacked avatars
- **GIVEN** the user views the chat list
- **AND** a group conversation exists with participants Alice, Bob, and Carol
- **WHEN** the chat list renders the group entry
- **THEN** it SHALL display up to 3 participant avatars in a stacked/overlapping arrangement
- **AND** the primary display name SHALL be the group title if set, otherwise "Alice, Bob, Carol"

#### Scenario: Group title truncated for long participant lists
- **GIVEN** a group conversation has 5+ participants with no custom title
- **WHEN** the system generates the display name
- **THEN** it SHALL truncate to show first names plus "+N more" (e.g., "Alice, Bob, +3 more")
- **AND** the total display name SHALL not exceed 50 characters

### Requirement: Group Chat View Header
The chat view header for group conversations SHALL display the group title, participant count, and a tappable area to view the full participant list.

#### Scenario: Group chat header shows title and count
- **GIVEN** the user opens a group chat titled "Project Team" with 4 participants
- **WHEN** the chat view renders
- **THEN** the header SHALL display "Project Team"
- **AND** SHALL display "4 participants" or similar count indicator
- **AND** SHALL show a GroupAvatar component instead of single avatar

#### Scenario: Tapping header reveals participant list
- **GIVEN** the user is viewing a group chat
- **WHEN** the user taps on the chat header
- **THEN** a participant list view SHALL appear
- **AND** SHALL show each participant's avatar, name, and npub

### Requirement: Message Sender Attribution in Groups
In group chat conversations, each message bubble SHALL display the sender's name above the message content for messages from other participants. Messages sent by the current user SHALL not show sender attribution.

#### Scenario: Received group message shows sender name
- **GIVEN** the user is viewing a group chat
- **AND** a message was sent by participant Alice
- **WHEN** the message bubble renders
- **THEN** Alice's display name SHALL appear above the message content
- **AND** the name SHALL use a muted text style

#### Scenario: Own messages do not show sender name
- **GIVEN** the user is viewing a group chat
- **AND** a message was sent by the current user
- **WHEN** the message bubble renders
- **THEN** no sender name SHALL appear above the message content
- **AND** the message SHALL be styled as an outgoing message (right-aligned)

### Requirement: Group Chat Route Handling
The chat route SHALL accept both npub identifiers (for 1-on-1 chats) and conversation ID hashes (for group chats). The system SHALL detect the format and load the appropriate conversation.

#### Scenario: Route with npub loads 1-on-1 chat
- **GIVEN** the user navigates to `/chat/npub1abc...`
- **WHEN** the route handler processes the parameter
- **THEN** it SHALL detect the `npub1` prefix
- **AND** SHALL load the 1-on-1 conversation with that contact

#### Scenario: Route with hash loads group chat
- **GIVEN** the user navigates to `/chat/a1b2c3d4e5f67890`
- **AND** a group conversation exists with that conversation ID
- **WHEN** the route handler processes the parameter
- **THEN** it SHALL detect the non-npub format
- **AND** SHALL load the group conversation metadata and messages

### Requirement: Unified Message Send Pipeline
The messaging service SHALL use a single internal delivery pipeline for all outbound message types (Kind 14 text, Kind 15 file, Kind 7 reaction) across both 1-on-1 DM and group conversations. The pipeline SHALL handle authentication, messaging relay discovery, temporary relay connections, NIP-59 gift-wrap creation per recipient, publishing with deadline, retry queue enrollment for failed relays, self-wrap delivery, and local database persistence. Message type-specific logic (rumor construction, file encryption/upload) SHALL be performed by thin caller functions that delegate to the unified pipeline for delivery.

#### Scenario: Text DM uses unified pipeline
- **WHEN** the user sends a text message to a single recipient
- **THEN** the messaging service SHALL build a Kind 14 rumor with appropriate tags
- **AND** SHALL delegate to the unified send pipeline with a single-element recipient list
- **AND** the pipeline SHALL discover recipient and sender messaging relays, create gift-wraps, publish with deadline, and save to the local database

#### Scenario: Group file message uses unified pipeline with publishWithDeadline
- **WHEN** the user sends a file message in a group conversation
- **THEN** the messaging service SHALL encrypt the file, upload to Blossom, and build a Kind 15 rumor
- **AND** SHALL delegate to the unified send pipeline with the full participant list
- **AND** the pipeline SHALL use publishWithDeadline for each participant's gift-wrap (not retry-queue-only)
- **AND** failed relays SHALL be enqueued to the retry queue after the deadline attempt

#### Scenario: Reaction in group uses unified pipeline
- **WHEN** the user sends a reaction in a group conversation
- **THEN** the messaging service SHALL build a Kind 7 rumor with appropriate e-tag and p-tags
- **AND** SHALL delegate to the unified send pipeline with the full participant list
- **AND** the pipeline SHALL create per-recipient gift-wraps and publish using the same strategy as text and file messages

#### Scenario: Pipeline handles DM vs group post-send hooks
- **GIVEN** the unified pipeline has successfully published gift-wraps and saved the message to the database
- **WHEN** the recipient list contains exactly one entry (DM mode)
- **THEN** the pipeline SHALL call autoAddContact for the recipient
- **WHEN** the recipient list contains more than one entry (group mode)
- **THEN** the pipeline SHALL call markActivity on the conversation
- **AND** SHALL NOT call autoAddContact

### Requirement: Media Blurhash Placeholder Rendering
The messaging UI SHALL render a blurhash-decoded placeholder image with the correct aspect ratio for file message bubbles that contain `fileWidth`, `fileHeight`, and `fileBlurhash` metadata, so that the message list reserves the correct vertical space before the actual media loads and avoids layout shift.

#### Scenario: Blurhash placeholder shown while media loads
- **GIVEN** a file message record has `fileWidth`, `fileHeight`, and `fileBlurhash` values
- **WHEN** the message bubble is rendered in the conversation UI
- **THEN** the system SHALL render a container element with CSS `aspect-ratio` set to `fileWidth / fileHeight` and `max-height` of 300px
- **AND** the system SHALL decode the blurhash string to a 32x32 pixel buffer, render it to a canvas element inside the container, and CSS-scale the canvas to fill the container
- **AND** the blurhash canvas SHALL be visible until the actual media (image or video) finishes loading.

#### Scenario: Blurhash placeholder hidden after media loads
- **GIVEN** a file message bubble is displaying a blurhash placeholder
- **WHEN** the actual image fires its `load` event or the video fires its `loadeddata` event
- **THEN** the blurhash canvas SHALL be hidden or removed
- **AND** the real media element SHALL be displayed in the same container without changing the container dimensions.

#### Scenario: Media bubble without blurhash metadata renders without placeholder
- **GIVEN** a file message record does NOT have `fileBlurhash` or `fileWidth`/`fileHeight` values (for example, from another client that does not send these tags)
- **WHEN** the message bubble is rendered in the conversation UI
- **THEN** the system SHALL render the media element with the existing `max-w-full max-h-[300px]` styling without a blurhash placeholder
- **AND** layout shift MAY occur as the media loads, consistent with current behavior.

#### Scenario: Aspect-ratio container respects max-height constraint
- **GIVEN** a file message has dimensions where the computed height at full width exceeds 300px
- **WHEN** the blurhash container is rendered
- **THEN** the container height SHALL be capped at 300px
- **AND** the container width SHALL be proportionally reduced to maintain the correct aspect ratio.

