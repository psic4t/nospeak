# Implementation Tasks

## 1. Phase 0 — Plumbing (no behavior change, flag default off)

- [x] 1.1 Add `io.getstream:stream-webrtc-android:1.3.8` dependency to `android/app/build.gradle` (alongside existing `okhttp`, `bcprov-jdk15to18`, etc.)
- [x] 1.2 Verify the AAR builds cleanly with `./gradlew assembleDebug` and that `org.webrtc.PeerConnectionFactory` is resolvable in Java
- [x] 1.3 Add `enableNativeCalls` feature flag in `src/lib/config/featureFlags.ts` (default false), with optional SharedPreferences override mechanism
- [x] 1.4 Add `nospeak.ACTION_UNLOCK_COMPLETE` and `EXTRA_UNLOCK_FOR_CALL` constants in a shared Java constants class (e.g., `IntentContract.java`)
- [x] 1.5 Implement native `schnorrVerify(messageBytes, signatureHex, pubkeyHex)` helper in `NativeBackgroundMessagingService` (or a new `SchnorrCrypto.java`), modeled on the existing `schnorrSign` (`:2756-2840`) using BouncyCastle BIP-340 primitives
- [x] 1.6 Unit-test the Schnorr verify helper with a known-good and a known-bad fixture (Robolectric or instrumented test)
- [x] 1.7 Implement native `sendVoiceCallOffer(recipientHex, callId, sdp)` (kind 25050) in `NativeBackgroundMessagingService`, modeled on `sendVoiceCallReject` (`:3355-3430`)
- [x] 1.8 Implement native `sendVoiceCallAnswer(recipientHex, callId, sdp)` (kind 25051)
- [x] 1.9 Implement native `sendVoiceCallIce(recipientHex, callId, candidate, sdpMid, sdpMLineIndex)` (kind 25052), routing through already-connected sockets only
- [x] 1.10 Implement native `sendVoiceCallHangup(recipientHex, callId, reason)` (kind 25053)
- [x] 1.11 Each new sender preserves the self-wrap behavior used by `sendVoiceCallReject:3417`
- [x] 1.12 Create JSON fixture files in `tests/fixtures/nip-ac-wire/` for each kind (25050/25051/25052/25053/25054) capturing canonical inner-event JSON for fixed inputs
- [x] 1.13 Write parity test in `src/lib/core/voiceCall/wireParity.test.ts` that builds the same logical inner event in TS via `Messaging.ts` builders, normalizes JSON property order, and compares to the fixture
- [x] 1.14 Add Robolectric test that builds the same inner event via the new Java senders (in dry-run mode that returns the JSON without publishing) and compares to the same fixture
- [x] 1.15 Create `src/lib/core/voiceCall/types.ts` defining the `VoiceCallBackend` interface (initiateCall, acceptCall, declineCall, hangup, toggleMute, toggleSpeaker, registerNipAcSenders, registerCallEventCreator, registerLocalCallEventCreator, handleNipAcEvent, handleSelfAnswer, handleSelfReject, getRemoteStream)
- [x] 1.16 Rename existing `src/lib/core/voiceCall/VoiceCallService.ts` exported class to `VoiceCallServiceWeb` (file may be renamed too); declare it `implements VoiceCallBackend`
- [x] 1.17 Add factory in `src/lib/core/voiceCall/index.ts`: `voiceCallService` selects `VoiceCallServiceWeb` regardless of platform in Phase 0
- [x] 1.18 Run `npx vitest run` and confirm all existing voice-call tests still pass
- [x] 1.19 Run `npm run check` and confirm svelte-check has no new errors
- [x] 1.20 Manual smoke test: place and receive a voice call between two Android test devices using the Android build; confirm zero regression vs main *(verified 2026-05-01: outgoing + incoming + locked-incoming all connect; audio flows; hangup works)*

## 2. Phase 1 — Native WebRTC Manager (parallel implementation, flag-gated)

