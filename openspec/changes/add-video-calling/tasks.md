# Implementation Tasks

Phases are ordered by dependency. Each phase ends in a green test suite and is
independently mergeable. Run `npm run check` and `npx vitest run` after each
phase; run Android unit tests after Android-touching phases.

## 1. Type & Svelte store foundation

- [ ] 1.1 Add `CallKind = 'voice' | 'video'` union type to `src/lib/core/voiceCall/types.ts`
- [ ] 1.2 Extend `VoiceCallState` in `src/lib/stores/voiceCall.ts` with `callKind`, `isCameraOff`, `isCameraFlipping`, `facingMode`
- [ ] 1.3 Add store mutators `setCallKind`, `setCameraOff`, `setCameraFlipping`, `setFacingMode`
- [ ] 1.4 Extend `setOutgoingRinging` and `setIncomingRinging` with optional `kind` parameter (default `'voice'`)
- [ ] 1.5 Extend `resetCall` to reset all new fields
- [ ] 1.6 Add `getCallKind`, `getLocalStream`, `toggleCamera`, `flipCamera`, `isCameraOff` to `VoiceCallBackend` interface in `types.ts`
- [ ] 1.7 Add no-op stub implementations in `VoiceCallService.ts` (web) and `VoiceCallServiceNative.ts` so types compile
- [ ] 1.8 Update `src/lib/stores/voiceCall.test.ts` with test cases covering new mutators
- [ ] 1.9 Verify `npm run check` and `npx vitest run` pass

## 2. Wire-format generalization

- [ ] 2.1 Modify `Messaging.sendOffer` (and sibling typed sender) to accept `{callType?: CallKind}` option; default `'voice'`
- [ ] 2.2 Update `NipAcSenders` type so consumers can pass the option
- [ ] 2.3 Update `VoiceCallService.handleOffer` (web) to read `call-type` tag from inner event; default `'voice'`; call `setIncomingRinging(npub, callId, kind)`
- [ ] 2.4 Update Java `NativeBackgroundMessagingService.publishNipAcInner` to accept a kind parameter and emit `['call-type', kind]` for kind-25050 inner events
- [ ] 2.5 Update Java `dispatchInnerNipAcEvent` to read `callType` from inner event tag and persist it (already opaque today; just confirm round-trip)
- [ ] 2.6 Add new fixture cases (`video-offer-25050`, `video-answer-25051`, `voice-offer-25050-default-tag`) to `tests/fixtures/nip-ac-wire/inner-events.json`; recompute canonical event ids
- [ ] 2.7 Extend `wireParity.test.ts` to assert the new fixture cases
- [ ] 2.8 Extend `NativeNipAcSenderTest.java` to assert the new fixture cases (kind parameter passed through reflective `buildNipAcInnerForTest`)
- [ ] 2.9 Verify `npm run check`, `npx vitest run`, and Android unit tests pass

## 3. Web/PWA video implementation

- [ ] 3.1 Add `VIDEO_MEDIA_CONSTRAINTS` to `src/lib/core/voiceCall/constants.ts` (640x480 @ 30 fps, `facingMode: 'user'`, audio constraints unchanged)
- [ ] 3.2 Implement `initiateCall(npub, kind = 'voice')` in `VoiceCallService.ts`: store `callKind`; pass to `setOutgoingRinging`; choose `getUserMedia` constraints; pass `{callType: kind}` to `senders.sendOffer`
- [ ] 3.3 Implement `acceptCall` to choose constraints based on the offer's `call-type`
- [ ] 3.4 Cache `localAudioTrack` and `localVideoTrack` from the local stream
- [ ] 3.5 Implement `toggleCamera()` flipping `localVideoTrack.enabled` and updating store via `setCameraOff`
- [ ] 3.6 Implement `flipCamera()`: set `isCameraFlipping=true`, request new track via `getUserMedia({video:{facingMode}})`, call `replaceTrack` on the existing video sender, stop the old track, update store, clear flag
- [ ] 3.7 Implement `getLocalStream()` and `getCallKind()` and `isCameraOff()`
- [ ] 3.8 Extend `cleanup` to stop video track, clear video-related fields, and reset `callKind` to `'voice'`
- [ ] 3.9 Add a video-camera-icon button to the chat header (sibling of the existing voice-call button); wire `onClick` to `voiceCallService.initiateCall(peerNpub, 'video')`
- [ ] 3.10 Update `ActiveCallOverlay.svelte` to render full-screen `<video>` for remote and PiP `<video>` for local self-view when `callKind === 'video'`
- [ ] 3.11 Add camera-off and flip-camera control buttons in the active-call controls strip; gate their visibility on `callKind === 'video'`
- [ ] 3.12 Mirror the local self-view when `facingMode === 'user'` (CSS `transform: scaleX(-1)`)
- [ ] 3.13 Auto-hide controls after 3 s of pointer inactivity; reveal on tap (defer if scope creeps)
- [ ] 3.14 Update `IncomingCallOverlay.svelte` to display "Incoming video call" copy when `callKind === 'video'`
- [ ] 3.15 On video call active, set `isSpeakerOn=true` in the store
- [ ] 3.16 Extend `VoiceCallService.test.ts` with the test cases listed in section 7a of the design (initiate-video, send-offer-tag, handle-offer-with-and-without-tag, accept-video, toggle-camera, flip-camera, cleanup)
- [ ] 3.17 Verify `npm run check` and `npx vitest run` pass; manual web↔web video smoke test (two browser windows)

