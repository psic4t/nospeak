## 1. Spec / Proposal
- [x] 1.1 Confirm success criteria: recipient relay ack >= 1
- [x] 1.2 Confirm rollback behavior for text + media
- [x] 1.3 Validate proposal against existing messaging spec

## 2. Messaging send confirmation
- [x] 2.1 Add publish-with-deadline helper (5s)
- [x] 2.2 Update `sendMessage` to fail on 0 acks
- [x] 2.3 Update `sendFileMessage` to fail on 0 acks
- [x] 2.4 Preserve `sent to x/x relays` status updates after success

## 3. Optimistic chat UI
- [x] 3.1 Add optimistic message bubble for text send
- [x] 3.2 Add optimistic message bubble for media send
- [x] 3.3 Restore input text on send failure
- [x] 3.4 Restore media preview state on send failure
- [x] 3.5 Ensure only latest outgoing shows status

## 4. Attachment rendering support
- [x] 4.1 Render non-encrypted `fileUrl` attachments for optimistic media bubbles

## 5. Validation
- [x] 5.1 Unit tests for publish-with-deadline success/failure
- [x] 5.2 Unit tests for sendMessage/sendFileMessage failure semantics
- [x] 5.3 Run `npm run check`
- [x] 5.4 Run `npx vitest run`