- [x] 2.1 Create `android/app/src/main/java/com/nospeak/app/NativeVoiceCallManager.java` skeleton: lifecycle methods, state field for current callId/status, reference to enclosing `VoiceCallForegroundService`
- [x] 2.2 Initialize `PeerConnectionFactory` once per call: `PeerConnectionFactory.InitializationOptions`, `Loggable`, `AudioDeviceModule` with `MODE_IN_COMMUNICATION` awareness
- [x] 2.3 Implement local audio capture: `factory.createAudioSource(MediaConstraints with echoCancellation/noiseSuppression/autoGainControl)`, `factory.createAudioTrack`
- [x] 2.4 Implement `PeerConnection.Observer` callbacks: `onIceCandidate` (calls `sendVoiceCallIce`), `onIceConnectionChange` (drives status transitions), `onAddTrack` (no-op; remote audio plays via AudioDeviceModule), `onConnectionChange`
- [x] 2.5 Implement two-layer ICE candidate buffer mirroring TS implementation in `VoiceCallService.ts:127-148`: pre-remote-description buffer and pre-local-description buffer *(single-layer session buffer in native — global buffer not yet needed since native dispatch only runs while a session is alive)*
- [x] 2.6 Implement `initiateCall(recipientHex, callId)`: build PC, get local audio, createOffer, setLocalDescription, sendVoiceCallOffer, transition to `outgoing-ringing`, start 60s offer timeout
- [x] 2.7 Implement `acceptCall()`: read pending offer from SharedPreferences, build PC, setRemoteDescription, get local audio, createAnswer, setLocalDescription, sendVoiceCallAnswer, transition to `connecting`, start 30s ICE timeout
- [x] 2.8 Implement `handleAnswer(callId, sdp)`: setRemoteDescription, drain ICE candidate buffer, transition to `connecting`
- [x] 2.9 Implement `handleIceCandidate(callId, candidate, sdpMid, sdpMLineIndex)`: addIceCandidate or buffer if not yet ready
- [x] 2.10 Implement `handleHangup(callId, reason)`: close PC, release media, transition to `ended`, emit history event
- [x] 2.11 Implement `hangup()`: sendVoiceCallHangup, then handleHangup locally
- [x] 2.12 Implement `declineCall()`: send kind 25054 via existing `sendVoiceCallReject`, transition to `ended` with reason `rejected-self`
- [x] 2.13 Implement `toggleMute(muted)`: set local audio track `enabled` flag, emit `muteStateChanged` plugin event
- [x] 2.14 Implement `toggleSpeaker(on)`: call `AudioManager.setSpeakerphoneOn`
- [x] 2.15 Implement call duration timer: emit `durationTick` plugin event once per second while status is `active`
- [x] 2.16 Implement state machine and emit `callStateChanged` plugin event on every transition
- [x] 2.17 Implement timeouts: 60s offer (transition to `ended` reason `timeout`), 30s ICE (transition to `ended` reason `ice-failed`)
- [x] 2.18 Implement local-only history event emission: `callHistoryWriteRequested` plugin event for `missed` and `cancelled` types; queue to SharedPreferences key `nospeak_pending_call_history_writes` if WebView not bound *(plugin event implemented; SharedPreferences queueing deferred to Phase 2 — replay on next mount becomes meaningful when ActiveCallActivity replaces MainActivity in the cold-start path)*
- [x] 2.19 Wire `VoiceCallForegroundService.onStartCommand` to instantiate and own `NativeVoiceCallManager`; route `ACTION_INITIATE_NATIVE`, `ACTION_ACCEPT_NATIVE`, `ACTION_HANGUP_NATIVE` intents to manager methods
- [x] 2.20 Verify `VoiceCallForegroundService.configureAudioMode` (`:123-132`) is invoked before peer connection setup so AEC engages
- [x] 2.21 Extend `AndroidVoiceCallPlugin.java` with new methods: `initiateCall`, `acceptCall`, `declineCall`, `hangup`, `toggleMute`, `toggleSpeaker`, plus `setEnableNativeCalls` for the feature-flag bridge
- [x] 2.22 Extend `AndroidVoiceCallPlugin.java` with new emitted events: `callStateChanged`, `durationTick`, `callError`, `muteStateChanged`, `callHistoryWriteRequested`, `callHistoryRumorRequested`
- [x] 2.23 Extend `src/lib/core/voiceCall/androidVoiceCallPlugin.ts` `AndroidVoiceCallPluginShape` with the new methods and event types
- [x] 2.24 Extend `NativeBackgroundMessagingService.handleNipAcWrapEvent` (`:3160-3334`): replace the kind-25051/25052/25053 drop branch (`:3245-3250`) with dispatch into `NativeVoiceCallManager` when `enableNativeCalls` is true
- [x] 2.25 Add Schnorr signature verification call (Phase 0 helper) before any NIP-AC inner-event dispatch in the native handler, regardless of feature flag (security hygiene applies even to legacy offer-only path)
- [x] 2.26 Create `src/lib/core/voiceCall/VoiceCallServiceNative.ts` implementing `VoiceCallBackend`: forwards method calls to `AndroidVoiceCall.*` plugin; subscribes to plugin events and mirrors state into existing `voiceCallState` Svelte store
- [x] 2.27 In `VoiceCallServiceNative.ts`, handle `callHistoryWriteRequested` events by calling `messageRepo.saveMessage` (via the registered local-call-event creator) — and `callHistoryRumorRequested` similarly via the gift-wrap creator
- [x] 2.28 Update factory in `src/lib/core/voiceCall/factory.ts`: when `isNativeCallsEnabled()` returns true, return `VoiceCallServiceNative`; otherwise `VoiceCallServiceWeb`
- [x] 2.29 Extend `Messaging.ts:490-497` skip pattern: when `enableNativeCalls === true && platform === 'android'`, skip JS dispatch for NIP-AC inner kinds 25051/25052/25053/25054 (offer skip was already in place)
- [x] 2.30 Place an outgoing call to a web peer; verify connection completes, audio flows both directions, hangup works *(verified 2026-05-01)*
- [x] 2.31 Accept an incoming call from a web peer (app foreground); verify connection completes, audio flows, hangup works *(verified 2026-05-01)*
- [x] 2.32 ~~With flag disabled, repeat the same test~~ — N/A: flag was removed entirely, native is the only Android path
- [x] 2.33 Run `npm run check` and `npx vitest run`; confirm green

