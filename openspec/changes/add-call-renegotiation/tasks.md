# Implementation Tasks

Phases are ordered by dependency. Each phase ends in a green test suite and
is independently mergeable. Run `npm run check` and `npx vitest run` after
each phase; run Android unit tests after Android-touching phases.

## 1. OpenSpec scaffolding

- [x] 1.1 Create `openspec/changes/add-call-renegotiation/` with `proposal.md`, `design.md`, `tasks.md`, `specs/voice-calling/spec.md`
- [x] 1.2 Run `openspec validate add-call-renegotiation --strict` and resolve any issues

## 2. Type, store, constants foundation

- [x] 2.1 Add `NIP_AC_KIND_RENEGOTIATE = 25055` to `src/lib/core/voiceCall/constants.ts` (also `RENEGOTIATION_TIMEOUT_MS`)
- [x] 2.2 Extend `VoiceCallSignal` discriminated union in `types.ts` with the renegotiate variant
- [x] 2.3 Extend `NipAcSenders` with `sendRenegotiate(npub, callId, sdp)`
- [x] 2.4 Extend `VoiceCallBackend` with `requestVideoUpgrade()` and `getRenegotiationState()`
- [x] 2.5 Extend `VoiceCallState` with `renegotiationState: 'idle' | 'outgoing' | 'incoming' | 'glare'` and add `setRenegotiationState` mutator in `src/lib/stores/voiceCall.ts`; reset in `endCall`, `setEndedAnsweredElsewhere`, `setEndedRejectedElsewhere`
- [x] 2.6 Add no-op stubs for `requestVideoUpgrade` / `getRenegotiationState` in both `VoiceCallService.ts` and `VoiceCallServiceNative.ts`
- [x] 2.7 Update `voiceCall.test.ts` (store) covering the new mutator and reset behavior
- [x] 2.8 Verify `npm run check` and `npx vitest run` pass

## 3. Wire-format generalization

- [x] 3.1 Implement `Messaging.sendCallRenegotiate(npub, callId, sdp)` modeled on `sendCallOffer` (kind 25055, alt = `"WebRTC call renegotiation"`, NO `call-type` tag, NO self-wrap)
- [x] 3.2 Register `sendRenegotiate` on the `senders` object passed to `voiceCallService.registerNipAcSenders`
- [x] 3.3 Extend the receive-path kind allow-list in `Messaging.handleNipAcWrap` to include 25055
- [x] 3.4 Extend the self-event filter in `Messaging.handleNipAcWrap`: self-renegotiate is always ignored (mirrors self-ICE/self-hangup)
- [x] 3.5 Java `NativeBackgroundMessagingService.sendVoiceCallRenegotiate(callId, sdp, peerHex)` modeled on `sendVoiceCallOffer` (no `call-type` tag, no self-wrap)
- [x] 3.6 Java `NativeBackgroundMessagingService.dispatchInnerNipAcEvent` routes kind 25055 into a new `NativeVoiceCallManager.handleRemoteRenegotiate` (Phase 5 implements the body; this phase only wires dispatch via a Phase-3 stub)
- [x] 3.7 Extend `MessagingBridge` and `NipAcSender` (in `VoiceCallForegroundService`) with `sendRenegotiate` / `sendVoiceCallRenegotiate`
- [x] 3.8 Add fixture case `renegotiate (voice -> video upgrade)` to `tests/fixtures/nip-ac-wire/inner-events.json`; canonical event id computed
- [x] 3.9 `wireParity.test.ts` automatically covers the new fixture case (data-driven loop)
- [x] 3.10 `NativeNipAcSenderTest.java` automatically covers the new fixture case (data-driven loop); `VoiceCallBridgeTest.java` extended with new forwarding test
- [ ] 3.11 (deferred to Phase 4) Add a `MessagingService.test.ts` case asserting kind 25055 is dispatched (web) / skipped (Android native); the receive-path code is already wired and exercised by Phase 4's `handleRenegotiate` tests
- [x] 3.12 Verify `npm run check`, `npx vitest run`, and Android unit tests pass

## 4. Web/PWA renegotiation

- [x] 4.1 Refactor `VoiceCallService.handleAnswer` to distinguish initial answer (`status === 'outgoing-ringing'`) from renegotiation answer (`renegotiationState === 'outgoing'`)
- [x] 4.2 Implement `VoiceCallService.handleRenegotiate(inner)`: status guard, call-id match, glare detection + lex-compare + rollback (loser) / drop (winner), apply remote → answer → publish, flip callKind on video m-line via `setCallKind`
- [x] 4.3 Implement camera-acquisition path inside `handleRenegotiate` for incoming video upgrade (best-effort; permission denial proceeds with peer-only video)
- [x] 4.4 Implement `VoiceCallService.requestVideoUpgrade()` with guards, state transitions, peerConnection.addTrack, sendRenegotiate, 30s timeout
- [x] 4.5 Implement renegotiation timeout: rollback, remove just-added track, reset state
- [x] 4.6 Implement `getRenegotiationState()` accessor (reads store)
- [x] 4.7 Wire `ActiveCallOverlay.svelte` "Add video" button visible only when eligible (`canAddVideo` derived) plus disabled "Adding video…" mid-upgrade state (`isUpgradingToVideo`)
- [x] 4.8 Wire the button click to `voiceCallService.requestVideoUpgrade()`; disabled while not `idle`
- [x] 4.9 Extend `VoiceCallService.test.ts` with all listed renegotiation scenarios (12 new tests covering accept/drop, mismatch, glare both directions, callKind flip, requestVideoUpgrade happy/denied/timeout/already-pending, self-renegotiate)
- [x] 4.10 Verify `npm run check` and `npx vitest run` pass; manual web↔web smoke test deferred to Phase 7

