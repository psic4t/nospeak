## ADDED Requirements
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
