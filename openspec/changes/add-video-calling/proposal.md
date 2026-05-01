# Change: Add basic video calling on top of voice calling

## Why

Voice calling over NIP-AC is now stable on web/PWA and Android. Video calling
is the natural next step: peers expect a "video call" button alongside the
voice-call button, and the existing `RTCPeerConnection`/NIP-AC stack already
supports media-agnostic SDP/ICE signaling. The codebase was scaffolded with
video in mind — `CAMERA` permission is declared, the Capacitor plugin types a
`callType: 'voice' | 'video'`, and the `call-type` tag is plumbed end-to-end
but hard-coded to `'voice'`.

## What Changes

- Add `CallKind = 'voice' | 'video'` as a first-class concept in the JS
  voice-call backend, the Svelte store, the Java `NativeVoiceCallManager`, and
  the Android Capacitor plugin.
- Allow callers to initiate either voice or video calls via a separate
  video-camera button in the chat header.
- Negotiate audio + video tracks symmetrically up front when `kind === 'video'`
  (no mid-call SDP renegotiation in this MVP).
- Render full-screen remote video with a small local self-view PiP on both web
  (`<video>` elements) and Android (`SurfaceViewRenderer`s in
  `ActiveCallActivity`).
- Add camera-on/off (local track `enabled` flip) and front/back camera flip
  (`replaceTrack` on web, `CameraVideoCapturer.switchCamera` on Android)
  controls.
- Add an `AndroidCamera` Capacitor plugin mirroring `AndroidMicrophone` for
  runtime permission handling.
- Default speakerphone to ON when a video call goes ACTIVE.
- Lock in `['call-type','video']` as a legal value on inner kind 25050;
  receivers default to `'voice'` when the tag is absent.
- Tag call-history kind 1405 events with
  `['call-media-type', 'voice'|'video']` (default `'voice'` when absent).
- Notification text/icon on Android reflect the call kind ("Video call with
  Alice" vs "Voice call with Alice").
- **BREAKING (informal)**: older clients receiving a video offer may degrade
  to audio-only via SDP negotiation, or fail to connect. We accept this rather
  than introducing capability advertisement.

## Capabilities

### New Capabilities

None. The video calling work is integrated into the existing `voice-calling`
capability rather than split into a parallel `video-calling` capability,
because the lifecycle, signaling transport, ICE handling, follow-gating,
multi-device behavior, and call-history flow are all shared.

### Modified Capabilities

- `voice-calling` — generalized from voice-only to voice + video. Affected
  requirements: lifecycle, signaling transport, capture constraints, call
  history, foreground service notification, lock-screen activity, active-call
  activity, pending-call handoff, JavaScript backend abstraction.

## Impact

- **Code**:
  - `src/lib/core/voiceCall/` — `types.ts`, `constants.ts`, `VoiceCallService.ts`
    (web), `VoiceCallServiceNative.ts`, `androidVoiceCallPlugin.ts`,
    `factory.ts` (no functional change).
  - `src/lib/stores/voiceCall.ts` — new fields and mutators.
  - `src/lib/components/ActiveCallOverlay.svelte`,
    `IncomingCallOverlay.svelte`, chat-header component(s) with the call
    buttons.
  - `src/lib/core/Messaging.ts` — `sendOffer` accepts `callType` option;
    call-history rumor builders accept `callKind`.
  - Android: `NativeVoiceCallManager.java`, `VoiceCallForegroundService.java`,
    `IncomingCallActivity.java`, `ActiveCallActivity.java`,
    `AndroidVoiceCallPlugin.java`, new `AndroidCameraPlugin.java`,
    `NativeBackgroundMessagingService.java`, plus
    `res/layout/activity_active_call.xml`.
- **Wire format**: `['call-type','video']` becomes a legal value on inner kind
  25050. No new kinds. Inner kinds 25051–25054 unchanged. Wire-parity fixture
  (`tests/fixtures/nip-ac-wire/inner-events.json`) gains new cases.
- **Tests**: `VoiceCallService.test.ts`, `wireParity.test.ts`,
  `voiceCall.test.ts` (store), `NativeVoiceCallManagerListenerTest.java`,
  `NativeNipAcSenderTest.java`, `CallHistoryDecisionTest.java`, plus a new
  `CallKindRoutingTest.java`.
- **Permissions**: `CAMERA` already declared in `AndroidManifest.xml`; no
  manifest delta. Web `getUserMedia` will prompt for camera the first time.
- **Dependencies**: no new npm packages. Android already pulls in
  `io.getstream:stream-webrtc-android`, which includes
  `Camera2Enumerator`, `CameraVideoCapturer`, `SurfaceViewRenderer`,
  `EglBase`, and the default video encoder/decoder factories.
- **Docs**: `AGENTS.md` voice-calling section will need a follow-up note that
  the same code paths cover video; deferred to archive time.
