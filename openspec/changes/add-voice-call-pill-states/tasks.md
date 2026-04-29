## 1. Data model
- [x] 1.1 Set `Message.callEventType` union in `src/lib/db/db.ts` to `'missed' | 'ended' | 'no-answer' | 'declined' | 'busy' | 'failed' | 'cancelled'` (7 values), plus the legacy aliases `'outgoing'` and `'incoming'` for forward-compat readback. Add optional `Message.callId`.

## 2. Rumor authoring
- [x] 2.1 Update `Messaging.createCallEventMessage` signature to accept the 7-value union and an optional `callId`; emit `['call-id', callId]` tag and persist `callId` to the message DB row.
- [x] 2.2 Add `Messaging.createLocalCallEventMessage` that builds the same Kind 16 rumor structure but saves directly to `messageRepo` without gift-wrap publish or self-wrap. Used for `cancelled` and `missed`.
- [x] 2.3 Parse the `['call-id', ...]` tag on receive (`Messaging.processGiftWrap` Kind 16 branch).

## 3. State machine
- [x] 3.1 Update `VoiceCallService.AuthoredCallEventType` to the 7-value union.
- [x] 3.2 Add `localCreateCallEventFn` field, `registerLocalCallEventCreator` setter, and a private `createLocalCallEvent` mirror of `createCallEvent`.
- [x] 3.3 Track an `isInitiator` flag on the service; set in `initiateCall`, reset on cleanup.
- [x] 3.4 `hangup()` while `outgoing-ringing`: author `'cancelled'` via local-only path.
- [x] 3.5 `hangup()` while `active`: author `'ended'` via gift-wrapped path (regression-preserving).
- [x] 3.6 Offer-timeout: author `'no-answer'` via gift-wrapped path.
- [x] 3.7 `declineCall`: author `'declined'` via gift-wrapped path.
- [x] 3.8 `handleReject`: cleanup + endCall only — NO authoring (the callee already authored `'declined'`).
- [x] 3.9 `handleBusy`: author `'busy'` via gift-wrapped path.
- [x] 3.10 ICE failure: author `'failed'` via gift-wrapped path, gated on `isInitiator === true`.
- [x] 3.11 `handleHangup` while `incoming-ringing`: author `'missed'` via local-only path.

## 4. Renderer & i18n
- [x] 4.1 Replace `voiceCall.pill.*` keys in `src/lib/i18n/locales/en.ts` with the role-suffixed set: `missed`, `ended`, `endedWithDuration`, `noAnswerByPeer`, `noAnswerMe`, `declinedByPeer`, `declinedByMe`, `busyByPeer`, `busyMe`, `failed`, `cancelled`, `generic`.
- [x] 4.2 Update `CallEventMessage.svelte` to subscribe to `$currentUser`, compute `iAmInitiator = message.callInitiatorNpub === $currentUser?.npub`, and pick role-aware copy for `declined`/`busy`/`no-answer`. Symmetric copy for `ended`/`failed`. Legacy values fall through to `generic`.
- [x] 4.3 Icon coloring: green for `ended`, red strikethrough for every other terminal state.

## 5. Tests
- [x] 5.1 Update `CallEventMessage.test.ts`: mirror takes `iAmInitiator` parameter; coverage for both roles per asymmetric type plus legacy values.
- [x] 5.2 Update `VoiceCallService.test.ts`:
  - `declineCall` authors `'declined'` via the gift-wrapped fn.
  - `handleReject` does NOT call any authoring fn.
  - `hangup()` while `outgoing-ringing` authors `'cancelled'` via the local-only fn.
  - `handleHangup` while `incoming-ringing` authors `'missed'` via the local-only fn.
  - Existing tests for `busy`, `no-answer`, `failed` (initiator only), `failed` (callee no-author), and `ended` updated to use new fn names where needed.

## 6. Initiator semantics
- [x] 6.1 Extend `Messaging.createCallEventMessage` to accept an optional `initiatorNpub` (bech32). Default to the local user's npub when omitted.
- [x] 6.2 Extend `Messaging.createLocalCallEventMessage` similarly.
- [x] 6.3 Update `VoiceCallService` so callee-authored rumors (`declined` from `declineCall`, `missed` from `handleHangup`) pass `state.peerNpub` (= the caller) as the initiator. Caller-authored types continue to default to the local user. `ended` authored by a non-initiator hangup also passes `peerNpub`.
- [x] 6.4 Update `VoiceCallService.test.ts` to assert that `declined` is authored with `state.peerNpub` as the initiator and `missed` likewise.

## 7. Native Android decline → Kind 16 'declined' authoring
- [x] 7.1 Add `sendVoiceCallDeclinedEvent(callerPubkeyHex, callId)` to `NativeBackgroundMessagingService` mirroring `sendVoiceCallReject` but producing a Kind 16 rumor with tags `['p', caller]`, `['type','call-event']`, `['call-event-type','declined']`, `['call-initiator', caller]`, `['call-id', callId]` and gift-wrapping to BOTH the caller and the local user (self-wrap). No NIP-40 expiration tag (call-history rumors are persistent).
- [x] 7.2 In `IncomingCallActionReceiver.onReceive`, after `sendVoiceCallReject` invoke `sendVoiceCallDeclinedEvent` on the same background thread (best-effort, swallow exceptions).

## 8. Validation
- [x] 8.1 `npm run check`
- [x] 8.2 `npx vitest run`
- [x] 8.3 `openspec validate add-voice-call-pill-states --strict`
