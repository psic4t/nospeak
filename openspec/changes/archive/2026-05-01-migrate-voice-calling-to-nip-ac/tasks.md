## 1. Constants and types

- [x] 1.1 In `src/lib/core/voiceCall/constants.ts`, add `NIP_AC_GIFT_WRAP_KIND = 21059`, `NIP_AC_KIND_OFFER = 25050`, `NIP_AC_KIND_ANSWER = 25051`, `NIP_AC_KIND_ICE = 25052`, `NIP_AC_KIND_HANGUP = 25053`, `NIP_AC_KIND_REJECT = 25054`, `NIP_AC_STALENESS_SECONDS = 60`. Remove `CALL_SIGNAL_TYPE` and `CALL_SIGNAL_EXPIRATION_SECONDS`.
- [x] 1.2 In `src/lib/core/voiceCall/types.ts`, replace `VoiceCallSignal` with a kind-discriminated union (`{kind: 25050, callId, sdp, callType}`, `{kind: 25051, callId, sdp}`, `{kind: 25052, callId, candidate, sdpMid, sdpMLineIndex}`, `{kind: 25053, callId, reason?}`, `{kind: 25054, callId, reason?}`). Add `'answered-elsewhere'` and `'rejected-elsewhere'` to `VoiceCallEndReason`.
- [x] 1.3 Run `npx vitest run` to confirm no preexisting test files reference removed constants without being updated; document any breakage to fix in step 11.

## 2. NIP-AC gift-wrap helper (TypeScript)

- [x] 2.1 In `src/lib/core/Messaging.ts`, add `createNipAcGiftWrap(signedInnerEvent: NostrEvent, recipientPubkey: string): NostrEvent` that NIP-44-v2 encrypts the signed inner event JSON to the recipient using a freshly generated ephemeral key, finalizes a kind 21059 wrap with a single `['p', recipientPubkey]` tag and no `expiration`, and returns it.
- [x] 2.2 In `src/lib/core/Messaging.ts`, add `unwrapNipAcGiftWrap(wrap: NostrEvent): NostrEvent | null` that decrypts the wrap with the local signer, parses the inner JSON, calls `verifyEvent` on the inner event, and returns the inner event or `null` on failure.
- [x] 2.3 Add unit test file `src/lib/core/Messaging.nipAcGiftWrap.test.ts` covering NIP-AC test vectors W1, W3, W4, W5, W6, W12, W13, W14, W15, W16, W17, plus W2 (third-party-cannot-decrypt). Each test signs a fixture inner event of the relevant kind, wraps it, unwraps it, and asserts the round-tripped event matches and the wrap pubkey differs from the inner pubkey.

## 3. Typed send helpers

- [x] 3.1 In `src/lib/core/Messaging.ts`, add `sendCallOffer(recipientNpub, callId, sdp)` which builds a kind-25050 inner event with tags `['p', recipientHex], ['call-id', callId], ['call-type', 'voice'], ['alt', 'WebRTC call offer']`, signs it with the user's signer, wraps via `createNipAcGiftWrap`, and publishes to connected recipient relays with the existing 5s deadline.
- [x] 3.2 Add `sendCallAnswer(recipientNpub, callId, sdp)` analogous to 3.1 with kind 25051, no `call-type` tag, alt `'WebRTC call answer'`, AND publish a second self-wrap addressed to the sender's own pubkey on the sender's connected relays.
- [x] 3.3 Add `sendIceCandidate(recipientNpub, callId, candidatePayload: {candidate, sdpMid, sdpMLineIndex})` which builds a kind-25052 inner event with `content = JSON.stringify(candidatePayload)`, alt `'WebRTC ICE candidate'`, signs and wraps. No self-wrap. Fire-and-forget publish (do not await).
- [x] 3.4 Add `sendCallHangup(recipientNpub, callId, reason?)` with kind 25053, alt `'WebRTC call hangup'`, content `reason ?? ''`. No self-wrap.
- [x] 3.5 Add `sendCallReject(recipientNpub, callId, reason?)` with kind 25054, alt `'WebRTC call rejection'`, content `reason ?? ''`. AND publish a self-wrap addressed to the sender's own pubkey.
- [x] 3.6 Remove `sendVoiceCallSignal` and any callsites (replaced by 3.1–3.5). Keep `getVoiceCallRelays` and the 60s relay cache untouched.

## 4. Receive path (kind 21059 dispatch)

