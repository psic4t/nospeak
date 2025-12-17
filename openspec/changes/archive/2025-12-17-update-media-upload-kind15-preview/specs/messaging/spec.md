## ADDED Requirements
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
- **AND** if the caption input is non-empty, the system SHALL also send a separate NIP-17 Kind 14 text message in the same conversation whose content is the caption text
- **AND** the media preview surface SHALL be dismissed after the send operation is initiated.

#### Scenario: Closing preview discards pending attachment
- **GIVEN** the media preview is open with a selected file and optional caption
- **WHEN** the user closes or cancels the preview without pressing Send
- **THEN** the system SHALL NOT send any Kind 15 or Kind 14 messages for that file or caption
- **AND** any existing draft text in the normal message input SHALL remain unchanged.

## MODIFIED Requirements
### Requirement: Media Upload Support
The system SHALL allow users to upload images, videos, and MP3 audio files as encrypted attachments in NIP-17 conversations. Media uploads SHALL be performed via HTTPS POST requests to the canonical nospeak upload endpoint `https://nospeak.chat/api/upload`. Each media upload request SHALL include a valid NIP-98 Authorization header proving control of a Nostr key for the current session; the server SHALL reject uploads that are missing, expired, or invalid according to the NIP-98 verification rules. Uploaded media files SHALL continue to be stored under a `user_media` directory using UUID-based filenames, and the server SHALL expose these files via a CORS-enabled media API at `/api/user_media/<filename>` so that NIP-17 Kind 15 file messages and legacy text messages from other clients can reference those URLs when rendering media in conversations. When nospeak itself sends media attachments, it SHALL represent them as NIP-17 Kind 15 file messages instead of inserting the media URLs into Kind 14 text messages created by this client.

#### Scenario: User sends image file message
- **WHEN** the user opens the media upload menu from the message input, selects "Image", and chooses a valid image file
- **THEN** the system SHALL open the media preview surface showing the selected image and an optional caption input
- **WHEN** the user confirms sending from the preview
- **THEN** the client SHALL upload the (encrypted) image blob to `https://nospeak.chat/api/upload` using HTTPS POST with a valid NIP-98 Authorization header
- **AND** upon successful upload, the system SHALL create and send a NIP-17 Kind 15 file message whose content is the resulting `/api/user_media/<filename>` URL and whose tags include at least the original MIME type, file size in bytes, and SHA-256 hash of the encrypted file blob
- **AND** if the caption input is non-empty, the system SHALL also send a separate NIP-17 Kind 14 text message in the same conversation whose content is the caption text.

#### Scenario: User sends video file message
- **WHEN** the user opens the media upload menu from the message input, selects "Video", and chooses a valid video file
- **THEN** the system SHALL open the media preview surface showing the selected video and an optional caption input
- **WHEN** the user confirms sending from the preview
- **THEN** the client SHALL upload the (encrypted) video blob to `https://nospeak.chat/api/upload` with a valid NIP-98 Authorization header
- **AND** upon successful upload, the system SHALL create and send a NIP-17 Kind 15 file message whose content is the resulting `/api/user_media/<filename>` URL and whose tags include at least the original video MIME type, file size in bytes, and SHA-256 hash of the encrypted file blob
- **AND** if the caption input is non-empty, the system SHALL also send a separate NIP-17 Kind 14 text message in the same conversation whose content is the caption text.

#### Scenario: User sends audio file message (MP3)
- **WHEN** the user opens the media upload menu from the message input, selects a "Music" or audio option, and chooses a valid MP3 audio file
- **THEN** the system SHALL open the media preview surface showing the selected audio file details and an optional caption input
- **WHEN** the user confirms sending from the preview
- **THEN** the client SHALL upload the (encrypted) audio blob to `https://nospeak.chat/api/upload` with a valid NIP-98 Authorization header
- **AND** upon successful upload, the system SHALL create and send a NIP-17 Kind 15 file message whose content is the resulting `/api/user_media/<filename>` URL and whose tags include at least the original audio MIME type, file size in bytes, and SHA-256 hash of the encrypted file blob
- **AND** if the caption input is non-empty, the system SHALL also send a separate NIP-17 Kind 14 text message in the same conversation whose content is the caption text.

#### Scenario: Media display in messages
- **WHEN** a message in a conversation contains or references an image media URL (either as the content of a NIP-17 Kind 15 file message or as a bare HTTP(S) image URL in a Kind 14 text message received from another client)
- **THEN** the image SHALL be rendered inline in the message bubble
- **WHEN** a message contains or references a video media URL (either as the content of a NIP-17 Kind 15 file message or as a bare HTTP(S) video URL in a Kind 14 text message received from another client)
- **THEN** the video SHALL be rendered with controls in the message bubble
- **WHEN** a message contains or references an audio media URL that ends with `.mp3` (either as the content of a NIP-17 Kind 15 file message or as a bare HTTP(S) `.mp3` URL in a Kind 14 text message received from another client)
- **THEN** the message bubble SHALL render a compact audio player that displays a simple waveform visualization for the MP3
- **AND** the audio player SHALL provide basic play and pause controls so the user can listen without leaving the conversation.

#### Scenario: Invalid file upload
- **WHEN** the user selects an invalid file type or oversized file for upload
- **THEN** an error message SHALL be displayed
- **AND** no upload or Kind 15 file message SHALL be sent for that file.

#### Scenario: Unauthorized media upload is rejected
- **WHEN** a client attempts to upload an image, video, or MP3 audio file without a NIP-98 Authorization header, with an Authorization header that does not target `https://nospeak.chat/api/upload`, or with an Authorization header that fails signature or freshness validation
- **THEN** the server SHALL reject the upload request with an error status
- **AND** no file SHALL be stored in the `user_media` directory
- **AND** the client SHALL surface a non-blocking error message in the messaging UI.

### Requirement: NIP-17 Kind 15 File Messages
The messaging experience SHALL represent binary attachments (such as images, videos, and audio files) sent over encrypted direct messages as unsigned NIP-17 file message rumors using Kind 15, sealed and gift-wrapped via the existing NIP-59 DM pipeline. Each file message SHALL carry enough metadata in its tags to describe the media type, basic size information, and content hashes, and SHALL reference an HTTPS URL where the encrypted file bytes can be fetched when sent by nospeak.

#### Scenario: Sending a file as a NIP-17 Kind 15 DM
- **GIVEN** the user is composing a one-to-one encrypted conversation and chooses an image, video, or audio file from the media upload affordance
- **WHEN** the client prepares the DM payload for this attachment
- **THEN** it SHALL construct an **unsigned** Kind 15 rumor whose tags include at minimum:
  - a `p` tag for the recipient pubkey
  - a `file-type` tag containing the original MIME type (for example, `image/jpeg`, `video/mp4`, or `audio/mpeg`)
  - an `x` tag containing the SHA-256 hash of the uploaded file bytes (encrypted or plaintext)
  - a `size` tag indicating the file size in bytes
- **AND** the rumor `.content` SHALL be set to an HTTPS URL served via the nospeak media API under the `/api/user_media` path that points to the stored file
- **AND** the client SHALL seal this Kind 15 rumor (kind 13) and gift-wrap it (kind 1059) using the same NIP-59 pipeline used for Kind 14 chat messages.

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
