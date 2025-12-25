# android-app-shell Specification

## Purpose
TBD - created by archiving change add-android-local-notifications. Update Purpose after archive.
## Requirements
### Requirement: Android Local Notifications via Capacitor Plugin
The Android Capacitor app shell SHALL integrate with `@capacitor/local-notifications` (or an equivalent Capacitor local notifications plugin) to deliver OS-native notifications for new messages when notifications are enabled, aligning with the messaging notification requirements and existing branding constraints.

#### Scenario: Android app registers local notification channel
- **GIVEN** the nospeak Android app is installed and launched on a supported Android device
- **WHEN** the app initializes its Capacitor runtime and messaging environment
- **THEN** it SHALL register at least one notification channel dedicated to message notifications with an icon consistent with the messaging and visual-design specs
- **AND** this channel SHALL be used for all local notifications triggered for new messages.

#### Scenario: Permission request uses Android notification APIs during explicit login
- **GIVEN** the user is running nospeak inside the Android app shell
- **AND** notifications are enabled (including by default)
- **AND** Android local notification permission is not granted
- **WHEN** the user performs an explicit login action
- **THEN** the app SHALL request OS-level notification permission using the Android notification permission APIs exposed by the Capacitor local notifications plugin
- **AND** it SHALL handle denial or revocation gracefully by keeping the app functional and reflecting that notifications cannot be delivered.

#### Scenario: Permission request uses Android notification APIs when user re-enables notifications
- **GIVEN** the user is running nospeak inside the Android app shell
- **AND** notifications are currently disabled in Settings → General
- **WHEN** the user enables notifications in Settings → General
- **THEN** the app SHALL request OS-level permission for local notifications via the Capacitor local notifications plugin.

#### Scenario: Web behavior unchanged outside Android shell
- **GIVEN** the user is accessing nospeak in a standard web browser rather than the Android app shell
- **WHEN** notifications are enabled or disabled in Settings → General
- **THEN** no Capacitor local notifications plugin APIs SHALL be invoked
- **AND** notifications SHALL rely solely on the existing web mechanisms described in the messaging specification.

### Requirement: Android Capacitor App Shell
The project SHALL provide an Android application package that wraps the existing nospeak web client using Capacitor, bundles the compiled web assets locally, and launches directly into the chat experience without requiring an external browser. When running on supported Android versions, the app shell SHALL use edge-to-edge window insets and a StatusBar overlay configuration so that the web UI can manage safe areas via CSS instead of reserving a fixed-height status bar region.

#### Scenario: Android app launches bundled nospeak UI edge-to-edge
- **GIVEN** the nospeak Android app is installed on a supported Android device
- **WHEN** the user taps the nospeak app icon
- **THEN** the app SHALL open a Capacitor-powered WebView that loads the bundled nospeak web UI from local assets
- **AND** the content SHALL extend behind the Android system status bar using edge-to-edge window insets
- **AND** the web UI SHALL rely on safe-area insets (for example `env(safe-area-inset-top)` padding) to ensure headers and interactive elements are not obscured by the status bar.

#### Scenario: Status bar overlays WebView with theme-aware styling
- **GIVEN** the nospeak Android app is running in the foreground on a supported Android device
- **WHEN** the app initializes its shell and applies the active visual theme
- **THEN** it SHALL configure the Android status bar to overlay the WebView rather than reserving a fixed content inset
- **AND** it SHALL use the Capacitor `StatusBar` plugin (or equivalent) to set a background that is visually compatible with the glassmorphism design
- **AND** it SHALL choose a status bar icon style (light or dark) that maintains legible contrast against the current theme background.

#### Scenario: Web behavior unchanged outside Android shell
- **GIVEN** the user is accessing nospeak in a standard web browser rather than the Android Capacitor app shell
- **WHEN** the layout applies safe-area CSS utilities
- **THEN** the application SHALL NOT require Capacitor status bar APIs or native insets configuration to render correctly
- **AND** the top-level layout and modal overlays SHALL continue to render without extra Android-only padding, treating safe-area env variables as zero when not provided.

### Requirement: Android Build and Release Pipeline
The project SHALL define a documented build and release pipeline for the Android app that uses Capacitor tooling and the Android SDK to produce signed APK/AAB artifacts suitable for distribution.

#### Scenario: Android build command produces installable artifact
- **WHEN** a developer runs the documented Android build command from the repository root
- **THEN** the project SHALL produce an Android build (APK or AAB) that can be installed on an emulator or physical device
- **AND** the build SHALL embed the same nospeak web client version as the current production web build.

#### Scenario: Documented steps for signing and store upload
- **WHEN** a maintainer follows the documented signing and store-upload steps
- **THEN** they SHALL be able to generate a signed Android artifact
- **AND** SHALL be able to submit it to the chosen distribution channel (such as the Google Play Store) without requiring undocumented manual configuration changes.

### Requirement: Android Background Messaging Foreground Service
When running inside the Android Capacitor app shell with background messaging enabled, the native Android foreground service responsible for background messaging SHALL suppress Android OS notification floods caused by historical replay on initial enable and on service restarts.

The service SHALL implement a persisted notification baseline (cutoff) that determines the earliest eligible decrypted DM rumor timestamp that may generate an Android OS notification preview.

- The baseline SHALL be stored per Android installation.
- The baseline eligibility decision SHALL be based on the decrypted inner rumor timestamp (`created_at`) when available, rather than the outer gift-wrap event timestamp.
- The service SHALL apply a maximum backlog eligibility window of 15 minutes on service restarts.

#### Scenario: First enable does not notify historical messages
- **GIVEN** the user has just logged in and the web runtime explicitly enables Android background messaging
- **AND** the native Android foreground service starts and subscribes to gift-wrapped events for the user
- **WHEN** the relays deliver historical gift-wrap events that decrypt to DM rumors created before the moment background messaging was enabled
- **THEN** the service SHALL NOT emit Android OS notifications for those historical DMs
- **AND** it MAY still update internal dedupe state without notifying.

