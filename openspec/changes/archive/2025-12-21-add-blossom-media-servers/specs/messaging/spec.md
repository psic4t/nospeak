## MODIFIED Requirements

### Requirement: Media Upload Support
The system SHALL allow users to upload images, videos, and MP3 audio files as encrypted attachments in NIP-17 conversations. The upload destination SHALL be selected based on the user’s Settings → Media Servers preference.

- If the user has enabled Blossom uploads and has at least one configured Blossom server, the client SHALL upload the encrypted blob to Blossom servers using BUD-03 server ordering and Blossom authorization events (kind `24242`) as defined by BUD-01/BUD-02.
- Otherwise, the client SHALL upload the encrypted blob to the canonical nospeak upload endpoint `https://nospeak.chat/api/upload` using HTTPS POST with a valid NIP-98 Authorization header.

When Blossom uploads are enabled:
- The client MUST attempt to upload the blob to at least the first configured Blossom server.
- The client SHOULD also upload (or otherwise mirror) the blob to the remaining configured servers on a best-effort basis.

#### Scenario: User sends image file message using Blossom servers
- **GIVEN** the user has enabled Blossom uploads in Settings → Media Servers
- **AND** the user has at least one configured Blossom server URL
- **WHEN** the user selects an image file and confirms sending from the preview
- **THEN** the client SHALL upload the encrypted image blob to the first configured Blossom server using `PUT /upload` with a valid Blossom authorization event (kind `24242` with `t=upload` and an `x` tag matching the uploaded blob’s SHA-256)
- **AND** upon successful upload, the system SHALL create and send a NIP-17 Kind 15 file message whose content is the returned blob `url`
- **AND** the client SHOULD then attempt to upload or mirror the blob to remaining configured Blossom servers without blocking the message send.

#### Scenario: User sends video file message using local uploads
- **GIVEN** the user has disabled Blossom uploads in Settings → Media Servers
- **WHEN** the user selects a video file and confirms sending from the preview
- **THEN** the client SHALL upload the encrypted video blob to `https://nospeak.chat/api/upload` using HTTPS POST with a valid NIP-98 Authorization header
- **AND** upon successful upload, the system SHALL create and send a NIP-17 Kind 15 file message whose content is the resulting `/api/user_media/<filename>` URL.

#### Scenario: Blossom toggle disabled when no servers configured
- **GIVEN** the user has zero configured Blossom servers
- **WHEN** the user views Settings → Media Servers
- **THEN** the Blossom upload toggle is disabled
- **AND** sending file messages SHALL use the local nospeak upload endpoint with NIP-98 authorization.

#### Scenario: Upload failure is non-blocking
- **WHEN** the user attempts to upload an image, video, or MP3 audio file and the selected upload backend is unreachable or rejects the upload
- **THEN** an error message SHALL be displayed
- **AND** the rest of the messaging UI (including text sending, history scrolling, and media rendering for previously uploaded content) SHALL continue to function normally.