## 3. Phase 2 — Native ActiveCallActivity + Cutover for Incoming Calls

- [x] 3.1 Create `android/app/src/main/res/layout/activity_active_call.xml` styled to match `activity_incoming_call.xml:1-95`: avatar `ImageView`, name `TextView`, status `TextView`, duration `TextView`, three `ImageButton`s (mute, speaker, hangup) with appropriate icons. Plus new drawables: `ic_mic.xml`, `ic_speaker.xml`, `bg_active_call_button_secondary.xml`.
- [x] 3.2 Create `android/app/src/main/java/com/nospeak/app/ActiveCallActivity.java` (244 lines): FLAG_SHOW_WHEN_LOCKED + FLAG_TURN_SCREEN_ON, binds to FGS LocalBinder via ServiceConnection, registers as `NativeVoiceCallManager.UiListener` for state/duration/mute push, wires mute/speaker/hangup buttons, finishes on `ended` state with brief 1.5s display window.
- [x] 3.3 Register `ActiveCallActivity` in `AndroidManifest.xml` with `singleTask` launchMode, `showWhenLocked=true`, `turnScreenOn=true`, reused `Theme.IncomingCall`
- [x] 3.4 Update `IncomingCallActivity.onAcceptClicked`: branches on `AndroidVoiceCallPlugin.isNativeCallsEnabled()`. Native path starts `VoiceCallForegroundService` with `ACTION_ACCEPT_NATIVE` + launches `ActiveCallActivity` instead of MainActivity. Legacy path (flag off) preserved unchanged.
- [x] 3.5 Update `NativeVoiceCallManager.acceptIncomingCall`: was already implemented in Phase 1 to read pending offer from SharedPreferences via the FGS bridge.
- [x] 3.6 Implement PIN-locked nsec detection: in `IncomingCallActivity.onAcceptClicked`, when `nbms == null` OR (mode == "nsec" AND `!hasLocalSecretLoaded()` AND `!reloadLocalSecretFromStore()`), persist `nospeak_pending_call_unlock=<callId>` to SharedPreferences, start FGS in `ACTION_AWAIT_UNLOCK` mode (arms 30s timeout), launch MainActivity with `EXTRA_UNLOCK_FOR_CALL=<callId>` and `nospeak_route_kind=voice-call-unlock`.
- [x] 3.7 Register `LocalBroadcastReceiver` for `nospeak.ACTION_UNLOCK_COMPLETE` in `VoiceCallForegroundService.onCreate`; receiver calls `resumePendingAcceptAfterUnlock(callId)` which reloads the secret via `reloadLocalSecretFromStore()` and starts FGS in `ACTION_ACCEPT_NATIVE`.
- [x] 3.8 Implement 30s unlock timeout in `VoiceCallForegroundService.scheduleUnlockTimeoutIfNeeded`: armed when ACTION_AWAIT_UNLOCK starts; on expiry calls `sendVoiceCallReject` + clears the pending-incoming-call SharedPrefs + cancels the IncomingCallNotification + stops the FGS. (Missed-call rumor authoring deferred to Phase 4 native parameterized author.)
- [x] 3.9 Update JavaScript layer: new `incomingCallUnlockHandler.ts` consumes the `voice-call-unlock` route, waits for both `isPinLocked === false` AND `currentUser !== null` (with 30s timeout), then calls `AndroidVoiceCall.notifyUnlockComplete({ callId })`. Wired into `+layout.svelte` route handler.
- [x] 3.10 Add native plugin method `AndroidVoiceCall.notifyUnlockComplete({ callId })` that emits the `nospeak.ACTION_UNLOCK_COMPLETE` LocalBroadcast. Plus new TypeScript type `AndroidNotificationVoiceCallUnlockPayload` and updated route plugin to recognize `voice-call-unlock` kind.
- [x] 3.11 Update `+layout.svelte` to gate `<ActiveCallOverlay />` with `{#if !nativeCallsActive}` (read from `isNativeCallsEnabled()`). Mirrors existing IncomingCallOverlay gating.
- [x] 3.12 Updated `MainActivity.handleIncomingCallIntent` to recognize the `EXTRA_UNLOCK_FOR_CALL` extra in addition to `accept_pending_call=true`. Both still apply the same setShowWhenLocked + requestDismissKeyguard side-effects so the unlock screen / accept screen lands on top of the keyguard. The legacy `accept_pending_call=true` path remains for the JS-driven build.
- [x] 3.13 Manual test: lock the device, send an incoming call from a web peer, tap Accept on lockscreen → verify `ActiveCallActivity` appears over the lockscreen, audio establishes, hangup works *(verified 2026-05-01)*
- [ ] 3.14 Manual test PIN-unlock flow *(deferred — not tested in 2026-05-01 verification run; locked nsec on test device is not currently configured)*
- [ ] 3.15 Manual test PIN-unlock timeout *(deferred — same as 3.14)*
- [x] 3.16 Run `npm run check`, `npx vitest run`, full Android debug build; all green. Java unit tests still pass (10 tests across 4 suites).