#### Scenario: Service restart caps backlog notifications to 15 minutes
- **GIVEN** the user previously enabled Android background messaging
- **AND** the native Android foreground service restarts due to device reboot, app update, or process restart
- **WHEN** the relays deliver gift-wrap events that decrypt to DM rumors
- **THEN** only rumors whose decrypted inner rumor timestamps fall within the last 15 minutes (relative to current device time) SHALL be eligible to trigger Android OS notifications
- **AND** older rumors SHALL be suppressed to avoid notification floods.

#### Scenario: Backdated gift-wrap timestamps do not break notifications
- **GIVEN** the relays deliver gift-wrap events whose outer `created_at` timestamps are randomized or backdated
- **AND** the gift-wrap decrypts to a valid DM rumor with an inner rumor timestamp
- **WHEN** the inner rumor timestamp indicates the message is within the eligible notification cutoff window
- **THEN** the service SHALL treat the message as eligible to notify even if the outer gift-wrap timestamp is older than the cutoff
- **AND** the service SHALL NOT rely on a strict outer `since now` filter that would exclude these deliveries.

### Requirement: Persistent Android Foreground Notification for Background Messaging
When Android background messaging is active, the Android app shell SHALL display a persistent foreground notification indicating that nospeak is connected to the user's read relays, including a summary of which relays are connected, and SHALL keep this notification visible as long as background messaging is running.