## 4. AndroidCamera Capacitor plugin

- [ ] 4.1 Create `android/app/src/main/java/com/nospeak/app/AndroidCameraPlugin.java` modeled on `AndroidMicrophonePlugin`; methods `checkPermission` and `requestPermission` for `Manifest.permission.CAMERA`
- [ ] 4.2 Register the plugin in `MainActivity` (or the relevant Capacitor plugin registration site)
- [ ] 4.3 Create `src/lib/core/voiceCall/androidCameraPlugin.ts` with the typed shim and `AndroidCamera` registration
- [ ] 4.4 Wire camera-permission check into `VoiceCallServiceNative.initiateCall` when `kind === 'video'`
- [ ] 4.5 Wire camera-permission check into `VoiceCallServiceNative.acceptCall` when the offer's call kind is `'video'`
- [ ] 4.6 On denied permission, abort the call (transition to `ended` with reason `'error'`) and surface a clear error message; do NOT silently downgrade to voice
- [ ] 4.7 Verify Android tests pass; manual smoke test of permission prompt on a real device

## 5. Android native video implementation

- [ ] 5.1 Add `enum CallKind { VOICE, VIDEO }` with `wireName()` to `NativeVoiceCallManager.java`
- [ ] 5.2 Add fields: `callKind`, `videoSource`, `localVideoTrack`, `videoCapturer`, `surfaceTextureHelper`, `rootEglBase`, `isCameraOff`, `isFrontCamera`, `remoteVideoTrack`
- [ ] 5.3 Modify `ensureFactory()` to lazily create `EglBase` and configure `DefaultVideoEncoderFactory` / `DefaultVideoDecoderFactory` with its context
- [ ] 5.4 Expose `getRootEglBase()` getter so `ActiveCallActivity` can share the GL context
- [ ] 5.5 Add `attachLocalVideoTrack()` using `Camera2Enumerator` + `CameraVideoCapturer` (front camera default), `SurfaceTextureHelper`, `factory.createVideoSource(false)`, `factory.createVideoTrack`, then `peerConnection.addTrack(localVideoTrack, [localStreamId])` and `videoCapturer.startCapture(640, 480, 30)`
- [ ] 5.6 Modify `initiateCall` and `acceptIncomingCall` and `notifyIncomingRinging` to accept a `CallKind` parameter and call `attachLocalVideoTrack` when `VIDEO`
- [ ] 5.7 Set `OfferToReceiveVideo` SDP constraint when offer is for video
- [ ] 5.8 In `PCObserver.onAddTrack` (or `onTrack` UnifiedPlan), when track is `VideoTrack`, store as `remoteVideoTrack` and notify listeners via new callback `onRemoteVideoTrack(VideoTrack)`
- [ ] 5.9 Add `setCameraOff(boolean off)`: toggle `localVideoTrack.setEnabled(!off)`; emit `cameraStateChanged` event
- [ ] 5.10 Add `flipCamera()`: call `videoCapturer.switchCamera(handler)`; on success update `isFrontCamera`, emit `facingModeChanged`
- [ ] 5.11 Extend `finishCall` cleanup: `videoCapturer.stopCapture()`, `videoCapturer.dispose()`, `videoSource.dispose()`, `surfaceTextureHelper.dispose()`, `rootEglBase.release()`
- [ ] 5.12 Extend `runIdleResetIfPendingOrEnded` to clear video state for back-to-back calls
- [ ] 5.13 In `setActive` for video calls, default `setSpeakerOn(true)`
- [ ] 5.14 Add `UiListener` callbacks: `onRemoteVideoTrack`, `onCameraStateChanged`, `onFacingModeChanged` (default no-op for back-compat)
- [ ] 5.15 Modify `VoiceCallForegroundService.java`: parse `EXTRA_CALL_KIND`, propagate into manager entry points, kind-aware notification title/icon
- [ ] 5.16 Modify `IncomingCallActivity.java`: read `EXTRA_CALL_KIND` from intent, render kind-aware copy/icon, persist kind through `ACTION_AWAIT_UNLOCK` flow
- [ ] 5.17 Add new strings/drawables: `R.string.video_call_with_X`, `R.drawable.ic_video_call_24`, `R.drawable.ic_camera_off_24`, `R.drawable.ic_camera_flip_24`
- [ ] 5.18 Modify `res/layout/activity_active_call.xml`: add full-screen `SurfaceViewRenderer active_call_remote_video` (behind controls), small `SurfaceViewRenderer active_call_local_video` (PiP corner), `active_call_camera_off` ImageButton, `active_call_flip_camera` ImageButton
- [ ] 5.19 Modify `ActiveCallActivity.java`: in `onCreate` get `EglBase` from manager and `init` both renderers; in `onServiceConnected` register listener; on `onRemoteVideoTrack` call `track.addSink(remoteRenderer)`; on local-track-ready (manager exposes `getLocalVideoTrack()` getter) call `track.addSink(localRenderer)`; on `onFacingModeChanged` call `localRenderer.setMirror(isFront)`; on `onCameraStateChanged` swap icon
- [ ] 5.20 Wire the camera-off and flip-camera buttons to `mgr.setCameraOff(!mgr.isCameraOff())` and `mgr.flipCamera()`
- [ ] 5.21 In `onDestroy`, release renderers but DO NOT release `EglBase` (manager owns it)
- [ ] 5.22 Hide both `SurfaceViewRenderer`s and the camera buttons (`View.GONE`) when call kind is `voice`
- [ ] 5.23 Add `AndroidVoiceCallPlugin.java` event emitters: `emitCameraStateChanged`, `emitFacingModeChanged`; new `@PluginMethod` handlers for `toggleCamera` and `flipCamera`
- [ ] 5.24 Update `androidVoiceCallPlugin.ts` shape to include `toggleCamera`, `flipCamera`, and the new event listeners
- [ ] 5.25 Update `VoiceCallServiceNative.ts` to subscribe to `cameraStateChanged` and `facingModeChanged` and proxy `toggleCamera`/`flipCamera`/`getCallKind`/`getLocalStream` (returns null)/`isCameraOff` methods
- [ ] 5.26 Extend `NativeVoiceCallManagerListenerTest.java` with throw-isolation cases for `onRemoteVideoTrack`, `onCameraStateChanged`, `onFacingModeChanged`
- [ ] 5.27 Add new `CallKindRoutingTest.java`: given a `PendingIncomingCall` blob with `callType="video"`, confirm `IncomingCallActivity` extras and FGS Intent carry `EXTRA_CALL_KIND="video"` through to `acceptIncomingCall`
- [ ] 5.28 Verify Android unit tests pass; manual Android↔Android and Web↔Android smoke tests (mic+camera permission flow, both directions, lockscreen accept, PIN-locked accept)

