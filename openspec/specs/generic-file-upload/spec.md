# Generic File Upload Specification

## Purpose
Define requirements for uploading, displaying, and downloading generic files (non-media attachments) in encrypted NIP-17 conversations.

## Requirements

### Requirement: Generic File Upload Support
The system SHALL allow users to upload generic files (any file type) as encrypted attachments in NIP-17 conversations, with a maximum file size of 10 MB. Generic files SHALL be encrypted client-side using AES-256-GCM before uploading to Blossom servers, using the same encryption flow as media attachments.

#### Scenario: User uploads a generic file
- **GIVEN** the user is in a conversation
- **WHEN** the user selects "File" from the media upload menu and chooses a file under 10 MB
- **THEN** the file is encrypted with AES-GCM
- **AND** uploaded to the user's configured Blossom servers
- **AND** a kind 15 file message is sent with the file URL, MIME type, and decryption metadata

#### Scenario: File exceeds size limit
- **GIVEN** the user is in a conversation
- **WHEN** the user selects a file larger than 10 MB via the "File" option
- **THEN** the system SHALL display a localized error message indicating the file is too large
- **AND** the upload SHALL NOT proceed

### Requirement: Media Type Auto-Detection
When a user selects a file via the generic "File" upload option, the system SHALL detect if the file is actually an image, video, or audio file by examining both the MIME type and file extension. If a media type is detected, the system SHALL automatically route the file to the corresponding existing media preview flow.

#### Scenario: Image file detected via File picker
- **GIVEN** the user selects "File" from the media upload menu
- **WHEN** the user chooses a file with MIME type starting with `image/` or extension matching common image formats (jpg, jpeg, png, gif, webp, svg)
- **THEN** the system SHALL open the image preview modal
- **AND** process the file as an image attachment with dimensions and blurhash metadata

#### Scenario: Video file detected via File picker
- **GIVEN** the user selects "File" from the media upload menu
- **WHEN** the user chooses a file with MIME type starting with `video/` or extension matching common video formats (mp4, webm, mov, avi, mkv)
- **THEN** the system SHALL open the video preview modal
- **AND** process the file as a video attachment with dimensions and blurhash metadata

#### Scenario: Audio file detected via File picker
- **GIVEN** the user selects "File" from the media upload menu
- **WHEN** the user chooses a file with MIME type starting with `audio/` or extension matching common audio formats (mp3, wav, ogg, flac, m4a, aac)
- **THEN** the system SHALL open the audio preview modal
- **AND** process the file as an audio attachment

#### Scenario: Non-media file proceeds as generic file
- **GIVEN** the user selects "File" from the media upload menu
- **WHEN** the user chooses a file that does not match image, video, or audio patterns
- **THEN** the system SHALL process the file as a generic file attachment
- **AND** display the generic file preview modal with file icon and size

### Requirement: Generic File Preview Modal
When a user selects a generic file for upload, the system SHALL display a preview modal showing an extension-specific icon, the file extension, and the human-readable file size. The modal SHALL allow the user to add a caption and confirm or cancel the upload.

#### Scenario: Generic file preview display
- **GIVEN** the user has selected a non-media file via the "File" option
- **WHEN** the preview modal opens
- **THEN** the modal SHALL display an icon appropriate to the file type (e.g., PDF icon for PDF files)
- **AND** display the file extension (e.g., ".pdf")
- **AND** display the file size in human-readable format (e.g., "2.4 MB")
- **AND** provide cancel and send buttons

### Requirement: Generic File Display in Chat
Received generic file messages SHALL be displayed in the chat with an extension-specific icon, the file extension label, the human-readable file size, and a download button. The display SHALL use styling consistent with other message content.

#### Scenario: Generic file message display
- **GIVEN** a message containing an encrypted generic file attachment
- **WHEN** the message is rendered in the chat view
- **THEN** the system SHALL display an icon based on the file's MIME type
- **AND** display the file extension derived from the MIME type (e.g., "PDF", "ZIP", "DOC")
- **AND** display the file size if available (e.g., "2.4 MB")
- **AND** display a download button

#### Scenario: Extension-specific icons
- **GIVEN** a generic file message with a known MIME type
- **WHEN** the file display is rendered
- **THEN** the icon SHALL match the file type:
  - PDF files: document icon with red accent
  - Archive files (ZIP, RAR, 7Z): archive box icon with yellow accent
  - Word documents (DOC, DOCX): document icon with blue accent
  - Excel spreadsheets (XLS, XLSX): grid icon with green accent
  - PowerPoint presentations (PPT, PPTX): slides icon with orange accent
  - Text files (TXT): plain document icon
  - Code files (HTML, CSS, JS, JSON): brackets icon with purple accent
  - Unknown types: generic document icon with gray accent

### Requirement: Generic File Download
When a user clicks the download button on a generic file message, the system SHALL decrypt the file on-the-fly and trigger a browser download. The downloaded file SHALL use a filename based on the file extension.

#### Scenario: Download encrypted generic file
- **GIVEN** a message containing an encrypted generic file attachment
- **AND** the user clicks the download button
- **WHEN** the download is initiated
- **THEN** the system SHALL fetch the encrypted file from the Blossom server
- **AND** decrypt the file using the stored AES-GCM key and nonce
- **AND** trigger a browser download with filename `file.<extension>` (e.g., `file.pdf`)

#### Scenario: Download shows decrypting state
- **GIVEN** a message containing an encrypted generic file attachment
- **WHEN** the user clicks the download button and decryption is in progress
- **THEN** the download button SHALL display a "Decrypting..." state
- **AND** the button SHALL be disabled until decryption completes

#### Scenario: Download from already-decrypted file
- **GIVEN** a generic file message whose content has already been decrypted (visible in viewport)
- **WHEN** the user clicks the download button
- **THEN** the download SHALL proceed immediately using the cached decrypted blob
- **AND** no additional network request or decryption SHALL occur