#### Scenario: Foreground notification shows connected relay summary
- **GIVEN** the Android foreground service for background messaging is running
- WHEN the foreground notification for nospeak is displayed in the Android notification shade
- THEN the notification SHALL indicate that nospeak is syncing messages in the background
- AND it SHALL display the list of connected read relay URLs (up to four entries corresponding to the user's configured read relays)
- AND it SHALL use nospeak branding and iconography consistent with the existing Android local notification and visual-design requirements.

#### Scenario: Foreground notification persists while background messaging is active
- **GIVEN** background messaging is enabled and the foreground service is running
- WHEN the user expands or collapses the Android notification shade
- THEN the notification entry for nospeak background messaging SHALL remain visible and non-dismissible by default while the foreground service is active
- AND the notification SHALL be removed when background messaging stops or is disabled by the user.

#### Scenario: Web behavior unchanged outside Android shell
- **GIVEN** the user is accessing nospeak in a standard web browser rather than the Android app shell
- WHEN they enable or disable message notifications or other messaging settings
- THEN no Android-specific foreground service or persistent notification SHALL be created
- AND notification behavior SHALL remain as defined by the existing web messaging specification.

### Requirement: Android URL Preview via Remote Server
When running inside the Android Capacitor app shell, the messaging experience SHALL treat URL previews for non-media HTTP(S) links as an optional enhancement backed by a remote server-side preview API, while keeping the main chat UI and core messaging behaviors available from locally bundled web assets.

#### Scenario: Android app shell uses remote preview API
- **GIVEN** the user is running nospeak inside the Android Capacitor app shell
- **AND** the app has loaded the chat UI from locally bundled web assets
- **AND** a visible message bubble contains at least one non-media HTTP(S) URL
- **WHEN** the system attempts to fetch URL preview metadata for that message
- **THEN** it SHALL call a remote server-side preview API endpoint (for example, the existing `/api/url-preview` route on the deployed SvelteKit instance) rather than relying on a local in-app implementation at the app's origin
- **AND** it SHALL apply the same viewport-based and single-request-per-message semantics defined by the `messaging` URL preview requirements
- **AND** it SHALL benefit from the same HTML entity decoding and expanded metadata detection behavior defined in the updated messaging URL preview requirements so that Android preview cards render correctly decoded titles, descriptions, and images when metadata is available.

#### Scenario: Android preview failure does not break messaging
- **GIVEN** the user is running nospeak inside the Android Capacitor app shell
- **AND** a visible message bubble contains at least one non-media HTTP(S) URL
- **WHEN** the remote server-side preview API is unavailable, slow, or returns incomplete metadata (including the case where only generic consent or cookie-wall content is visible)
- **THEN** the message text and its links SHALL still render and remain clickable
- **AND** the system MAY omit the URL preview card entirely without surfacing blocking or noisy error UI
- **AND** all other messaging features (including sending, receiving, history scrolling, and media rendering) SHALL continue to function according to the existing `messaging` specification.

#### Scenario: Android preview behavior respects global URL preview settings
- **GIVEN** the user has disabled URL previews via the global messaging settings
- **WHEN** the user views conversations inside the Android Capacitor app shell
- **THEN** the system SHALL NOT issue remote server-side preview API requests for non-media HTTP(S) URLs in messages
- **AND** the messages SHALL still render with clickable links and media behavior consistent with the `messaging` and `settings` specs.

#### Scenario: Android offline behavior simply omits previews
- **GIVEN** the user has previously opened the nospeak Android app and the web assets are bundled locally
- **AND** the device is currently offline or unable to reach the remote server-side preview API
- **WHEN** the user opens a conversation that includes messages with non-media HTTP(S) URLs
- **THEN** the app SHALL still load the main chat interface shell from local assets as defined by the existing Android Capacitor App Shell requirements
- **AND** the system SHALL treat URL previews as unavailable, rendering only the message text and clickable links without preview cards.

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

#### Scenario: Native share sheet for sharing images from in-app viewer
- **GIVEN** the user is running nospeak inside the Android Capacitor app
- **AND** the in-app image viewer for a message image is currently open as defined by the messaging specification
- **WHEN** the user invokes the viewer's share control for the active image
- **THEN** the app SHALL open the Android-native share sheet via Capacitor's Share plugin with the image URL or content as the share target
- **AND** SHALL fall back to a web-based share mechanism or no-op behavior when native sharing is not available or fails, without dismissing the viewer prematurely.

#### Scenario: Web behavior remains unchanged outside Android shell
- **GIVEN** the user is accessing nospeak via a standard web browser (not inside the Android Capacitor app)
- **WHEN** they perform actions that would use native dialogs on Android (media upload, confirmations, share)
- **THEN** the system SHALL continue to use the existing web-based modals, file pickers, and share mechanisms defined in the web implementation
- **AND** messaging semantics and acceptance criteria from existing `messaging` requirements SHALL continue to apply.

### Requirement: Android Native Camera Capture for Message Attachments
When running inside the Android Capacitor app shell, the messaging experience SHALL integrate a native camera capture flow for message attachments using a Capacitor-compatible camera plugin, while continuing to upload captured media via the configured upload backend selected in Settings → Media Servers.

#### Scenario: Android app uses native camera for "Take photo"
- **GIVEN** the user is running nospeak inside the Android Capacitor app shell
- **AND** the chat message input is visible
- **WHEN** the user opens the media upload dropdown and selects the "Take photo" option
- **THEN** the app SHALL invoke the native camera capture flow via a Capacitor camera plugin rather than relying solely on the WebView file input
- **AND** upon successful capture, SHALL obtain an image representation that can be processed by the web messaging client.

#### Scenario: Android app resizes and uploads captured photos via configured backend
- **GIVEN** the user has successfully captured a photo using the Android native camera flow from the chat media upload UI
- **WHEN** the app prepares the captured photo for upload
- **THEN** it SHALL resize the image client-side so that neither width nor height exceeds 2048px while preserving aspect ratio
- **AND** it SHALL encode the resized photo as JPEG with reasonable quality
- **AND** it SHALL upload the resulting image via the configured upload backend selected in Settings → Media Servers
- **AND** the resulting media URL SHALL be used by messaging according to the `messaging` specification.

#### Scenario: Android camera capture failure is non-blocking
- **GIVEN** the user selects the "Take photo" option from the media upload dropdown inside the Android app
- **WHEN** camera permissions are denied, the user cancels the capture, or the camera plugin returns an error
- **THEN** the app SHALL surface a non-blocking Android-native or in-app dialog message indicating that the capture or upload failed
- **AND** the messaging input, existing messages, and other media upload options (Image, Video) SHALL remain available and functional.

### Requirement: Android Background Messaging Connection Reliability
The Android Capacitor app shell background messaging implementation SHALL maintain durable WebSocket connections to user's configured read relays while native foreground service is running by using explicit heartbeat behavior and conservative reconnection logic.

The foreground service SHALL configure its WebSocket client with a periodic ping interval to keep NAT mappings alive and detect dead connections, SHALL track relay connections per URL, and SHALL schedule reconnection attempts with bounded exponential backoff when a relay connection closes or fails while background messaging remains enabled. Reconnection attempts SHALL stop when background messaging is disabled, user signs out, or foreground service is destroyed.

The foreground service SHALL use an adaptive heartbeat profile to reduce wakeups while device is locked:
- In **active profile**, service SHALL use a WebSocket ping interval of **120 seconds**.
- In **locked profile**, service SHALL use a WebSocket ping interval of **300 seconds**.

The locked profile SHALL be entered only after a **60 second grace period** following a screen-off event, and SHALL NOT be used while device is charging.

Energy profile changes SHALL NOT trigger WebSocket connection restarts. When energy profile changes, the service SHALL rebuild its `OkHttpClient` instance with the new ping interval, and new connections SHALL use the updated interval. Existing WebSocket connections SHALL remain active until they naturally disconnect and reconnect.

#### Scenario: Energy profile changes do not restart connections
- **GIVEN** user is running nospeak inside Android Capacitor app shell
- **AND** background messaging is enabled and native foreground service is active
- **AND** device transitions between active and locked profiles (for example, screen-off after grace period, screen-on, charging state change)
- **WHEN** energy profile evaluation determines a profile change
- **THEN** service SHALL NOT close or restart existing WebSocket connections to apply new ping interval
- **AND** it SHALL rebuild the `OkHttpClient` instance with the updated ping interval
- **AND** new connections created during reconnection attempts SHALL use the new ping interval.

#### Scenario: Screen-off grace period prevents immediate profile change
- **GIVEN** user is running nospeak inside Android Capacitor app shell
- **AND** background messaging is enabled and native foreground service is active
- **WHEN** device transitions to screen-off state
- **THEN** service SHALL remain in active profile for at least 60 seconds
- **AND** it SHALL NOT restart relay connections to switch ping intervals during this grace period.

#### Scenario: Locked profile uses longer ping interval when not charging
- **GIVEN** user is running nospeak inside Android Capacitor app shell
- **AND** background messaging is enabled and native foreground service is active
- **AND** device has been screen-off for more than 60 seconds
- **AND** device is not charging
- **WHEN** new WebSocket connections are established to relays during natural reconnection cycles
- **THEN** service SHALL use locked profile ping interval of 300 seconds for those connections.

#### Scenario: Charging forces active profile heartbeat behavior
- **GIVEN** user is running nospeak inside Android Capacitor app shell
- **AND** background messaging is enabled and native foreground service is active
- **AND** device is in a locked state
- **WHEN** device begins charging and profile evaluates to active
- **THEN** service SHALL rebuild `OkHttpClient` with active profile ping interval of 120 seconds
- **AND** new connections SHALL use the active profile ping interval
- **AND** existing connections SHALL remain active until they naturally disconnect.

#### Scenario: Unlock switches back to active profile
- **GIVEN** user is running nospeak inside Android Capacitor app shell
- **AND** background messaging is enabled and native foreground service is active
- **AND** device is in a locked state
- **WHEN** user unlocks device and OS indicates user is present
- **THEN** service SHALL evaluate and apply active profile without restarting existing connections
- **AND** new connections SHALL use active profile ping interval of 120 seconds.

### Requirement: Android Background Messaging Notification Health State
The Android Capacitor app shell foreground notification for background messaging SHALL reflect the current health of background relay connections instead of always claiming that nospeak is connected. While the native foreground service is running, the notification text SHALL indicate when at least one read relay connection is active, MAY indicate when the service is attempting to reconnect to relays after connection loss, and SHALL avoid implying an active connection when no relays are currently connected and no reconnection attempts are scheduled. When background messaging is enabled but there are zero configured read relays, the notification text SHALL indicate that no relays are configured (for example, "No read relays configured") rather than implying a disconnection from configured relays.

#### Scenario: Foreground notification shows connected state when relays are active
- **GIVEN** the Android foreground service for background messaging is running
- **AND** at least one WebSocket connection to a configured read relay is currently active
- **WHEN** the foreground notification is displayed in the Android notification shade
- **THEN** the notification SHALL indicate that nospeak is connected to read relays and MAY include a summary list of up to four connected read relay URLs, consistent with existing android-app-shell foreground notification requirements.

#### Scenario: Foreground notification reflects reconnecting state when all relays are down
- **GIVEN** the Android foreground service for background messaging is running
- **AND** all WebSocket connections to configured read relays are currently closed or have failed
- **AND** the service has scheduled one or more reconnection attempts using its backoff strategy
- **WHEN** the foreground notification is displayed in the Android notification shade
- **THEN** the notification SHALL indicate that nospeak is reconnecting to read relays or otherwise clearly communicate that it is attempting to restore connectivity rather than being fully connected.

#### Scenario: Foreground notification indicates no relays configured
- **GIVEN** the Android foreground service for background messaging is running
- **AND** the configured read relay URL list is empty
- **WHEN** the foreground notification is displayed in the Android notification shade
- **THEN** the notification text SHALL indicate that no relays are configured (for example, "No read relays configured")
- **AND** it SHALL NOT imply that the app is currently reconnecting or disconnected from configured relays.

#### Scenario: Foreground notification does not imply connection when background messaging is effectively disconnected
- **GIVEN** the Android foreground service for background messaging is running
- **AND** there are no active WebSocket connections to any configured read relays
- **AND** no reconnection attempts are currently scheduled (for example, because permissions were revoked or background messaging is in a stopped or error state)
- **WHEN** the foreground notification is displayed in the Android notification shade
- **THEN** the notification text SHALL avoid claiming that nospeak is connected to read relays
- **AND** it MAY indicate that background messaging is not currently connected so that users are not misled about connection state.

### Requirement: Android Back and Swipe Integration with Chat Shell
The Android Capacitor app shell SHALL integrate the Android system back action (including both hardware back button presses and OS-level back swipe gestures) with the nospeak chat shell so that back behaves consistently with Android UX expectations. When running inside the Android app shell, the system back action SHALL first dismiss full-screen overlays and global modals layered over the chat UI before performing route-level navigation or exiting the app.

#### Scenario: Android back closes global overlays before navigation
- **GIVEN** the user is running nospeak inside the Android Capacitor app shell
- **AND** a full-screen overlay such as the in-app image viewer is currently visible above the chat UI
- **WHEN** the user triggers the Android system back action (via hardware back button or OS back swipe)
- **THEN** the overlay SHALL be dismissed
- **AND** the underlying chat or contact list view SHALL remain visible
- **AND** no route-level navigation or app exit SHALL occur from this back action.

#### Scenario: Android back closes global modals before navigation
- **GIVEN** the user is running nospeak inside the Android Capacitor app shell
- **AND** a global modal such as Settings or Manage Contacts is currently open above the main chat or contact list interface
- **WHEN** the user triggers the Android system back action
- **THEN** the modal SHALL be closed
- **AND** the user SHALL remain on the same underlying screen (for example, the current chat conversation or the contact list)
- **AND** no additional navigation or app exit SHALL occur from this back action.

#### Scenario: Android back integrates with route-level navigation and app exit
- **GIVEN** the user is running nospeak inside the Android Capacitor app shell
- **AND** no full-screen overlays or global modals are currently open above the main UI
- **WHEN** the user triggers the Android system back action
- **THEN** the app shell SHALL delegate back handling to the web client according to the messaging and settings specifications (including navigation from chat detail to contact list when applicable)
- **AND** if the web client indicates there is no further in-app navigation possible (for example, at the root of the history stack)
- **THEN** the Android app shell MAY exit the application using the standard Android back semantics.

### Requirement: Android Native Haptics for Micro-Interactions
When running inside the Android Capacitor app shell, the messaging experience SHALL use the Capacitor Haptics plugin (for example, `@capacitor/haptics`) to provide soft, OS-native haptic feedback for selected micro-interactions using a minimal, intent-based API. The Android haptics API SHALL expose at least a light impact feedback for primary confirmations and a selection feedback for lightweight option changes, and all haptic calls SHALL remain non-blocking when haptics are unavailable.

#### Scenario: Light impact feedback on primary tap interactions
- **GIVEN** the user is running nospeak inside the Android Capacitor app shell on a supported Android device
- **AND** the user performs a primary tap interaction that is configured to trigger light impact feedback (for example, sending a message or opening a conversation)
- **WHEN** the tap interaction is handled by the web client
- **THEN** the Android shell SHALL invoke the Capacitor Haptics plugin to trigger a light-impact haptic effect via the intent-based API
- **AND** the haptic call SHALL be non-blocking and SHALL NOT prevent the underlying navigation or action from completing if the plugin is unavailable or fails.

#### Scenario: Selection feedback on lightweight option changes
- **GIVEN** the user is running nospeak inside the Android Capacitor app shell on a supported Android device
- **AND** the user changes a lightweight selection that is configured to trigger selection feedback (for example, changing tabs, toggling a setting, or selecting a contact in a list)
- **WHEN** the selection interaction is handled by the web client
- **THEN** the Android shell SHALL invoke the Capacitor Haptics plugin to trigger a subtle selection haptic effect via the intent-based API
- **AND** the haptic call SHALL be non-blocking and SHALL NOT prevent the underlying selection or navigation from completing if the plugin is unavailable or fails.

#### Scenario: Web behavior remains unchanged outside Android shell for haptics
- **GIVEN** the user is accessing nospeak via a standard web browser rather than the Android Capacitor app shell
- **WHEN** the user performs the same interactions that would normally trigger Android haptics (such as contact selection or chat navigation)
- **THEN** the system SHALL NOT require the Capacitor Haptics plugin to be present
- **AND** the absence of haptic feedback SHALL NOT block or degrade the primary interaction behavior, which SHALL continue to follow the existing messaging and visual-design requirements.

### Requirement: Android In-App Image Viewer Gestures
When running inside the Android Capacitor app shell, the in-app image viewer defined by the `messaging` specification SHALL support native-feeling pinch-zoom and panning interactions, plus a double-tap gesture to reset zoom, while preserving existing Android back behaviour for full-screen overlays.

#### Scenario: Pinch-zoom and pan in Android image viewer
- **GIVEN** the user is running nospeak inside the Android Capacitor app shell
- **AND** the in-app image viewer overlay is currently visible above the chat UI
- **WHEN** the user performs a two-finger pinch gesture on the image
- **THEN** the viewer SHALL change the image zoom level within reasonable minimum and maximum bounds without causing the entire WebView or page to zoom
- **AND** while the image is zoomed in, the user SHALL be able to drag to pan the image within the viewer without leaving the overlay.

#### Scenario: Double-tap resets Android image viewer zoom
- **GIVEN** the user is running nospeak inside the Android Capacitor app shell
- **AND** the in-app image viewer overlay is currently visible above the chat UI
- **AND** the image is currently zoomed or panned away from its initial fit-to-screen state
- **WHEN** the user double-taps the image inside the viewer
- **THEN** the viewer SHALL reset the zoom level and panning offsets so that the image returns to a fit-to-screen composition
- **AND** the viewer header controls and close behaviour SHALL remain unchanged.

#### Scenario: Web behaviour unchanged outside Android shell for image viewer gestures
- **GIVEN** the user is accessing nospeak in a standard web browser rather than the Android Capacitor app shell
- **WHEN** the in-app image viewer is opened for a message image
- **THEN** the platform SHALL continue to use the existing scroll-based panning and fit/full-size behaviour defined in the `messaging` specification
- **AND** no Android-specific pinch-zoom or double-tap reset semantics SHALL be required for web-only environments.

### Requirement: Android Bottom Sheet Swipe-to-Close Gesture
The Android Capacitor app shell SHALL support a swipe-down-to-close gesture for designated bottom sheet modals (including at least Settings and Manage Contacts) so that users can dismiss these sheets by dragging them downward from a defined drag area near the top of the sheet surface. The gesture SHALL be threshold-based, SHALL only apply when running inside the Android app shell, and SHALL not interfere with primary scrolling and tapping behavior inside the sheet content.

#### Scenario: Swipe-down closes Settings bottom sheet on Android
- **GIVEN** the user is running nospeak inside the Android Capacitor app shell
- **AND** the Settings experience is currently presented as a bottom sheet anchored to the bottom of the screen, as defined in the `settings` and `visual-design` specifications
- **WHEN** the user places a finger or pointer in the defined drag area near the top of the Settings bottom sheet and drags downward beyond a configured threshold distance
- **THEN** the Settings bottom sheet SHALL dismiss, triggering the same close behavior as tapping the header close control or using the Android system back action
- **AND** the drag SHALL not prevent normal vertical scrolling or tapping inside the Settings content area when the drag begins outside the defined drag area.

#### Scenario: Swipe-down closes Manage Contacts bottom sheet on Android
- **GIVEN** the user is running nospeak inside the Android Capacitor app shell
- **AND** the Manage Contacts modal is currently presented as a bottom sheet anchored to the bottom of the screen
- **WHEN** the user initiates a downward drag from the defined drag area at the top of the Manage Contacts bottom sheet and drags beyond the configured threshold distance
- **THEN** the Manage Contacts bottom sheet SHALL dismiss, triggering the same close behavior as tapping the close or back control in the header
- **AND** vertical scrolling within the contacts list or search results SHALL remain unaffected when the user scrolls from within the main content area instead of the drag area.

#### Scenario: Short drags cause Android bottom sheets to snap back
- **GIVEN** the user is running nospeak inside the Android Capacitor app shell
- **AND** a bottom sheet modal such as Settings or Manage Contacts is currently open
- **WHEN** the user initiates a drag from the defined drag area at the top of the sheet but releases it before reaching the configured threshold distance
- **THEN** the sheet SHALL animate back to its resting position without dismissing
- **AND** the sheet SHALL not enter an intermediate or partially translated state after the animation completes
- **AND** existing close mechanisms (tapping outside, header close button, Android system back) SHALL continue to operate as before.

#### Scenario: Web and PWA behavior unchanged outside Android shell
- **GIVEN** the user is accessing nospeak via a standard desktop or mobile web browser, not inside the Android Capacitor app shell
- **WHEN** they interact with Settings, Manage Contacts, or other modals that appear as centered dialogs or full-screen overlays
- **THEN** no Android-specific swipe-to-close behavior SHALL be required or implemented
- **AND** the modals SHALL continue to use their existing close controls and interactions as defined by the `visual-design` and `settings` specifications.

### Requirement: Android Amber Signer via NIP-55
When running inside the Android Capacitor app shell, the nospeak client SHALL integrate with NIP-55-compatible Android signer applications (such as Amber) to perform authentication and cryptographic operations for the "Login with Amber" flow. The Android app shell SHALL use the `nostrsigner:` Intent scheme described in NIP-55 to request the user's public key and initial permissions, SHALL persist the selected signer package name, and SHALL perform subsequent signing and encryption/decryption operations via the signer's NIP-55 ContentResolver endpoints when the signer has granted "remember my choice" for those permissions. The Android app shell SHALL NOT rely on relay-based NIP-46 / Nostr Connect sessions for Amber when running inside the app shell.

#### Scenario: Amber login uses NIP-55 intents on Android
- **GIVEN** the nospeak Android Capacitor app shell is installed on a supported device
- **AND** a NIP-55-compatible signer app such as Amber is installed
- **AND** the unauthenticated login screen is visible inside the Android app shell
- **WHEN** the user taps the "Login with Amber" button
- **THEN** the app SHALL launch the signer via a `nostrsigner:` Intent with `type = "get_public_key"` as described in NIP-55
- **AND** upon user approval, the app SHALL receive the user's public key and signer package name from the signer
- **AND** the app SHALL complete login for that key using the returned public key without establishing a NIP-46 / Nostr Connect session.

#### Scenario: Background signing prefers ContentResolver when permissions are remembered
- **GIVEN** the user previously completed Amber login in the Android app shell and granted "remember my choice" for signing and NIP-44 encryption/decryption operations
- **AND** the app has persisted the signer package name returned by the initial `get_public_key` call
- **WHEN** the nospeak Android app needs to sign an event or perform NIP-44 encryption or decryption on behalf of the current user while running inside the app shell
- **THEN** it SHALL first attempt to call the corresponding NIP-55 ContentResolver endpoint for the signer package (such as `SIGN_EVENT`, `NIP44_ENCRYPT`, or `NIP44_DECRYPT`)
- **AND** if the ContentResolver call returns a result without a `rejected` column, the app SHALL use that result without surfacing an additional signer UI
- **AND** if the ContentResolver call returns `null` or indicates `rejected`, the app MAY fall back to an interactive `nostrsigner:` Intent flow or surface a clear error according to the design of the NIP-55 plugin.

#### Scenario: NIP-46 is not used for Amber inside the Android app shell
- **GIVEN** the user is running nospeak inside the Android Capacitor app shell
- **AND** the current session uses Amber as an external signer for authentication and message signing
- **WHEN** the app performs login, signing, or encryption/decryption operations for this session
- **THEN** it SHALL use only the NIP-55 mechanisms (Intents and ContentResolver) to communicate with the signer
- **AND** it SHALL NOT construct `nostrconnect:` URIs, create bunker relay connections, or initiate NIP-46 / Nostr Connect sessions for Amber while running inside the Android app shell.

### Requirement: Android Decrypted Media Sharing from In-App Image Viewer
When running inside the Android Capacitor app shell, the in-app image viewer for message images SHALL share decrypted media content with other Android apps instead of sharing encrypted file URLs or WebView-only `blob:` URLs whenever the active image originates from an encrypted Kind 15 file message that has been decrypted in the WebView.

#### Scenario: Encrypted image is shared as decrypted media on Android
- **GIVEN** the user is running nospeak inside the Android Capacitor app shell
- **AND** the in-app image viewer overlay is open for an image that was delivered via a Kind 15 encrypted file DM and has been decrypted client-side for display
- **WHEN** the user invokes the viewer's share control for the active image
- **THEN** the Android shell SHALL open the native share sheet via a Capacitor-compatible Share plugin
- **AND** it SHALL provide the decrypted image content as the share target (for example, by passing a native-shareable file path or URI) rather than an encrypted download URL or WebView-only `blob:` URL
- **AND** if the native share sheet is unavailable or fails, the viewer SHALL fall back to the existing web-based share behavior or no-op without dismissing the viewer unexpectedly.

#### Scenario: Unencrypted image sharing behavior remains unchanged on Android
- **GIVEN** the user is running nospeak inside the Android Capacitor app shell
- **AND** the in-app image viewer overlay is open for an image that is not encrypted (for example, a plain HTTP(S) image URL in message content)
- **WHEN** the user invokes the viewer's share control for the active image
- **THEN** the app MAY continue to share that image using its direct URL or a native-shareable file consistent with the existing "Native share sheet for sharing images from in-app viewer" scenario
- **AND** this change to encrypted image behavior SHALL NOT regress the share experience for unencrypted images.

### Requirement: Android Decrypted Media Temporary File Lifecycle
When creating decrypted media artifacts on disk solely to support Android native sharing from the in-app image viewer, the Android app shell SHALL treat these files as temporary cache entries and SHALL ensure they are cleaned up on a best-effort basis so that decrypted media does not accumulate indefinitely in app storage.

#### Scenario: Decrypted share files are written to an app-private cache location
- **GIVEN** the user is running nospeak inside the Android Capacitor app shell
- **AND** the in-app image viewer prepares decrypted media for sharing by creating a file on disk
- **WHEN** the decrypted file is created
- **THEN** it SHALL be written to an app-private cache or temporary directory that is not exposed as durable user storage
- **AND** the file SHALL be named and stored in a way that does not conflict with primary message history or media assets.

#### Scenario: Decrypted share files are cleaned up over time
- **GIVEN** decrypted media files have been created in the app-private cache solely for the purpose of sharing from the in-app image viewer
- **WHEN** the Android app shell performs its next relevant maintenance opportunity (for example, on app startup, on viewer initialization, or during a periodic cleanup pass)
- **THEN** it SHALL attempt to delete any stale decrypted share files created by this feature
- **AND** this cleanup SHALL avoid interfering with primary message storage or media retrieval
- **AND** the implementation MAY rely on both explicit deletion and the platform's normal cache eviction behavior to keep decrypted share files from accumulating indefinitely.

### Requirement: Android inbound share target for media and text
When running inside the Android Capacitor app shell, the nospeak client SHALL appear as an Android share target for supported media (images, video, audio) and text/URLs, and SHALL route inbound shares into the existing direct message experience by requiring the user to pick a contact and then either opening the single-file media send preview with the shared media or pre-filling the message input with the shared text. Inbound shares received while the user is not logged in SHALL display a clear message that login is required and SHALL NOT retain the shared content for later use.

#### Scenario: Logged-in user shares media to nospeak
- **GIVEN** the nospeak Android app is installed and the user is currently logged in
- **AND** another Android app (such as a gallery, files app, or browser) offers an "Share" action for a single image, video, or audio file
- **WHEN** the user selects the nospeak app from the Android share sheet
- **THEN** the nospeak Android app shell SHALL open or be brought to the foreground
- **AND** it SHALL navigate to the contact list view (for example, the `/chat` contact list) rather than directly opening any existing conversation
- **AND** when the user selects a contact from the list, the messaging UI for that contact SHALL open the existing single-file media send preview with the shared media already loaded as the pending attachment
- **AND** sending that attachment (optionally with a caption) SHALL use the same encrypted file-message and caption flow defined by the existing messaging requirements for DM media.

#### Scenario: Logged-in user shares text or URL to nospeak
- **GIVEN** the nospeak Android app is installed and the user is currently logged in
- **AND** another Android app offers a "Share" action for a single text snippet or HTTP(S) URL
- **WHEN** the user selects the nospeak app from the Android share sheet
- **THEN** the nospeak Android app shell SHALL open or be brought to the foreground
- **AND** it SHALL navigate to the contact list view rather than directly opening any existing conversation
- **AND** when the user selects a contact from the list, the messaging UI for that contact SHALL pre-fill the message input with the shared text or URL while leaving the user free to edit or discard it before sending
- **AND** sending the message SHALL follow the existing DM text message semantics defined by the messaging specification (including any URL preview behavior that applies after send).

#### Scenario: Inbound share always goes through explicit contact selection
- **GIVEN** the nospeak Android app shell is running and may currently be displaying either the contact list or an existing DM conversation
- **WHEN** the user shares a supported media file or text/URL from another Android app and selects nospeak in the share sheet
- **THEN** the Android app shell SHALL navigate to the contact list view (if it is not already visible)
- **AND** it SHALL NOT automatically route the inbound share into whichever DM conversation happens to be currently open
- **AND** only after the user explicitly selects a contact from the list SHALL the app either open the single-file media send preview with the shared media or pre-fill the message input for that specific contact with the shared text.

#### Scenario: Inbound share while logged out is rejected without retention
- **GIVEN** the nospeak Android app is installed but the user is not currently logged in (for example, at the unauthenticated login screen)
- **AND** another Android app offers a "Share" action for a media file or text/URL
- **WHEN** the user selects the nospeak app from the Android share sheet
- **THEN** the nospeak Android app shell SHALL display a clear, non-blocking message informing the user that they must log in to share content
- **AND** it SHALL NOT retain the shared media or text for later use after login (for example, it SHALL NOT queue the share in local storage or memory for later delivery)
- **AND** after logging in, the user MUST start a new share action from the original app if they still wish to send that content.

#### Scenario: Unsupported inbound share content is safely ignored
- **GIVEN** the nospeak Android app is installed and may be either logged in or logged out
- **AND** another Android app attempts to share content to nospeak using a MIME type or payload that is not supported by the nospeak Android inbound share implementation (for example, an `ACTION_SEND_MULTIPLE` with multiple attachments or a non-media, non-text type)
- **WHEN** the user selects nospeak in the share sheet for such unsupported content
- **THEN** the nospeak Android app shell MAY either show a brief error message indicating that the content cannot be shared or silently ignore the inbound share
- **BUT** in all cases it SHALL avoid crashing, freezing, or leaving the UI in an inconsistent state
- **AND** it SHALL NOT partially apply the share in a way that could result in corrupted or ambiguous DM state.

### Requirement: Android Native Tap Sound for Micro-Interactions
When running inside the Android Capacitor app shell, the app SHALL be able to play the Android OS-native “tap/click” sound effect for selected micro-interactions (such as lightweight selections and button presses) using a minimal, intent-based API. Tap sound playback SHALL respect Android system sound settings (including the system “Touch sounds” preference and the device’s current ringer mode), and tap sound calls SHALL be non-blocking when sound effects are unavailable.

#### Scenario: Tap sound plays for selection-style micro-interactions
- **GIVEN** the user is running nospeak inside the Android Capacitor app shell
- **AND** Android system “Touch sounds” are enabled
- **WHEN** the user performs a micro-interaction configured to trigger tap sound feedback (for example, pressing a button or toggling a setting)
- **THEN** the Android shell SHALL play the OS-native click sound effect
- **AND** the interaction behavior SHALL complete normally even if sound playback fails.

#### Scenario: Tap sound is suppressed when Android system touch sounds are disabled
- **GIVEN** the user is running nospeak inside the Android Capacitor app shell
- **AND** Android system “Touch sounds” are disabled
- **WHEN** the user performs a micro-interaction configured to trigger tap sound feedback
- **THEN** no audible tap sound SHALL be produced.

#### Scenario: Web behavior remains unchanged outside Android shell for tap sound
- **GIVEN** the user is accessing nospeak via a standard web browser rather than the Android Capacitor app shell
- **WHEN** the user performs the same interactions that would normally trigger Android tap sounds
- **THEN** the system SHALL NOT require an Android tap sound API to be present
- **AND** the absence of tap sound feedback SHALL NOT block or degrade the primary interaction behavior.

### Requirement: Android Background Messaging Auto-Restart After Device Restart
When running inside the Android Capacitor app shell, the system SHALL restore Android background messaging after a device restart or app update for users who previously enabled background messaging.

For Amber sessions, the native service MAY rely on the persisted signer package selection and existing signer integration as specified.

For local-key sessions, the native service SHALL only restart in a state that can perform NIP-44 decryption when the local secret key is available in Android-native secure storage. If the secret key is missing, the service SHALL disable background messaging and SHALL NOT continue attempting to run in a degraded mode.

#### Scenario: Local-key service restarts after device reboot when secret is available
- **GIVEN** the user previously enabled background messaging in Settings → General while running inside the Android Capacitor app shell
- **AND** the user previously logged in with a local key (nsec) and the key is stored in Android-native secure storage
- **WHEN** the device reboots and the user unlocks their Android profile
- **THEN** the Android app shell SHALL start the native background messaging foreground service without requiring the WebView to be opened
- **AND** the service SHALL be able to decrypt gift-wraps and emit preview notifications according to the background messaging requirements.

#### Scenario: Local-key service does not run after reboot when secret is missing
- **GIVEN** the user previously enabled background messaging in Settings → General
- **AND** the user previously used a local key (nsec) session
- **AND** the local secret key is no longer available in Android-native secure storage
- **WHEN** the device reboots or the app is updated
- **THEN** the Android shell SHALL disable background messaging for that installation
- **AND** it SHALL NOT keep the foreground service running in a state that cannot decrypt messages.

### Requirement: Android Local Key Secret Storage
When running inside the Android Capacitor app shell, the system SHALL persist local-key (nsec) authentication secrets only in Android-native, Keystore-backed storage and SHALL NOT persist the local secret key in web `localStorage`.

The Android shell SHALL expose a minimal Capacitor plugin API for the web runtime to store, retrieve, and clear the local secret key.

#### Scenario: Local-key login persists secret in Android-native secure storage
- **GIVEN** the user is running nospeak inside the Android Capacitor app shell
- **WHEN** the user logs in using a local key (nsec)
- **THEN** the system SHALL store the secret key in Android-native, Keystore-backed storage
- **AND** it SHALL persist the auth method in a non-secret form so the session can be restored.

#### Scenario: Android local-key restore requires secure secret
- **GIVEN** the user previously logged in using a local key (nsec) in the Android app shell
- **WHEN** the app attempts to restore the session on startup
- **THEN** it SHALL restore the session only if the local secret key is present in Android-native secure storage
- **AND** if the secret is missing, it SHALL require the user to re-login.

#### Scenario: Logout clears Android-native secret storage
- **GIVEN** the user is logged in using a local key (nsec) inside the Android app shell
- **WHEN** the user logs out
- **THEN** the system SHALL clear the local secret key from Android-native secure storage
- **AND** it SHALL stop Android background messaging and clear any persisted state as already specified.

### Requirement: Android Boot Respects Notification Opt-out
The Android Capacitor app shell SHALL ensure that Android background messaging is not automatically started by boot receivers or package-replace receivers when Notifications are disabled for the installation.

#### Scenario: Boot receiver does not start background service when notifications disabled
- **GIVEN** the user previously disabled Notifications on this Android installation
- **AND** the Android device reboots (or the app is updated)
- **WHEN** the Android boot/package-replace receiver evaluates whether to start background messaging
- **THEN** the Android background messaging foreground service SHALL NOT be started.

#### Scenario: Boot receiver may start background service when notifications enabled
- **GIVEN** Notifications are enabled for this Android installation
- **AND** background messaging is enabled for this Android installation
- **AND** the Android device reboots (or the app is updated)
- **WHEN** the Android boot/package-replace receiver evaluates whether to start background messaging
- **THEN** it MAY start the Android background messaging foreground service according to the existing background messaging requirements.

### Requirement: Android Media Upload via Blossom Servers
When running inside the Android Capacitor app shell, the messaging experience SHALL upload selected media attachments using Blossom servers.

- If the user has one or more configured Blossom servers, the Android client SHALL upload to Blossom using `PUT /upload` and Blossom authorization (kind `24242`) as defined by the `messaging` Media Upload Support requirement.
- If the user has zero configured Blossom servers and initiates an upload, the Android client SHALL automatically configure the default Blossom server list (deployment-configurable; defaults: `https://blossom.data.haus`, `https://blossom.primal.net`), SHALL display an in-app informational modal indicating these servers were set, and SHALL then upload using Blossom as normal.

#### Scenario: Android app uploads media via Blossom servers
- **GIVEN** the user has at least one configured Blossom server URL
- **WHEN** the user selects an image, video, or audio file and the upload is initiated
- **THEN** the Android client SHALL send a `PUT /upload` request to the first configured Blossom server with a valid Blossom authorization event (kind `24242`)
- **AND** upon successful upload, the returned blob URL SHALL be used by the messaging UI according to the `messaging` specification.

#### Scenario: Android app auto-configures Blossom servers when missing
- **GIVEN** the user has zero configured Blossom servers
- **WHEN** the user initiates a media upload
- **THEN** the client SHALL automatically set the Blossom servers to the default list (deployment-configurable; defaults: `https://blossom.data.haus`, `https://blossom.primal.net`)
- **AND** the client SHALL display an informational modal indicating these servers were set automatically
- **AND** the upload SHALL proceed using Blossom servers.

#### Scenario: Android upload failure does not break messaging
- **WHEN** a Blossom server is unreachable or rejects the upload request
- **THEN** the Android client SHALL display a non-blocking error message indicating that the media upload failed
- **AND** the rest of the messaging UI (including text sending, history scrolling, and media rendering for previously uploaded content) SHALL continue to function normally.

### Requirement: Android Location Permissions and GPS Access
The Android Capacitor app shell SHALL request `ACCESS_FINE_LOCATION` and `ACCESS_COARSE_LOCATION` permissions from the user via the runtime permission model when accessing GPS coordinates for location sharing. The app SHALL register these permissions in `AndroidManifest.xml` and SHALL handle permission denial gracefully without crashing.

#### Scenario: AndroidManifest declares location permissions
- **GIVEN** the Android application is being built
- **WHEN** the `AndroidManifest.xml` is processed
- **THEN** the manifest SHALL declare `uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"`
- **AND** the manifest SHALL declare `uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"`

#### Scenario: Runtime permission request on location share
- **GIVEN** a user is running nospeak inside the Android Capacitor app shell
- **AND** the user has not previously granted location permissions
- **WHEN** the user taps the location share button
- **THEN** the app SHALL request `ACCESS_FINE_LOCATION` permission via the Android runtime permission model
- **AND** the OS SHALL show a permission dialog to the user
- **AND** upon grant, the app SHALL proceed to fetch GPS coordinates
- **AND** if the user denies, the app SHALL display an error dialog and NOT send the location message

#### Scenario: Geolocation plugin uses granted permissions
- **GIVEN** a user has previously granted location permissions
- **WHEN** the user taps the location share button
- **THEN** the AndroidLocation plugin SHALL access GPS coordinates without prompting
- **AND** the plugin SHALL use fine-grained location when available
- **AND** the location data SHALL be returned successfully to the web layer

#### Scenario: Permission denial handled gracefully
- **GIVEN** a user denies location permission when prompted
- **WHEN** the location share action fails
- **THEN** the app SHALL display an in-app or native dialog error message
- **AND** the app SHALL remain functional for non-location features
- **AND** the user SHALL be able to retry location sharing

