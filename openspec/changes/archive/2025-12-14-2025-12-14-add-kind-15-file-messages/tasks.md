## 1. Specification and Design
- [x] 1.1 Confirm NIP-17 Kind 15 interoperability expectations (including required tags and encryption fields) against the latest NIP text and target client implementations.
- [x] 1.2 Refine this proposal and design any additional details needed for mandatory AES-GCM file encryption, including key/nonce derivation, serialization, and storage in Kind 15 tags.

## 2. Core Messaging Pipeline
- [x] 2.1 Extend the DM send path in `src/lib/core/Messaging.ts` to construct unsigned Kind 15 rumors for attachments before sealing and gift-wrapping.
- [x] 2.2 Extend the DM receive path in `src/lib/core/Messaging.ts` to recognize Kind 15 rumors, extract file metadata from tags, and map them into the internal message model.
- [x] 2.3 Ensure reaction and history sync logic continue to behave correctly when conversations contain both Kind 14 and Kind 15 rumors.

## 3. Data Model and Storage
- [x] 3.1 Update the `Message` interface and Dexie schema in `src/lib/db/db.ts` to support file message metadata (URL, MIME type, size, hash, and rumor kind).
- [x] 3.2 Update `src/lib/db/MessageRepository.ts` to persist and query file messages without breaking existing text message behavior.
- [x] 3.3 Add or update tests around message persistence and retrieval for mixed text and file conversations.

## 4. UI and Upload Integration
- [x] 4.1 Update `MediaUploadButton.svelte` and related upload flows so that successful uploads can be sent as Kind 15 file messages instead of only injecting URLs into a text input.
- [x] 4.2 Update `ChatView.svelte` and `MessageContent.svelte` to render file messages based on stored metadata, ensuring a consistent visual treatment with existing media rendering.
- [x] 4.3 Ensure fallback behavior remains receive-only for incoming Kind 14 messages that include media URLs from other clients, while nospeak itself never sends new media attachments as Kind 14+URL.

## 5. File Encryption with AES-GCM
- [x] 5.1 Design and implement a minimal AES-GCM helper for encrypting and decrypting file blobs using WebCrypto.
- [x] 5.2 Ensure all new file uploads sent as Kind 15 messages are encrypted end-to-end with AES-GCM and never sent as plaintext blobs.
- [x] 5.3 Populate `encryption-algorithm`, `decryption-key`, and `decryption-nonce` tags for all nospeak-sent file messages, in line with NIP-17 and the Kind 15 messaging requirements.

## 6. Validation and Interoperability
- [x] 6.1 Add or extend unit tests for the messaging pipeline to cover Kind 15 send/receive flows, including malformed or partially tagged events.
- [x] 6.2 Manually test interoperability with at least one other NIP-17-capable client that supports Kind 15, verifying that nospeak-sent file messages render as expected and that nospeak correctly displays file messages from that client.
- [x] 6.3 Update project documentation or release notes to highlight Kind 15 file message support and any limitations or feature flags.
