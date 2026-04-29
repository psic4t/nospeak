# Change: Cover all voice-call outcomes in chat-history pills

## Why
Today the chat-history call pill (rendered for `rumorKind === 16` events in `CallEventMessage.svelte`) only ever surfaces two real outcomes — `Missed voice call` and `Voice call ended`. There is also a caller-side `Outgoing voice call` pill emitted on offer-timeout, and a dead `Incoming voice call` branch in the renderer that is never authored.

Several real call outcomes leave **no record at all** in chat history today:
- The callee declined the call.
- The callee was busy on another call.
- The WebRTC ICE connection failed.
- The caller cancelled the outgoing call before the callee picked up but after the offer was sent.

This is confusing — a call attempt that didn't connect leaves no audit trail. We want every terminal call state to produce exactly one chat-history pill on each side, with role-aware copy where it matters (the wording for "I declined them" vs "they declined me" should differ).

## What Changes

### Persisted call-event types
The `Message.callEventType` union becomes `'missed' | 'ended' | 'no-answer' | 'declined' | 'busy' | 'failed' | 'cancelled'` (7 values). A single `'declined'` covers both directions; the renderer picks role-aware copy at display time. An optional `Message.callId` field is added.

### Authoring side and delivery mode per type

| `call-event-type` | Authored by | Delivery | Triggered when |
|---|---|---|---|
| `ended` | hangup initiator (active call) | gift-wrapped to peer + self-wrap | active call terminated |
| `missed` | callee | **local-only (no peer delivery)** | caller hangs up while callee `incoming-ringing` |
| `cancelled` | caller | **local-only (no peer delivery)** | caller hangs up while `outgoing-ringing` |
| `no-answer` | caller | gift-wrapped to peer + self-wrap | 60 s offer timeout |
| `declined` | callee | gift-wrapped to peer + self-wrap | callee invokes decline action |
| `busy` | caller | gift-wrapped to peer + self-wrap | caller receives `busy` signal |
| `failed` | caller (only) | gift-wrapped to peer + self-wrap | ICE failure on caller side |

Local-only delivery means the rumor is saved to the local message DB but no gift-wrap is published — the peer SHALL NOT receive that rumor. This is the right shape for `cancelled` and `missed` because each side observes a different reality (caller observes "I cancelled it"; callee observes "I missed it"), and gift-wrapping either rumor to both peers would produce duplicate pills with conflicting wording.

### Role-aware rendering
For asymmetric outcomes (`declined`, `busy`, `no-answer`), the renderer compares the rumor's `call-initiator` tag against the local user's pubkey to determine the local user's role for that call, then picks the appropriate copy:

- `declined` × initiator: `Call declined`. × callee: `Declined`.
- `busy` × initiator: `User busy`. × callee: `Missed voice call (busy)`.
- `no-answer` × initiator: `No answer`. × callee: `Missed voice call`.

For symmetric outcomes (`ended`, `failed`) both roles render the same copy. For local-only outcomes (`missed`, `cancelled`) only the authoring side ever has a row, so role disambiguation is unnecessary.

The `call-initiator` tag SHALL contain the **WebRTC call initiator's** pubkey (the side that originally invoked `voiceCallService.initiateCall`), not the rumor author's pubkey. This matters when the author and the initiator are different peers — most importantly for `declined` (callee authors, but caller is the initiator) and `missed` (callee authors, but caller is the initiator).

### Native Android lockscreen decline path
When the user taps the Decline action on the Android lockscreen full-screen-intent notification (`IncomingCallActionReceiver`), the JavaScript layer is not running and `voiceCallService.declineCall()` cannot be invoked. The native Java layer SHALL author and publish the Kind 16 `declined` rumor directly through the existing NIP-17 gift-wrap pipeline (mirroring the `sendVoiceCallReject` Java path), with the caller's pubkey as both the recipient (`p` tag) and the initiator (`call-initiator` tag), gift-wrapped to both the caller AND the local user (self-wrap). When the JS layer next runs, the self-wrap delivers the rumor through the standard NIP-17 receive path and it lands in the local message DB.

### Mechanism additions
- `Messaging.createCallEventMessage` accepts the new union and an optional `callId`; the rumor carries an additional `['call-id', callId]` tag.
- A new `Messaging.createLocalCallEventMessage` builds a Kind 16 rumor identical in structure to the gift-wrapped variant but persists it to the local DB only — no relay publish, no self-wrap.
- `VoiceCallService` gains a `registerLocalCallEventCreator` callback to access the local-only path; `cancelled` and `missed` author through that callback.
- The renderer subscribes to `$lib/stores/auth.currentUser` to compute `iAmInitiator = message.callInitiatorNpub === currentUser.npub`.

## Impact
- Affected specs: `voice-calling`
- Affected code:
  - `src/lib/db/db.ts` — `callEventType` union (7 values + 2 legacy aliases retained); new optional `callId`
  - `src/lib/core/Messaging.ts` — `createCallEventMessage` and `createLocalCallEventMessage` accept an optional `initiatorPubkey` (defaults to local user)
  - `src/lib/core/voiceCall/VoiceCallService.ts` — new authoring sites; new local-only authoring path; `isInitiator` flag for caller-only `failed`; callee-authored types pass `state.peerNpub` as the initiator
  - `src/lib/components/CallEventMessage.svelte` — role-aware rendering using `currentUser`
  - `src/lib/components/CallEventMessage.test.ts` — coverage per state and role
  - `src/lib/core/voiceCall/VoiceCallService.test.ts` — coverage per authoring path including initiator-tag plumbing
  - `src/lib/i18n/locales/en.ts` — new `voiceCall.pill.*` keys with role-suffixed pairs for asymmetric outcomes
  - `android/app/src/main/java/com/nospeak/app/NativeBackgroundMessagingService.java` — new `sendVoiceCallDeclinedEvent` Java method authoring a Kind 16 `declined` rumor and gift-wrapping it to both the caller and self
  - `android/app/src/main/java/com/nospeak/app/IncomingCallActionReceiver.java` — invokes `sendVoiceCallDeclinedEvent` after `sendVoiceCallReject`
- Backwards compatibility: legacy `'outgoing'` and `'incoming'` rows from any prior schema fall through to the generic `Voice call` label. The interim `'declined-outgoing'`/`'declined-incoming'` types from the unmerged earlier iteration of this same change are dropped without alias.
