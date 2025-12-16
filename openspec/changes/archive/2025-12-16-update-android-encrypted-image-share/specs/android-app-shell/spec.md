## ADDED Requirements
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
