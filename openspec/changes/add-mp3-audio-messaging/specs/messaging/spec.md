## MODIFIED Requirements
### Requirement: Media Upload Support
The system SHALL allow users to upload images, videos, and MP3 audio files to include in chat messages. Media uploads SHALL be performed via HTTPS POST requests to the canonical nospeak upload endpoint `https://nospeak.chat/api/upload`. Each media upload request SHALL include a valid NIP-98 Authorization header proving control of a Nostr key for the current session; the server SHALL reject uploads that are missing, expired, or invalid according to the NIP-98 verification rules. Uploaded media files SHALL continue to be stored under a `user_media` directory using UUID-based filenames, and message content SHALL reference the resulting URLs for rendering.

#### Scenario: User uploads image
- **WHEN** user clicks the media upload button and selects "Image"
- **AND** user selects a valid image file
- **AND** the client includes a valid NIP-98 Authorization header targeting `https://nospeak.chat/api/upload`
- **THEN** the image is uploaded to user_media directory with UUID filename
- **AND** the image URL is inserted into the message input field

#### Scenario: User uploads video
- **WHEN** user clicks the media upload button and selects "Video"  
- **AND** user selects a valid video file
- **AND** the client includes a valid NIP-98 Authorization header targeting `https://nospeak.chat/api/upload`
- **THEN** the video is uploaded to user_media directory with UUID filename
- **AND** the video URL is inserted into the message input field

#### Scenario: User uploads audio (MP3)
- **WHEN** user clicks the media upload button and selects "Music"
- **AND** user selects a valid MP3 audio file
- **AND** the client includes a valid NIP-98 Authorization header targeting `https://nospeak.chat/api/upload`
- **THEN** the audio is uploaded to the user_media directory with a UUID-based `.mp3` filename
- **AND** the audio URL is inserted into the message input field

#### Scenario: Media display in messages
- **WHEN** a message contains an image URL
- **THEN** the image is rendered inline in the message bubble
- **WHEN** a message contains a video URL
- **THEN** the video is rendered with controls in the message bubble
- **WHEN** a message contains a URL that ends with `.mp3`
- **THEN** the message bubble renders a compact audio player that displays a simple waveform visualization for the MP3
- **AND** the audio player provides basic play and pause controls so the user can listen without leaving the conversation

#### Scenario: Invalid file upload
- **WHEN** user selects an invalid file type or oversized file
- **THEN** an error message is displayed
- **AND** no upload occurs

#### Scenario: Unauthorized media upload is rejected
- **WHEN** a client attempts to upload an image, video, or MP3 audio file without a NIP-98 Authorization header, with an Authorization header that does not target `https://nospeak.chat/api/upload`, or with an Authorization header that fails signature or freshness validation
- **THEN** the server SHALL reject the upload request with an error status
- **AND** no file is stored in the `user_media` directory
- **AND** the client SHALL surface a non-blocking error message in the messaging UI.
