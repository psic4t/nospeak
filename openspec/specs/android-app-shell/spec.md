# android-app-shell Specification

## Purpose
TBD - created by archiving change add-android-local-notifications. Update Purpose after archive.
## Requirements
### Requirement: Android Local Notifications via Capacitor Plugin
The Android Capacitor app shell SHALL integrate with `@capacitor/local-notifications` (or an equivalent Capacitor local notifications plugin) to deliver OS-native notifications for new messages when message notifications are enabled, aligning with the messaging notification requirements and existing branding constraints.

#### Scenario: Android app registers local notification channel
- **GIVEN** the nospeak Android app is installed and launched on a supported Android device
- **WHEN** the app initializes its Capacitor runtime and messaging environment
- **THEN** it SHALL register at least one notification channel dedicated to message notifications with an icon consistent with the messaging and visual-design specs
- **AND** this channel SHALL be used for all local notifications triggered for new messages.

#### Scenario: Permission request uses Android notification APIs
- **GIVEN** the user enables message notifications in Settings  General while running inside the Android app
- **WHEN** the app requests permission to show notifications
- **THEN** it SHALL use the Android notification permission APIs exposed by the Capacitor local notifications plugin
- **AND** it SHALL handle denial or revocation gracefully by keeping the app functional and reflecting that notifications cannot be delivered.

#### Scenario: Web behavior unchanged outside Android shell
- **GIVEN** the user is accessing nospeak in a standard web browser rather than the Android app shell
- **WHEN** message notifications are enabled or disabled in Settings  General
- **THEN** no Capacitor local notifications plugin APIs SHALL be invoked
- **AND** notifications SHALL rely solely on the existing web mechanisms described in the messaging specification.

### Requirement: Android Capacitor App Shell
The project SHALL provide an Android application package that wraps the existing nospeak web client using Capacitor, bundles the compiled web assets locally, and launches directly into the chat experience without requiring an external browser.

#### Scenario: Android app launches bundled nospeak UI
- **GIVEN** the nospeak Android app is installed on a supported Android device
- **WHEN** the user taps the nospeak app icon
- **THEN** the app SHALL open a Capacitor-powered WebView that loads the bundled nospeak web UI from local assets
- **AND** the initial screen SHALL respect the existing startup navigation behavior defined in the `messaging` spec (desktop vs mobile contact list and conversation routing).

#### Scenario: Android app works offline for cached content
- **GIVEN** the user has successfully opened the nospeak Android app at least once and the web assets are bundled locally
- **WHEN** the device is temporarily offline but the user opens the nospeak app again
- **THEN** the app SHALL still load the main chat interface shell from local assets
- **AND** any messaging behavior that depends on relays or remote HTTP endpoints MAY be degraded, but the UI SHALL remain responsive and clearly indicate connection state as defined in existing specs.

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
The Android Capacitor app shell SHALL provide a background messaging mode that keeps the user's read relays connected while the app UI is not visible by running the messaging stack inside a native Android foreground service that is started and controlled via a dedicated Capacitor plugin. This native service SHALL treat incoming gift-wrapped events as opaque envelopes and raise only generic "new encrypted message" notifications, regardless of whether the current session uses an on-device nsec or an external signer such as Amber.

#### Scenario: Native foreground service keeps relay connections active
- **GIVEN** the user is running nospeak inside the Android Capacitor app shell
- AND the user has enabled background messaging in Settings → General
- AND the app is in a session where relay configuration and the user's public key are known
- WHEN the user backgrounds the app (for example, by switching to another app or returning to the home screen)
- THEN the app SHALL start or maintain a native Android foreground service that keeps WebSocket connections to the user's configured read relays active
- AND the native service SHALL reuse the same real-time subscription semantics defined in the `messaging` spec for receiving gift-wrapped messages for the current user.

#### Scenario: Native foreground service behavior is generic for nsec and Amber sessions
- **GIVEN** the user is running nospeak inside the Android Capacitor app shell and has enabled background messaging
- AND the native foreground service is active
- WHEN a new gift-wrapped message addressed to the current user is delivered from any configured read relay while the app UI is not visible
- THEN the native foreground service SHALL treat the event as an opaque envelope
- AND it SHALL raise an Android OS notification that indicates a new encrypted message has arrived without revealing the sender's identity or message content
- AND this behavior SHALL be the same whether the session is using an on-device nsec or an external signer such as Amber.

#### Scenario: Background messaging stops when disabled or user signs out
- **GIVEN** background messaging is currently active for the Android app
- WHEN the user either signs out of nospeak, disables background messaging in Settings → General, or the app determines that required background execution privileges are no longer available
- THEN the app SHALL stop the native background messaging foreground service
- AND it SHALL close the associated relay connections
- AND it SHALL remove the persistent foreground notification associated with background messaging.

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

### Requirement: Android Media Upload via Remote NIP-98 Authenticated Endpoint
When running inside the Android Capacitor app shell, the messaging experience SHALL upload selected image and video attachments to the canonical nospeak media upload endpoint `https://nospeak.chat/api/upload` using HTTPS POST requests rather than relying on a local WebView origin. Each Android media upload request SHALL include a NIP-98 Authorization header that matches the semantics defined by the `messaging` Media Upload Support requirement, and the Android client SHALL treat server rejections due to missing or invalid NIP-98 authorization as recoverable errors that do not impact other messaging behaviors.

#### Scenario: Android app uploads media via remote endpoint
- **GIVEN** the user is running nospeak inside the Android Capacitor app
- **AND** the user taps the media upload button and selects an image or video using the preferred picker flow
- **WHEN** the upload is initiated
- **THEN** the Android client SHALL send an HTTPS POST request to `https://nospeak.chat/api/upload` that includes a valid NIP-98 Authorization header for the current Nostr session
- **AND** upon successful upload, the returned media URL SHALL be inserted into the message input field and rendered according to the messaging Media Upload Support requirement.

#### Scenario: Android upload failure does not break messaging
- **GIVEN** the user is running nospeak inside the Android Capacitor app
- **AND** the user attempts to upload media while the remote endpoint is unreachable or the NIP-98 Authorization header is missing or invalid
- **WHEN** the upload request fails or is rejected by the server
- **THEN** the Android client SHALL display a non-blocking error message indicating that the media upload failed
- **AND** the rest of the messaging UI (including text sending, history scrolling, and media rendering for previously uploaded content) SHALL continue to function normally.

#### Scenario: Web behavior remains unchanged outside Android shell
- **GIVEN** the user is accessing nospeak via a standard web browser (not inside the Android Capacitor app)
- **WHEN** they upload media using the web messaging UI
- **THEN** the client MAY share an origin with `https://nospeak.chat` and SHALL still perform media uploads in accordance with the updated `messaging` Media Upload Support requirement, including use of the canonical upload endpoint and NIP-98 Authorization headers.

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

