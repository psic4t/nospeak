## Why

Users need to share arbitrary file types (PDFs, documents, archives, etc.) in encrypted NIP-17 conversations, not just images, videos, and audio. Currently, the media upload only supports media types, limiting the utility of secure file sharing.

## What Changes

- Add a "File" option to the media upload dropdown menu alongside existing Image, Video, and Audio options
- Support uploading any file type up to 10 MB with client-side encryption (same AES-GCM flow as media)
- Display generic files in chat with extension-specific icons, file extension label, size, and a download button
- Auto-detect media types: if user uploads an image/video/audio via the generic "File" picker, automatically switch to the corresponding existing media preview flow
- Decrypt-on-the-fly download: clicking download decrypts the file and triggers browser download

## Capabilities

### New Capabilities

- `generic-file-upload` - Ability to upload, send, receive, and download encrypted generic files in NIP-17 conversations

### Modified Capabilities

- `messaging` - Extend media upload support to include generic files with file type detection and size validation

## Impact

- **Affected specs**: `messaging/spec.md` (media upload requirements), new `generic-file-upload/spec.md`
- **Affected code**:
  - `src/lib/components/FileTypeDropdown.svelte` - Add "File" option
  - `src/lib/components/MediaUploadButton.svelte` - File type detection, size validation
  - `src/lib/components/ChatView.svelte` - Handle 'file' media type
  - `src/lib/components/AttachmentPreviewModal.svelte` - Generic file preview
  - `src/lib/components/MessageContent.svelte` - Render generic file display
  - `src/lib/core/Messaging.ts` - Support 'file' media type in send flow
  - New component: `src/lib/components/GenericFileDisplay.svelte`
  - New utility: `src/lib/utils/fileIcons.ts`
- **i18n**: New translation keys for file menu option, size error, download states
