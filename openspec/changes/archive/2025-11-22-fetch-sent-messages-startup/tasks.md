## 1. Implementation
- [x] 1.1 Update `SendChatMessage` in `client/messaging.go` to send a second gift wrap to self (user's npub).
    - Use `CreateGiftWrap` with user's own pubkey as recipient.
    - Publish to user's own write relays.
- [x] 1.2 Add `FetchSentMessages` method to `Client` in `client/messaging.go`.
    - Query Kind 1059 (Authors=me, p=me).
- [x] 1.3 Implement decryption logic for self-sent Kind 1059 messages.
- [x] 1.4 Update `tui/app.go` `loadChatHistory` to call `FetchSentMessages` if local history is empty.
- [x] 1.5 Add unit tests for new sending and fetching logic.