## 6. Call history `call-media-type` tag

- [ ] 6.1 Modify `Messaging.createCallEventMessage` and `Messaging.createLocalCallEventMessage` to accept `callKind: CallKind`; emit `['call-media-type', callKind]` on the rumor
- [ ] 6.2 Modify web `VoiceCallService.cleanup` / `finishCall` to pass `this.callKind` to history rumor builders
- [ ] 6.3 Modify Java `NativeVoiceCallManager.authorHistoryEvent` and `CallHistoryDecision.decide` to accept call kind and emit the new tag
- [ ] 6.4 Modify Java `MessagingBridge.sendCallHistoryRumor` and `AndroidVoiceCallPlugin.emitCallHistoryWriteRequested` payload to include `callKind`
- [ ] 6.5 Modify the JS-side `LocalCallEventCreator` consumer in `VoiceCallServiceNative` to pass through the kind
- [ ] 6.6 Update call-history rendering UI to show a video-camera affordance when `call-media-type === 'video'`
- [ ] 6.7 Extend `CallHistoryDecisionTest.java` with `callKind` parameter rows
- [ ] 6.8 Add JS test that voice and video calls produce rumors with the correct `call-media-type` tag (and that legacy rumors without the tag default to voice in the renderer)
- [ ] 6.9 Verify all test gates pass

## 7. Manual end-to-end verification & spec sync

- [ ] 7.1 Run full manual checklist: web↔web video; android↔android video; web↔android video both directions; voice regression; back-compat (caller sends video to forced-voice-only client); PIN-locked accept with video; back-to-back video calls; permission denial path
- [ ] 7.2 Run `openspec validate add-video-calling --strict` (already green; reconfirm after any spec edits)
- [ ] 7.3 Run `openspec sync-specs add-video-calling` (or equivalent skill) to merge deltas into `openspec/specs/voice-calling/spec.md`
- [ ] 7.4 Archive the change once production verification is complete (`openspec archive add-video-calling --yes`)
