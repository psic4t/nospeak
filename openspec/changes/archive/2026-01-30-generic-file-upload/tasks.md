## 1. Utilities and Icons

- [x] 1.1 Create `src/lib/utils/fileIcons.ts` with `getFileIconInfo(mimeType)`, `getFileExtension(mimeType)`, and `formatFileSize(bytes)` functions
- [x] 1.2 Define SVG icons for PDF, ZIP/archive, DOC, XLS, PPT, TXT, code, and generic file types
- [x] 1.3 Add file type detection utility `detectMediaType(file: File)` that checks MIME and extension

## 2. UI Components - Upload Flow

- [x] 2.1 Update `FileTypeDropdown.svelte` - add "File" option with paperclip icon, update type union to include `'file'`
- [x] 2.2 Update `MediaUploadButton.svelte` - handle `type === 'file'` with `accept="*/*"`, add 10 MB validation, add auto-detection logic to route media files
- [x] 2.3 Update `AttachmentPreviewModal.svelte` - add `mediaType === 'file'` rendering branch showing icon and size

## 3. UI Components - Display Flow

- [x] 3.1 Create `GenericFileDisplay.svelte` component with icon, extension label, size, and download button
- [x] 3.2 Update `MessageContent.svelte` - detect generic files and render `GenericFileDisplay` component
- [x] 3.3 Implement download trigger in `GenericFileDisplay` using decrypted blob URL

## 4. Core Messaging

- [x] 4.1 Update `Messaging.ts` - extend `sendFileMessage` to accept `'file'` type
- [x] 4.2 Update `mediaTypeToMime` to return `'application/octet-stream'` for `'file'` type
- [x] 4.3 Update `ChatView.svelte` - handle `'file'` type in `handleFileSelect`, `openMediaPreview`, and `confirmSendMedia`

## 5. Internationalization

- [x] 5.1 Add i18n keys to `en.ts`: `chat.mediaMenu.file`, `chat.fileUpload.fileTooLarge`, `chat.fileUpload.download`, `chat.fileUpload.decrypting`
- [x] 5.2 Add translations to `de.ts`, `es.ts`, `fr.ts`, `it.ts`, `pt.ts`

## 6. Validation

- [x] 6.1 Run `npm run check` and fix any TypeScript errors
- [x] 6.2 Run `npx vitest run` and fix any failing tests
- [x] 6.3 Manual test: upload generic file, verify preview, send, receive, and download
