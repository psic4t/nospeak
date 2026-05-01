# Change: Move Voice Calling Stack to Native Android

## Why

The voice calling architecture is asymmetric on Android: the ringing UI is a native Activity with full-screen-intent and lockscreen support, but the active in-call UI runs in the Svelte WebView and the WebRTC peer connection lives in JavaScript. This causes WebView lifecycle fragility (audio drops if the WebView is throttled or killed), cold-start latency on accept (a JS round-trip is required before media starts), and an inconsistent UX where ringing feels native and the call drops back into the WebView.

The infrastructure to move the entire stack natively is largely already in place: `NativeBackgroundMessagingService.java` already decrypts NIP-17 gift wraps, signs and encrypts arbitrary inner events, builds gift wraps, and publishes to relays — proven by the existing `sendVoiceCallReject` and `sendVoiceCallDeclinedEvent` paths. The remaining net-new work is principally a native WebRTC peer connection (single-line gradle dependency on `io.getstream:stream-webrtc-android`) and a native active-call UI mirroring the existing `IncomingCallActivity`.

## What Changes

- **Native WebRTC peer connection**: introduce `NativeVoiceCallManager` (Java) hosted by the existing `VoiceCallForegroundService`, using `io.getstream:stream-webrtc-android` 1.3.x. Owns `PeerConnectionFactory`, audio source/track, ICE buffer, and the call duration timer.
- **Native active-call Activity**: introduce `ActiveCallActivity` with XML layout `activity_active_call.xml` mirroring the visual style of `IncomingCallActivity`. Provides mute toggle, speaker toggle, hangup, duration display. Shown over the lockscreen via `FLAG_SHOW_WHEN_LOCKED`.
- **Native NIP-AC outbound senders** for kinds 25050 (offer), 25051 (answer), 25052 (ICE), 25053 (hangup) added to `NativeBackgroundMessagingService`, modeled on the existing `sendVoiceCallReject` (kind 25054) helper.
- **Native NIP-AC inbound dispatch extended** for kinds 25051/25052/25053 (today only kind 25050 offer is handled; other kinds are dropped at `NativeBackgroundMessagingService.java:3245-3250`).
- **Native Schnorr signature verification** added for inner NIP-AC events as a security hygiene improvement (today only the JS side verifies).
- **Cold-start accept flow simplified**: lockscreen `IncomingCallActivity` Accept tap now starts `VoiceCallForegroundService` directly with an Accept intent; the native call manager builds the peer connection and sends the Answer immediately. The previous JS round-trip via `MainActivity` + `incomingCallAcceptHandler.ts` is no longer on the critical path.
- **PIN-locked nsec handling**: when a user accepts a call with `currentMode == "nsec"` and the local secret is not unlocked, the native flow launches `MainActivity` with an unlock intent and resumes the accept on a `LocalBroadcast` `ACTION_UNLOCK_COMPLETE`.
- **Active-call UI on Android moves to native**: `src/lib/components/ActiveCallOverlay.svelte` is gated to non-Android only, mirroring the existing `IncomingCallOverlay.svelte` treatment.
- **Web/PWA path preserved**: `src/lib/core/voiceCall/VoiceCallService.ts` is refactored behind a `VoiceCallBackend` interface. The existing implementation becomes `VoiceCallServiceWeb`. Android gets a thin `VoiceCallServiceNative` that proxies to the new plugin methods and mirrors native state events into the existing `voiceCallState` Svelte store.
- **`AndroidVoiceCall` plugin extended** with new methods `initiateCall`, `acceptCall`, `declineCall`, `hangup`, `toggleMute`, `toggleSpeaker` and new emitted events `callStateChanged`, `durationTick`, `callError`, `muteStateChanged`, `callHistoryWriteRequested`.
- **Local-only call history** (`missed`, `cancelled`) bridged via a native→JS `callHistoryWriteRequested` event that triggers `messageRepo.saveMessage` in JS; gift-wrapped call-history rumors (`ended`, `no-answer`, `failed`, `busy`, `declined`) are authored natively using a parameterized variant of the existing `sendVoiceCallDeclinedEvent`.
- **Outgoing ringback tone** moved to native `MediaPlayer`/`Ringtone` to fully decouple from WebView lifecycle.
- **Phased landing**. Phase 0 plumbing → Phase 1 native manager → Phase 2 native incoming/lockscreen → Phase 3 native outgoing + ringback → Phase 4 cleanup. An `enableNativeCalls` feature flag was used during Phases 0–3 to allow parallel rollback to the JS path; Phase 4 removed the flag once the lockscreen Accept path was confirmed broken with the flag-gated approach (the static could not be set before JS bootstrap), and native is now the only Android voice-call path.
- **BREAKING (Android only)**: the JS `voiceCallService.handleNipAcEvent` / `handleSelfAnswer` / `handleSelfReject` paths no longer run on Android — the native manager owns NIP-AC dispatch entirely. Web behavior is unchanged.

