## MODIFIED Requirements

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
- **AND** the request SHOULD include a valid Blossom authorization event (kind `24242` with `t=upload` and an `x` tag matching the blob's SHA-256)
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
