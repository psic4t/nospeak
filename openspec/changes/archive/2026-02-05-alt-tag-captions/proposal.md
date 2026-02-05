## Why

File message captions are currently implemented using a two-message approach: a kind 15 file message followed by a separate kind 14 text message with an `['e', parentRumorId]` reference. This is unnecessarily complex. The Nostr protocol's NIP-31 `alt` tag provides a simpler, more standard solution - embedding the caption directly in the kind 15 file message as `['alt', caption]`.

## What Changes

- Add `['alt', caption]` tag to kind 15 file messages when a caption is provided
- Extract `alt` tag from received kind 15 messages and store in the `message` field
- Pass caption directly to `sendFileMessage` instead of sending a separate message
- Display `msg.message` below media for kind 15 messages (same styling as before)
- **BREAKING**: Remove two-message caption grouping logic - old caption messages will appear as regular text messages
- Delete `captionGrouping.ts` and its tests
- Simplify `chatHistorySearch.ts` to remove caption-parent grouping logic

## Capabilities

### New Capabilities

(none - this is a simplification of existing functionality)

### Modified Capabilities

- `file-messaging`: Caption handling changes from two-message approach to single `alt` tag

## Impact

- **Messaging.ts**: Modified to add/extract `alt` tag, accept caption parameter
- **ChatView.svelte**: Simplified sending and rendering, removes captionGrouping imports
- **chatHistorySearch.ts**: Simplified search logic (no longer needs caption-parent grouping)
- **Backward compatibility**: Old caption messages (kind 14 with parentRumorId) will appear as standalone text messages
- **Interoperability**: Better compatibility with other clients like Amethyst that use the `alt` tag approach