## Capabilities

### New Capabilities

None. All requirement changes attach to existing capabilities.

### Modified Capabilities

- **`voice-calling`** — fundamental ownership change on Android: WebRTC, signaling dispatch, active-call UI, ringback tone, and call-history authoring all move to native. The lockscreen pending-call handoff requirement is replaced by direct native handling. Multiple existing requirements need updates.
- **`messaging`** — native NIP-AC inbound dispatch is extended beyond offers; native outbound senders are added for non-reject kinds. Inner-event Schnorr verification is added natively.
- **`android-app-shell`** — new `ActiveCallActivity`, new plugin methods/events on `AndroidVoiceCall`, foreground service hosts the WebRTC manager, PIN-unlock intent contract.

## Impact

**Affected code:**

- New: `android/app/src/main/java/com/nospeak/app/NativeVoiceCallManager.java`
- New: `android/app/src/main/java/com/nospeak/app/ActiveCallActivity.java`
- New: `android/app/src/main/res/layout/activity_active_call.xml`
- New: `src/lib/core/voiceCall/types.ts` (`VoiceCallBackend` interface)
- New: `src/lib/core/voiceCall/VoiceCallServiceNative.ts`
- Modified: `android/app/build.gradle` (+ stream-webrtc-android dep)
- Modified: `android/app/src/main/java/com/nospeak/app/NativeBackgroundMessagingService.java` (new senders, extended dispatch, Schnorr-verify)
- Modified: `android/app/src/main/java/com/nospeak/app/AndroidVoiceCallPlugin.java` (new methods + events)
- Modified: `android/app/src/main/java/com/nospeak/app/VoiceCallForegroundService.java` (host `NativeVoiceCallManager`)
- Modified: `android/app/src/main/java/com/nospeak/app/IncomingCallActivity.java` (Accept path goes native + PIN-locked fallback)
- Modified: `android/app/src/main/java/com/nospeak/app/MainActivity.java` (repurpose `accept_pending_call` intent to unlock-only)
- Modified: `android/app/src/main/AndroidManifest.xml` (register `ActiveCallActivity`)
- Modified: `src/lib/core/voiceCall/VoiceCallService.ts` → split into `VoiceCallServiceWeb.ts` + factory in `index.ts`
- Modified: `src/lib/core/voiceCall/androidVoiceCallPlugin.ts` (extend `AndroidVoiceCallPluginShape`)
- Modified: `src/lib/core/Messaging.ts` (extend Android skip pattern at `:490-497` to all NIP-AC inner kinds when native calls enabled)
- Modified: `src/routes/+layout.svelte:659` (gate `<ActiveCallOverlay/>` with `{#if !isAndroidApp}`)

**Affected dependencies:**

- New Android dependency: `io.getstream:stream-webrtc-android:1.3.8` (~5 MB AAR with prebuilt `.so` libs for arm64-v8a, armeabi-v7a, x86, x86_64).

**Affected systems:**

- Android voice-call flow end-to-end (initiate, accept, decline, hangup, mute, speaker, lockscreen-accept, cold-start-accept, multi-device "answered/rejected elsewhere", PIN-locked nsec).
- Web/PWA voice-call flow: untouched in behavior; refactored behind `VoiceCallBackend` interface.
- Existing tests `src/lib/core/voiceCall/VoiceCallService.test.ts` and `VoiceCallService.iceBuffer.test.ts` continue covering the web implementation; new Robolectric/instrumented tests added in Phase 4 for `NativeVoiceCallManager`.

**Backwards compatibility:**

- NIP-AC wire protocol is unchanged. Existing nospeak clients (and any future NIP-AC-compatible clients) interoperate with both the old JS path and the new native path.
- Web/PWA users see no change.
- Android users see UX improvements (faster lockscreen accept, native active-call UI, calls survive WebView issues) and one new native-only behavior (PIN unlock prompt during call when nsec is locked).

**Out of scope:**

- iOS native calling (no iOS app exists).
- TelecomManager / ConnectionService integration (potential future phase).
- Group / multiparty calls.
- Video calls.
- Native PIN entry UI (we reuse the existing JS unlock screen via intent contract).
