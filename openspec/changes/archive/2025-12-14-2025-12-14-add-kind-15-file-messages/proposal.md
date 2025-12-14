# Change: Add proper NIP-17 Kind 15 file message support

## Why
Current encrypted DM implementation only treats media as plain URLs inside Kind 14 chat rumors and does not distinguish file messages from text, nor does it model NIP-17/NIP-17 Kind 15 semantics (file metadata, encryption fields) in the specs. This leads to ambiguity around how attachments should be represented on the wire, makes it harder to interoperate with other NIP-17 clients, and prevents us from evolving towards end-to-end encrypted file delivery.

## What Changes
- Specify how nospeak will represent NIP-17 file messages as unsigned Kind 15 rumors wrapped in the existing NIP-59 seal/gift-wrap pipeline.
- Define minimal file message metadata (MIME type, size, hashes, and upload URL) that MUST be carried in Kind 15 tags for interoperability.
- Clarify the relationship between UI media uploads, the existing HTTPS upload endpoint, and the NIP-17 file message envelope so that file messages are no longer indistinguishable from plain-text messages.
- Require all nospeak-sent file attachments in encrypted DMs to use AES-GCM-encrypted payloads stored via the same upload endpoint, with keys and nonces carried in Kind 15 tags instead of treating media as plaintext URLs inside Kind 14 rumors.

## Impact
- Affected specs: `messaging` (DM pipeline, media messages, interoperability with other NIP-17 clients).
- Affected code (future implementation work):
  - `src/lib/core/Messaging.ts` (rumor creation/parsing for Kind 15, storage mapping).
  - `src/lib/components/ChatView.svelte`, `src/lib/components/MediaUploadButton.svelte`, `src/lib/components/MessageContent.svelte` (sending and rendering file messages).
  - `src/lib/db/db.ts`, `src/lib/db/MessageRepository.ts` (message model extensions for file metadata).
  - Potential WebCrypto-based AES-GCM helper utilities for encrypting/decrypting file blobs before/after upload.
