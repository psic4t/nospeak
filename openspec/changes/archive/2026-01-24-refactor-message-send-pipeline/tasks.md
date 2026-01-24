## 1. Define SendEnvelopeParams interface and sendEnvelope skeleton
- [x] 1.1 Define `SendEnvelopeParams` interface in `Messaging.ts` with fields: `recipients: string[]`, `rumor: UnsignedEvent`, `conversationId?: string`, `messageDbFields?: Partial<Message>`
- [x] 1.2 Create empty `private async sendEnvelope(params: SendEnvelopeParams): Promise<string>` method
- [x] 1.3 Implement auth check (get signer, senderPubkey, senderNpub)
- [x] 1.4 Implement recipient pubkey decoding from npub list
- [x] 1.5 Implement relay discovery: single `getMessagingRelays` for DM, per-participant loop for groups
- [x] 1.6 Implement temporary relay connection setup + 15s cleanup timer
- [x] 1.7 Implement rumorId computation via `getEventHash()`
- [x] 1.8 Implement per-recipient gift-wrap creation + `publishWithDeadline` + retry queue enrollment
- [x] 1.9 Implement self-wrap creation + publish to sender relays
- [x] 1.10 Implement DB save via `messageRepo.saveMessage()` with `messageDbFields` merge
- [x] 1.11 Implement post-send hooks: `autoAddContact` for DM, `markActivity` for group
- [x] 1.12 Run `npm run check` — zero errors

## 2. Migrate text message functions
- [x] 2.1 Refactor `sendMessage` to build Kind 14 rumor then call `sendEnvelope()`
- [x] 2.2 Refactor `sendGroupMessage` to build Kind 14 rumor (multi p-tags + optional subject) then call `sendEnvelope()`
- [x] 2.3 Remove the `sendMessage` → `sendGroupMessage` delegation (both call `sendEnvelope` directly)
- [x] 2.4 Run `npx vitest run` — all MessagingService tests pass

## 3. Migrate file message functions
- [x] 3.1 Refactor `sendFileMessage` to encrypt+upload then build Kind 15 rumor then call `sendEnvelope()` with file DB fields
- [x] 3.2 Refactor `sendGroupFileMessage` to same pattern (now gets `publishWithDeadline` — bug fix)
- [x] 3.3 Run `npx vitest run` — all tests pass

## 4. Migrate location message functions
- [x] 4.1 Refactor `sendLocationMessage` to build Kind 14 rumor with location tags then call `sendEnvelope()`
- [x] 4.2 Refactor `sendGroupLocationMessage` to same pattern
- [x] 4.3 Run `npx vitest run` — all tests pass

## 5. Migrate reaction functions
- [x] 5.1 Refactor `sendReaction` to build Kind 7 rumor then call `sendEnvelope()`
- [x] 5.2 Refactor `sendGroupReaction` to same pattern
- [x] 5.3 Run `npx vitest run` — all tests pass

## 6. Cleanup and validation
- [x] 6.1 Remove any dead helper code that was only used by the old function bodies
- [x] 6.2 Run `npm run check` — zero errors, zero warnings
- [x] 6.3 Run `npx vitest run` — all 245 tests pass
- [x] 6.4 Verify net line reduction is in the expected range (~414 lines removed)
