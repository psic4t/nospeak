## ADDED Requirements

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
- **AND** the rumor `.content` SHALL be set to an HTTPS URL under the existing `user_media` path that points to the stored file
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

### Requirement: File Message Metadata for Interoperability
The messaging implementation for Kind 15 file messages SHALL standardize on a minimal tag set so that other NIP-17 clients can reliably interpret nospeak file DMs without needing to understand internal upload semantics.

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
