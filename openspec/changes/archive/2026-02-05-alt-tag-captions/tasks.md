## 1. Sending Side

- [x] 1.1 Add `caption?: string` parameter to `sendFileMessage` in `Messaging.ts`
- [x] 1.2 Add `['alt', caption]` tag to kind 15 event tags when caption is provided
- [x] 1.3 Store caption in `messageDbFields.message` instead of empty string
- [x] 1.4 Add `caption?: string` parameter to `sendGroupFileMessage` in `Messaging.ts`
- [x] 1.5 Add `['alt', caption]` tag to group file message when caption is provided
- [x] 1.6 Store caption in group message `messageDbFields.message`

## 2. Receiving Side

- [x] 2.1 Extract `alt` tag when processing kind 15 messages in `createMessageFromRumor`
- [x] 2.2 Store `alt` tag value in `message` field instead of empty string

## 3. ChatView Sending Flow

- [x] 3.1 Pass caption directly to `sendFileMessage` instead of sending separate message
- [x] 3.2 Remove the separate `sendMessage` call for captions after file upload

## 4. ChatView Rendering

- [x] 4.1 Remove `isCaptionMessage` and `getCaptionForParent` imports
- [x] 4.2 Remove `caption` and `captionForThis` const declarations
- [x] 4.3 Remove `{#if !caption}` wrapper from message rendering
- [x] 4.4 Replace `{#if captionForThis}` with check for `msg.rumorKind === 15 && msg.message`
- [x] 4.5 Display `msg.message` for kind 15 messages with same styling

## 5. Cleanup

- [x] 5.1 Delete `src/lib/core/captionGrouping.ts`
- [x] 5.2 Delete `src/lib/core/captionGrouping.test.ts`
- [x] 5.3 Simplify `chatHistorySearch.ts` to remove caption-parent grouping logic
- [x] 5.4 Update `chatHistorySearch.test.ts` to remove caption-specific tests

## 6. Validation

- [x] 6.1 Run `npm run check` and fix any type errors
- [x] 6.2 Run `npx vitest run` and fix any test failures