- [x] 4.1 In `src/lib/core/Messaging.ts`, add a kind-21059 branch to the gift-wrap receive handler that calls `unwrapNipAcGiftWrap`. On null, log and return.
- [x] 4.2 Implement the staleness check: compute `now - inner.created_at`; if `> NIP_AC_STALENESS_SECONDS`, log debug and return.
- [x] 4.3 Add a processed-event-ID ring buffer (256-entry FIFO Set, e.g. `Map`-based LRU). On receive, if `inner.id` is present, drop. Otherwise insert and continue.
- [x] 4.4 Implement the self-event filter per the "NIP-AC Self-Event Filter" requirement. On a self-addressed kind-25051 or kind-25054 in `incoming-ringing` with matching `call-id`, call new `voiceCallService.handleSelfAnswer(inner)` / `handleSelfReject(inner)` entry points.
- [x] 4.5 Implement follow-gating for kind 25050: read the user's NIP-02 contact list from the existing follows store; drop the offer silently if sender is not in the list, OR if the contact list has not been loaded yet in the current session.
- [x] 4.6 Dispatch surviving inner events to `voiceCallService.handleNipAcEvent(inner)`.
- [x] 4.7 Remove the legacy receive-path code that routes kind-14 rumors with `['type','voice-call']` to the voice service. Legacy rumors are dropped silently (no log spam, no UX hint).
- [x] 4.8 Update the gift-wrap subscription filter so the JS layer subscribes to both kind 1059 (chat, history) and kind 21059 (NIP-AC signaling).

## 5. VoiceCallService rewiring

- [x] 5.1 In `src/lib/core/voiceCall/VoiceCallService.ts`, replace `handleSignal(content: string)` with `handleNipAcEvent(event: NostrEvent)` that switches on `event.kind` and routes to private handlers.
- [x] 5.2 Implement `handleOffer`, `handleAnswer`, `handleIceCandidate`, `handleHangup`, `handleReject` reading `call-id`, `call-type` from event tags and SDP/JSON from `event.content`. Preserve the existing single-call enforcement, duplicate-offer dedup by `callId`, and busy auto-reject (now kind-25054 content `"busy"`).
- [x] 5.3 Add public methods `handleSelfAnswer(event)` and `handleSelfReject(event)` that, when local status is `incoming-ringing` and `call-id` matches, call new store reducers `setEndedAnsweredElsewhere` / `setEndedRejectedElsewhere`, stop ringtones, and on Android invoke `AndroidVoiceCall.dismissIncomingCall(callId)`.
- [x] 5.4 Remove `isVoiceCallSignal`, `parseSignal`, and the `CALL_SIGNAL_TYPE` import.
- [x] 5.5 Update internal calls to use the new typed send helpers from §3 (e.g. `this.sendSignalFn` is replaced by typed senders or a kind-discriminated dispatcher).
- [x] 5.6 In `src/lib/stores/voiceCall.ts`, add `setEndedAnsweredElsewhere(peerNpub, callId)` and `setEndedRejectedElsewhere(peerNpub, callId)` reducers that transition the store to `ended` with the new reasons, preserving `peerNpub` and `callId` for UI display.

## 6. ICE candidate buffering

- [x] 6.1 Add fields to `VoiceCallService`: `private globalIceBuffer = new Map<string /*senderHex*/, RTCIceCandidateInit[]>()`, `private sessionPendingIce: RTCIceCandidateInit[] = []`, `private sessionRemoteDescriptionSet = false`.
- [x] 6.2 Modify `handleIceCandidate(event)`: if `peerConnection === null` → push to `globalIceBuffer.get(senderHex)`. Else if `!sessionRemoteDescriptionSet` → push to `sessionPendingIce`. Else → `peerConnection.addIceCandidate(parsed)`.
- [x] 6.3 In `createPeerConnection(peerHex)`, drain `globalIceBuffer.get(peerHex)` into `sessionPendingIce` and delete the global entry.
- [x] 6.4 Wrap each `peerConnection.setRemoteDescription(...)` callsite so that on resolve, set `sessionRemoteDescriptionSet = true`, then `for (const c of sessionPendingIce) await peerConnection.addIceCandidate(c)`, then `sessionPendingIce = []`.
- [x] 6.5 In `cleanup()`, clear both buffers and reset `sessionRemoteDescriptionSet = false`.
- [x] 6.6 Add `src/lib/core/voiceCall/VoiceCallService.iceBuffer.test.ts` covering NIP-AC test vectors B1, B2, B3, B4, B5, B6, B7, B8, B9, B10, B11. Mock `RTCPeerConnection.addIceCandidate` and `setRemoteDescription` to assert call order and arguments.

## 7. Follow-gate test coverage (TS)

- [x] 7.1 Create `src/lib/core/Messaging.followGate.test.ts` with three tests: (a) offer from followed pubkey reaches `voiceCallService.handleNipAcEvent`; (b) offer from non-followed pubkey is dropped silently; (c) offer received before contact list loads is dropped silently.

## 8. Android native NIP-AC path