## 5. Android native renegotiation parity

- [x] 5.1 Add `RenegotiationState { IDLE, OUTGOING, INCOMING, GLARE }` enum to `NativeVoiceCallManager.java` with `wireName()`
- [x] 5.2 Add private fields `renegotiationState`, `renegotiationTimeoutRunnable`, `renegotiationPendingVideoTrack`
- [x] 5.3 Refactor `handleRemoteAnswer` to distinguish initial vs renegotiation answers (mirror Web Phase 4.1)
- [x] 5.4 Replace `handleRemoteRenegotiate` Phase-3 stub with full impl: status guard, callId match, glare via `peerConnection.signalingState() == HAVE_LOCAL_OFFER` + lex-compare lowercase hex (loser uses ROLLBACK SessionDescription), apply remote → createAnswer → setLocalDescription → bridge.sendAnswer
- [x] 5.5 Best-effort camera acquisition path inside `handleRemoteRenegotiate`: when SDP carries a video m-line and we have no local video, lazily run `attachLocalVideoTrack()`; failure is non-fatal and we still answer
- [x] 5.6 Implement `NativeVoiceCallManager.requestVideoUpgrade()`: guards mirror web; `attachLocalVideoTrack` if absent; `peerConnection.createOffer` → `setLocalDescription` → `bridge.sendRenegotiate`; arm 30 s `Handler.postDelayed` timeout
- [x] 5.7 Implement timeout body via `scheduleRenegotiationTimeout` + `rollbackOutgoingRenegotiation`: rollback, discard upgrade artifacts (capturer, source, surfaceTextureHelper, video track), emit a `renegotiationStateChanged` event, reset state to IDLE
- [x] 5.8 Add `UiListener.onRenegotiationStateChanged(RenegotiationState state)` (default no-op); package-private `notifyRenegotiationStateChanged` helper; emitted on every transition
- [x] 5.9 New `@PluginMethod requestVideoUpgrade` on `AndroidVoiceCallPlugin.java` proxying to manager
- [x] 5.10 Plugin event emitters `emitRenegotiationStateChanged(state)` AND `emitCallKindChanged(kind)` so JS mirrors both the in-flight state and the post-upgrade media kind
- [x] 5.11 Update `androidVoiceCallPlugin.ts` typed shim with `requestVideoUpgrade` method and `renegotiationStateChanged` + `callKindChanged` event listener types
- [x] 5.12 Update `VoiceCallServiceNative.ts` to subscribe to `renegotiationStateChanged` + `callKindChanged` and proxy `requestVideoUpgrade` / `getRenegotiationState` to the plugin
- [x] 5.13 Add an "Add video" button to `res/layout/activity_active_call.xml`; default visibility=gone; gating logic in `ActiveCallActivity.refreshAddVideoButton()`
- [x] 5.14 Update `ActiveCallActivity.java`: subscribe to `onRenegotiationStateChanged`, refresh button on status changes, promote `isVideoCall=true` and re-apply visibility when local/remote video tracks arrive mid-call
- [x] 5.15 Extend `NativeVoiceCallManagerListenerTest.java` with throw-isolation cases for `onRenegotiationStateChanged` (3 new tests: dispatches to non-null, no-op when null, default no-op for legacy listeners)
- [ ] 5.16 (Deferred) Dedicated `RenegotiationGlareTest.java` — the glare branch is fully unit-testable on the JS side (covered by VoiceCallService.test.ts); the Java glare path requires Robolectric + a mocked PeerConnection, which would be a large new dependency for a single test scenario. Manual smoke tests in Phase 7 cover the Java path.
- [x] 5.17 Verify Android unit tests pass (48 tests green); manual smoke tests deferred to Phase 7

## 6. Call history correctness for upgraded calls

- [x] 6.1 Added a `VoiceCallService.test.ts` case: initiate voice → upgrade to video via 25055/25051 → hangup; assert the rumor builder receives `callKind === 'video'`
- [ ] 6.2 (Deferred to Phase 7) Manual verification: an upgraded-then-hung-up call shows the video icon in chat history on both web and Android
- [x] 6.3 Code change required after all (the original `add-video-calling` impl read `this.callKind` AFTER `cleanup()` which clobbered it to `'voice'`; fixed by capturing `callKindAtHangup` before cleanup and passing through optional `callKindOverride` to both rumor builders). Web tests now cover this.

## 7. Spec sync, validation, archive

- [x] 7.1 Run `openspec validate add-call-renegotiation --strict` — green.
- [ ] 7.2 Manual end-to-end checklist (deferred to user, post-build):
  - Web↔Web voice→video upgrade
  - Web↔Android voice→video upgrade (both directions)
  - Android↔Android voice→video upgrade
  - Glare reproduction (debug button or query-param delay)
  - Camera permission denied on receive: peer sees us audio-only, we see them
  - Outgoing renegotiation timeout: rollback works, voice call survives
  - Back-compat: peer that drops 25055 — voice call unaffected
  - Call history shows video icon for upgraded calls
- [x] 7.3 Updated `AGENTS.md` voice-calling section noting kind 25055 support and where renegotiation logic lives in both stacks
- [ ] 7.4 (Post-manual-verification) `openspec sync-specs add-call-renegotiation` to merge deltas into `openspec/specs/voice-calling/spec.md`
- [ ] 7.5 (Post-manual-verification) `openspec archive add-call-renegotiation --yes`