## 4. Phase 3 — Cutover for Outgoing Calls + Native Ringback

- [x] 4.1 Verified: `ChatView.svelte:1303` outgoing call button calls `voiceCallService.initiateCall(npub)`. With `enableNativeCalls=true` the factory returns `VoiceCallServiceNative` whose `initiateCall` invokes `AndroidVoiceCall.initiateCall({callId, peerHex})` → `VoiceCallForegroundService.ACTION_INITIATE_NATIVE` → `NativeVoiceCallManager.initiateCall` (already implemented in Phase 1).
- [x] 4.2 `NativeVoiceCallManager.initiateCall` (Phase 1): generates callId, builds PC, gets local audio, createOffer, setLocalDescription, sendVoiceCallOffer, transitions to OUTGOING_RINGING, starts 60s offer timeout. The FGS now also auto-launches `ActiveCallActivity` when `ACTION_INITIATE_NATIVE` runs (added in Phase 2.G).
- [x] 4.3 Implemented native ringback in new class `VoiceCallRingback.java`: `ToneGenerator` with `TONE_SUP_RINGTONE` (the standard supervisory ringback tone), played for 2000ms at a time on a 4000ms cadence via main-thread Handler. Routed through `STREAM_VOICE_CALL` so it shares the audio path the live call audio will use. Profile matches `ringtone.ts` (single tone, 2s on / 2s off).
- [x] 4.4 Wired into `VoiceCallForegroundService` via `nativeManager.setServiceListener(...)` (a new internal-listener slot distinct from the UiListener used by `ActiveCallActivity`, so the two don't compete). Starts on transition INTO `OUTGOING_RINGING`, stops on the first transition OUT (connecting / active / ended). `onDestroy` also stops it as a safety net.
- [x] 4.5 Updated `src/lib/core/voiceCall/ringtone.ts`: both `startIncomingRingtone()` and `startOutgoingRingback()` early-return when `isNativeCallsEnabled()` is true.
- [x] 4.6 Manual test: initiate a call from a chat (app foreground, unlocked) → verify `ActiveCallActivity` shows, callee receives offer, on accept the call connects, audio flows both directions, hangup works *(verified 2026-05-01)*
- [ ] 4.7 Manual test: initiate a call with the device locked *(deferred — outgoing-from-locked is an unusual UX path; not part of 2026-05-01 verification)*
- [x] 4.8 Manual test interop with web peer: outgoing native → web answer; web peer → native answer *(verified 2026-05-01: both directions interop with web build)*
- [x] 4.9 Run `npm run check`, `npx vitest run`, Java unit tests, full Android debug build — all green.

## 5. Phase 4 — Cleanup & Hardening

- [x] 5.1 Implemented parameterized native author `sendVoiceCallHistoryRumor(recipientHex, type, durationSec, callId, initiatorHex)` in `NativeBackgroundMessagingService` supporting all gift-wrapped types: `declined`, `ended`, `no-answer`, `failed`, `busy`. Refactored existing `sendVoiceCallDeclinedEvent` to delegate. Tag layout matches `Messaging.buildCallEventTags` exactly (including the optional `call-duration` tag for `ended`).
- [x] 5.2 Wired `NativeVoiceCallManager` (via the FGS `MessagingBridge.sendCallHistoryRumor` impl) to call the parameterized author directly for ALL gift-wrapped types. The previous `callHistoryRumorRequested` bridge to JS is no longer fired — Phase 1 stopgap is gone.
- [x] 5.3 Removed the `enableNativeCalls` feature flag entirely. Deleted `src/lib/config/featureFlags.ts`. Removed `setEnableNativeCalls` plugin method, `sNativeCallsEnabled` static, and `isNativeCallsEnabled()` accessor from `AndroidVoiceCallPlugin`. *(Decision: the flag was preventing the lockscreen Accept path from engaging the native FGS on cold-start — the static was only set when JS bootstrapped, but the lockscreen Activity reads it before any JS runs. Native is now the only Android voice-call path.)*
- [x] 5.4 Factory in `src/lib/core/voiceCall/factory.ts` now uses `Capacitor.getPlatform() === 'android'` directly. Returns `VoiceCallServiceNative` on Android, `VoiceCallService` (web impl) elsewhere.
- [x] 5.5 `Messaging.ts` skip pattern collapsed into a single `isAndroidNative()` check that skips all NIP-AC inner kinds (offer/answer/ICE/hangup/reject) on Android.
- [x] 5.6 `NativeBackgroundMessagingService.handleNipAcWrapEvent` dispatches to `NativeVoiceCallManager` whenever a manager is alive — no flag check. The native FGS is the authoritative dispatcher on Android.
- [ ] 5.7 Remove dead code from `VoiceCallServiceWeb` that was only relevant for the Android path: `startAndroidSession`, `endAndroidSession`, `dismissAndroidIncoming` *(scheduled as a follow-up commit alongside other dead-code cleanup)*
- [x] 5.8 Robolectric-style state-machine tests: extracted the call-history authoring decision tree into `CallHistoryDecision.decide(prevStatus, reason, isInitiator, peerHex, durationSec)` (pure Java, no Android-framework deps). New `CallHistoryDecisionTest` exercises 17 scenarios covering every state × reason combination from the voice-calling spec, plus the `CallStatus.wireName()` strings that drive JS-side state mirroring. Full WebRTC peer-connection / ICE buffer testing requires actual device emulation (Robolectric does not stub the JNI peer connection); deferred to integration tests against an emulator.
- [x] 5.9 `RECORD_AUDIO` runtime permission audit: `VoiceCallServiceNative.initiateCall` and `acceptCall` now call `AndroidMicrophone.requestPermission()` (the existing capacitor plugin) before invoking the native FGS. Denial on accept auto-declines the call so the caller hears a clean reject rather than connecting-then-silent. The legacy JS path is unaffected (its `getUserMedia({audio:true})` triggers the WebView's own permission prompt).
- [ ] 5.10 Update `CLAUDE.md`, `AGENTS.md`, and root `README.md` to describe the new native voice-calling architecture *(deferred — write architecture docs alongside the flag removal once hardware validation passes)*
- [ ] 5.11 Update `openspec/specs/voice-calling/spec.md`, `openspec/specs/messaging/spec.md`, and `openspec/specs/android-app-shell/spec.md` per the delta specs *(automatic via `openspec archive add-native-voice-calls` after manual hardware tests + flag removal land)*
- [x] 5.12 Final E2E test matrix *(verified 2026-05-01: outgoing, foreground-incoming, locked-incoming all work; audio bidirectional; back-to-back calls work after IDLE-reset fix)*
- [x] 5.13 Run `npm run check`, `npx vitest run`, Java unit tests, and full Android debug build — all green. New decision-tree tests bring the Java suite to 27 tests across 5 suites.