- [x] 8.1 In `android/app/src/main/java/com/nospeak/app/NativeBackgroundMessagingService.java`, add Java methods `createNipAcGiftWrap(senderPriv, recipientPubHex, signedInnerEventJson)` and `parseNipAcGiftWrap(wrap)` mirroring §2.
- [x] 8.2 Update the relay subscription filter from `kinds:[1059] #p:[me]` to `kinds:[1059, 21059] #p:[me]`. Add a top-level branch on wrap kind that routes 21059 to a new `handleNipAcCallEvent` method.
- [x] 8.3 Implement `handleNipAcCallEvent` to: verify the inner signature; apply the 60s `created_at` staleness check; apply the follow-gate (read NIP-02 contact list from local storage / SharedPreferences); for kind 25050, persist `{callId, sdp, peerHex, callType, alt, innerEventId, createdAt}` to `nospeak_pending_incoming_call` and post the FSI notification on `nospeak_voice_call_incoming`; for any other kind, discard.
- [x] 8.4 Replace `sendVoiceCallReject` with `sendCallReject(callId, peerHex)` which builds a signed kind-25054 with the new tag schema, wraps to the peer, AND publishes a self-wrap addressed to the user's own pubkey.
- [x] 8.5 In `IncomingCallActionReceiver.java`, update the Decline path to call the new `sendCallReject` method (best-effort).
- [x] 8.6 In `AndroidVoiceCallPlugin.java`, expose a new `dismissIncomingCall(callId: string)` method that cancels the FSI notification, finishes `IncomingCallActivity` if it is showing, and stops the ringer foreground service.
- [x] 8.7 Update `nospeak_pending_incoming_call` write/read code to use the new schema. Add a one-line guard on read: if any of `callType`, `alt`, `innerEventId`, `createdAt` is missing, treat as missing and clear the slot.
- [x] 8.8 Add at least one JVM unit test for the Java NIP-AC path: build a signed inner kind-25050 fixture event in Java, wrap it via `createNipAcGiftWrap`, unwrap it via `parseNipAcGiftWrap`, assert the inner event matches and signature verifies. Place under `android/app/src/test/java/com/nospeak/app/`.

## 9. JS plugin shape

- [x] 9.1 In `src/lib/core/voiceCall/androidVoiceCallPlugin.ts`, add `dismissIncomingCall(callId: string): Promise<void>` to the plugin interface and Capacitor proxy.
- [x] 9.2 In `src/lib/core/voiceCall/incomingCallAcceptHandler.ts`, update the cold-start handoff path to read the new SharedPreferences slot shape; if `getPendingIncomingCall` returns missing/legacy-shape data, surface the existing missed-call toast and do not invoke `voiceCallService.handleNipAcEvent`. Replace any `voiceCallService.handleSignal` call with `voiceCallService.handleNipAcEvent` constructing a synthesized kind-25050 inner event from the stored fields.

## 10. Existing test refactor

- [x] 10.1 Refactor `src/lib/core/voiceCall/VoiceCallService.test.ts` to use kind-based fixtures. Replace JSON-content payloads with signed NIP-AC inner events. Update all `handleSignal` callsites to `handleNipAcEvent`.
- [x] 10.2 Add new state-machine cases for `answered-elsewhere` and `rejected-elsewhere` (NIP-AC test vectors S16 family) and the self-event filter cases S14, S15, S17.
- [x] 10.3 Update or remove existing tests that asserted the old `['type','voice-call']` tag, the NIP-13 seal layer, or the NIP-40 `expiration` tag on signaling — those are no longer applicable.
- [x] 10.4 Run `npx vitest run` and address any remaining failures from §1.3 plus tests touched here.

## 11. Documentation and cleanup

- [x] 11.1 Update `README.md` lines 232–255: add NIP-AC to the supported NIPs list.
- [x] 11.2 Search the codebase (`rg -n "type.*voice-call|CALL_SIGNAL_TYPE|expiration.*60"`) for any straggling references to the old protocol convention and either remove or update.
- [x] 11.3 Run `openspec validate migrate-voice-calling-to-nip-ac --strict` to confirm artifacts still validate after any spec adjustments uncovered during implementation.

## 12. Verification

- [x] 12.1 Run `npm run check` and confirm no TypeScript errors.
- [x] 12.2 Run `npx vitest run` and confirm all tests pass.
- [x] 12.3 Manual two-client smoke test on the same dev machine: install the new build on two devices/profiles for the same user, verify (a) basic call setup and termination, (b) reject path, (c) busy auto-reject, (d) multi-device "answered elsewhere", (e) follow-gate drops offer from non-followed contact.
- [x] 12.4 Confirm `tasks.md` checklist is fully complete; mark all items `- [x]` only after verification has been done.
