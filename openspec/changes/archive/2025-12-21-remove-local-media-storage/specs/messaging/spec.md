## MODIFIED Requirements
### Requirement: Media Upload Support
The system SHALL allow users to upload images, videos, and MP3 audio files as encrypted attachments in NIP-17 conversations.

Uploads SHALL be performed using Blossom servers:
- If the user has one or more configured Blossom servers, the client SHALL upload the encrypted blob to Blossom servers using BUD-03 server ordering and Blossom authorization events (kind `24242`) as defined by BUD-01/BUD-02.
- If the user has zero configured Blossom servers and attempts an upload, the client SHALL automatically configure the default Blossom server list `https://blossom.primal.net` and `https://24242.io`, SHALL display an in-app informational modal indicating these servers were set, and SHALL then upload using Blossom as normal.

When Blossom uploads are used:
- The client MUST attempt to upload the blob to at least the first configured Blossom server.
- The client SHOULD also upload (or otherwise mirror) the blob to the remaining configured servers on a best-effort basis.

#### Scenario: User sends image file message using Blossom servers
- **GIVEN** the user has at least one configured Blossom server URL
- **WHEN** the user selects an image file and confirms sending from the preview
- **THEN** the client SHALL upload the encrypted image blob to the first configured Blossom server using `PUT /upload` with a valid Blossom authorization event (kind `24242` with `t=upload` and an `x` tag matching the uploaded blob’s SHA-256)
- **AND** upon successful upload, the system SHALL create and send a NIP-17 Kind 15 file message whose content is the returned blob `url`
- **AND** the client SHOULD then attempt to upload or mirror the blob to remaining configured Blossom servers without blocking the message send.

#### Scenario: User uploads with no configured Blossom servers
- **GIVEN** the user has zero configured Blossom servers
- **WHEN** the user attempts to upload an image, video, or MP3 audio file
- **THEN** the client SHALL automatically set the Blossom servers to `https://blossom.primal.net` and `https://24242.io`
- **AND** the client SHALL display an informational modal indicating these servers were set automatically
- **AND** the upload SHALL proceed using Blossom servers.

#### Scenario: Upload failure is non-blocking
- **WHEN** the user attempts to upload an image, video, or MP3 audio file and a Blossom server is unreachable or rejects the upload
- **THEN** an error message SHALL be displayed
- **AND** the rest of the messaging UI (including text sending, history scrolling, and media rendering for previously uploaded content) SHALL continue to function normally.

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

### Requirement: NIP-17 Kind 15 File Messages
The messaging experience SHALL represent binary attachments (such as images, videos, and audio files) sent over encrypted direct messages as unsigned NIP-17 file message rumors using Kind 15, sealed and gift-wrapped via the existing NIP-59 DM pipeline. Each file message SHALL carry enough metadata in its tags to describe the media type, basic size information, and content hashes, and SHALL reference an HTTPS URL where the encrypted file bytes can be fetched.

#### Scenario: Sending a file as a NIP-17 Kind 15 DM
- **GIVEN** the user is composing a one-to-one encrypted conversation and chooses an image, video, or audio file from the media upload affordance
- **WHEN** the client prepares the DM payload for this attachment
- **THEN** it SHALL construct an **unsigned** Kind 15 rumor whose tags include at minimum:
  - a `p` tag for the recipient pubkey
  - a `file-type` tag containing the original MIME type (for example, `image/jpeg`, `video/mp4`, or `audio/mpeg`)
  - an `x` tag containing the SHA-256 hash of the uploaded file bytes (encrypted or plaintext)
  - a `size` tag indicating the file size in bytes
- **AND** the rumor `.content` SHALL be set to the HTTPS URL returned from the Blossom upload.

#### Scenario: Receiving and displaying a NIP-17 Kind 15 DM
- **GIVEN** the messaging service unwraps a NIP-59 gift-wrap whose inner rumor is Kind 15
- **WHEN** the tags include a `p` tag for the current user and a `file-type` tag describing the media type
- **THEN** the system SHALL persist a message record that captures at least the file URL, MIME type, and basic size/hash information from the rumor tags
- **AND** the conversation UI SHALL render this record as a file attachment bubble that uses the MIME type to decide whether to show an inline image, video player, or audio player, consistent with the existing Media Upload Support behavior.

#### Scenario: Fallback when a client only supports Kind 14 text messages
- **GIVEN** a remote client sends media by embedding a bare HTTP(S) URL in a Kind 14 chat message instead of using Kind 15
- **WHEN** nospeak receives and unwraps this message
- **THEN** the system SHALL continue to treat the message as a text chat bubble with media URL detection as defined in existing messaging requirements
- **AND** this behavior SHALL remain supported even after nospeak starts sending attachments using Kind 15 for its own clients.

#### Scenario: Optional caption sent as separate Kind 14 message
- **GIVEN** the user has entered non-empty caption text while preparing a file attachment in the media preview for a NIP-17 conversation
- **WHEN** the messaging service sends the Kind 15 file message rumor and corresponding gift-wrap for that attachment
- **THEN** it SHALL also send a separate NIP-17 Kind 14 text message in the same conversation whose content is the caption text
- **AND** the caption Kind 14 text message SHALL include an `e` tag whose value is the rumor id of the corresponding Kind 15 file message, denoting that file message as the direct parent according to the NIP-17 definition of the `e` tag.
- **AND** the conversation UI SHALL present the file attachment bubble and caption text as a single visual message unit by rendering the caption text directly below the file preview inside the same bubble, without a separate caption avatar.

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
- **THEN** the stored message record SHALL identify that the underlying rumor kind is 15 and SHALL preserve file metadata (such as MIME type and URL) separately from any freeform text content
- **AND** the UI and history views SHALL be able to distinguish between text-only messages (Kind 14) and file messages (Kind 15) even when both appear in the same conversation.

#### Scenario: Caption detection and grouping for NIP-17 messages
- **GIVEN** a NIP-17 conversation history that contains a Kind 15 file message `F` and a Kind 14 text message `C` authored by the same pubkey
- **WHEN** `C` includes an `e` tag whose value is the rumor id of `F`, denoting `F` as the direct parent according to NIP-17
- **AND** `C` appears immediately after `F` in the locally ordered list of messages for that conversation
- **THEN** the conversation UI SHALL treat `C` as a caption for `F` and render the caption text as part of the same visual message unit as `F`, directly below the file preview and without a separate caption avatar row
- **AND** when these conditions are not met, Kind 14 text messages SHALL be rendered as normal chat bubbles without caption-style grouping.

## ADDED Requirements
### Requirement: Legacy nospeak internal media URLs render a placeholder
The messaging UI SHALL treat `https://nospeak.chat/api/user_media/...` URLs as deprecated internal-storage media links and SHALL NOT attempt to fetch or render them as media.

#### Scenario: Legacy internal media URL renders placeholder
- **GIVEN** a message contains a media URL whose origin is `https://nospeak.chat`
- **AND** the URL pathname starts with `/api/user_media/`
- **WHEN** the message is rendered in the conversation UI
- **THEN** the UI SHALL render a placeholder indicating the media is unavailable
- **AND** the UI SHALL NOT attempt to load or decrypt bytes from that URL.
