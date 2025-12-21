## MODIFIED Requirements

### Requirement: Android Media Upload via Remote NIP-98 Authenticated Endpoint
When running inside the Android Capacitor app shell, the messaging experience SHALL upload selected media attachments using the configured upload backend selected in Settings → Media Servers.

- If Blossom uploads are enabled and the user has at least one configured Blossom server, the Android client SHALL upload to Blossom using `PUT /upload` and Blossom authorization (kind `24242`) as defined by the `messaging` Media Upload Support requirement.
- Otherwise, the Android client SHALL upload to the canonical nospeak media upload endpoint `https://nospeak.chat/api/upload` using HTTPS POST with a valid NIP-98 Authorization header.

#### Scenario: Android app uploads media via Blossom servers
- **GIVEN** the user is running nospeak inside the Android Capacitor app
- **AND** the user has enabled Blossom uploads in Settings → Media Servers
- **AND** the user has at least one configured Blossom server URL
- **WHEN** the user selects an image, video, or audio file and the upload is initiated
- **THEN** the Android client SHALL send a `PUT /upload` request to the first configured Blossom server with a valid Blossom authorization event (kind `24242`)
- **AND** upon successful upload, the returned blob URL SHALL be used by the messaging UI according to the `messaging` specification.

#### Scenario: Android app uploads media via nospeak endpoint when Blossom disabled
- **GIVEN** the user is running nospeak inside the Android Capacitor app
- **AND** the user has disabled Blossom uploads (or Blossom is unavailable due to no configured servers)
- **WHEN** the upload is initiated
- **THEN** the Android client SHALL send an HTTPS POST request to `https://nospeak.chat/api/upload` that includes a valid NIP-98 Authorization header for the current Nostr session
- **AND** upon successful upload, the returned media URL SHALL be used by the messaging UI according to the `messaging` specification.

#### Scenario: Android upload failure does not break messaging
- **GIVEN** the user is running nospeak inside the Android Capacitor app
- **WHEN** the selected upload backend is unreachable or rejects the upload request
- **THEN** the Android client SHALL display a non-blocking error message indicating that the media upload failed
- **AND** the rest of the messaging UI (including text sending, history scrolling, and media rendering for previously uploaded content) SHALL continue to function normally.

#### Scenario: Web behavior remains unchanged outside Android shell
- **GIVEN** the user is accessing nospeak via a standard web browser (not inside the Android Capacitor app)
- **WHEN** they upload media using the web messaging UI
- **THEN** the client SHALL upload media according to the `messaging` Media Upload Support requirement and the Settings → Media Servers preference.

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
