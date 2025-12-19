## 1. Spec / Proposal
- [x] 1.1 Validate proposal scope against existing unread dot behavior
- [x] 1.2 Ensure delta spec scenarios cover: messages, reactions, badge, clearing rules

## 2. Storage + Badge plumbing
- [x] 2.1 Add per-user unread storage manager (localStorage)
- [x] 2.2 Add safe Badging API integration (`setAppBadge`/`clearAppBadge`)
- [x] 2.3 Add startup badge sync after auth restore

## 3. Messaging integration
- [x] 3.1 Mark incoming received messages unread when not seen
- [x] 3.2 Mark incoming reactions unread when not seen
- [x] 3.3 Ensure first-time sync does not create unread markers
- [x] 3.4 Deduplicate unread entries by event ID

## 4. UI integration
- [x] 4.1 Render subtle left accent for unread message IDs on chat open
- [x] 4.2 Clear stored unread state for chat after opening
- [x] 4.3 Clear unread markers for chat on send
- [x] 4.4 Render ephemeral accent for new messages while actively viewing chat
- [x] 4.5 Clear ephemeral highlights on blur/visibilitychange and on send

## 5. Validation
- [x] 5.1 Unit tests for unread storage manager (parse, versioning, dedupe, clear)
- [x] 5.2 Unit tests for badge syncing behavior (feature-detect + error swallowing)
- [x] 5.3 Run `npm run check`
- [x] 5.4 Run `npx vitest run`
