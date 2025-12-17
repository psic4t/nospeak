# Change: Update media upload to Kind 15 with preview

## Why
Nospeak should send media as NIP-17 Kind 15 file messages instead of inserting media URLs into text messages, and it should give users a clear one-file-at-a-time preview with an optional caption that is represented as a separate text message. The current messaging spec still describes URL insertion behavior that no longer matches the desired encrypted file-centric model.

## What Changes
- Define a media preview modal / bottom sheet in the messaging spec that opens after selecting a single attachment.
- Update the Media Upload Support requirement so outgoing media from nospeak is represented as NIP-17 Kind 15 file messages, not bare URLs in Kind 14 text messages.
- Clarify that captions are sent as separate NIP-17 Kind 14 text messages, visually grouped under the corresponding file bubble.
- Preserve compatibility with legacy clients that send bare media URLs by clarifying display behavior rather than changing fallback semantics.

## Impact
- Affected specs: `messaging`
- Affected code: chat input media upload UI, NIP-17 send pipeline for Kind 14 and Kind 15, media rendering in message bubbles
