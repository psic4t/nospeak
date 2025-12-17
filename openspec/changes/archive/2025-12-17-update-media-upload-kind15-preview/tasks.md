## 1. Spec and design
- [x] 1.1 Draft messaging spec deltas for media preview, Kind 15-only sending, and caption behavior
- [x] 1.2 Review and approve this proposal and deltas

## 2. Messaging behavior changes
- [x] 2.1 Implement a single-file media preview modal/bottom sheet component wired to the chat input media menu
- [x] 2.2 Update the media send pipeline to upload files and send NIP-17 Kind 15 file messages instead of inserting media URLs into Kind 14 text messages
- [x] 2.3 When a caption is provided, send a separate NIP-17 Kind 14 text message and render it as a caption bubble below the file bubble
- [x] 2.4 Ensure existing rendering of incoming messages still supports legacy Kind 14 text messages that contain media URLs

## 3. Validation
- [ ] 3.1 Exercise media sending manually on desktop and mobile layouts to confirm preview, sending, and grouping behavior
- [x] 3.2 Run `npm run check` and `npx vitest run` to validate types and tests
- [ ] 3.3 Add or update tests for the messaging service and UI to cover Kind 15 sending and caption pairing behavior
