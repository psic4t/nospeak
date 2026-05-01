## Context

The voice-calling capability runs on a single `RTCPeerConnection` per side,
signaled over NIP-AC (kind 21059 gift wraps over inner kinds 25050–25054).
Web (`VoiceCallService.ts`) and Android (`NativeVoiceCallManager.java`) keep
intentionally separate code paths but share the same wire format, the same
state machine (six statuses, eight end reasons), and the same call-history
flow (kind 1405 events).

The codebase was scaffolded with video in mind:

- `AndroidManifest.xml:14` already declares `android.permission.CAMERA`.
- `src/lib/core/voiceCall/androidVoiceCallPlugin.ts:20` types
  `PendingIncomingCall.callType` as `'voice' | 'video'`.
- `Messaging.ts` and `NativeBackgroundMessagingService.java` already attach a
  `['call-type', 'voice']` tag to inner kind 25050 — value is hard-coded but
  the plumbing exists.
- The Java `dispatchInnerNipAcEvent` persists `callType` from the inner
  event into SharedPreferences (treating it opaquely today).

This design parameterizes that latent capability over `CallKind = 'voice' |
'video'` and adds the missing media plumbing (video tracks, renderers, camera
permission, camera controls).

## Goals / Non-Goals

**Goals:**

- Symmetric one-to-one video calling (both peers send + receive video from
  call setup).
- Full platform parity: web/PWA and Android Native, capable of calling each
  other.
- Camera-on/off and front/back camera flip controls during a call.
- No mid-call SDP renegotiation (camera-off uses local track `enabled` flip).
- Reuse the existing NIP-AC inner kinds (25050–25054) — only the `call-type`
  tag's allowed value set is widened.
- Reuse the existing ICE buffering, follow-gating, multi-device, staleness,
  dedup, and anti-impersonation requirements without modification.
- Single source of truth: extend the existing `voice-calling` capability spec
  rather than creating a parallel `video-calling` capability.

**Non-Goals:**

- Mid-call upgrade from voice to video (would require SDP renegotiation;
  deferred).
- Picture-in-picture / minimize-to-bubble UX. Deferred.
- Group video calls (current voice-calling spec is 1:1 only; unchanged here).
- Backwards-compatibility adapters for older clients that don't understand
  `['call-type','video']`. We rely on natural SDP-level degradation; if older
  clients fail, the user retries with a voice call.
- Distinct video ringtones/ringbacks. Reuse existing tones.
- Screen sharing, virtual backgrounds, video filters. Out of scope.

## Decisions

### 1. Symmetric video negotiated up front (not audio-with-video-toggle)

Both peers add audio + video tracks before `createOffer`/`createAnswer`. The
SDP carries both m-lines. Camera-off is implemented by toggling
`localVideoTrack.enabled = false` (web) or `track.setEnabled(false)`
(Android), which causes the WebRTC stack to send black/silent frames. No SDP
renegotiation occurs.

**Why**: Avoids the complexity of mid-call renegotiation (a second offer/answer
pair, a new state in the machine, race conditions with simultaneous toggles).
The MVP scope explicitly excludes "audio-first then upgrade to video", so this
is the simpler and tighter design.

**Alternatives considered:**

- Audio-first with `addTransceiver('video')` mid-call — rejected for the MVP;
  introduces renegotiation complexity for a feature we don't need yet.
- Two parallel peer connections (one audio, one video) — rejected; doubles
  ICE storms, doubles state, no benefit since BUNDLE handles both on one
  transport.

### 2. Generalize the existing `voice-calling` capability rather than create `video-calling`

The voice-calling spec at `openspec/specs/voice-calling/spec.md` becomes the
authoritative spec for both voice and video calls. Affected requirements are
modified in place; new requirements (camera permission, local self-view
rendering, remote video rendering, camera controls, default speaker on
video) are added under the same capability.

**Why**: The lifecycle, signaling transport, ICE handling, follow-gating,
multi-device behavior, staleness/dedup, anti-impersonation, and call-history
flow are all shared between voice and video. Splitting into two capabilities
forces every shared requirement to be either duplicated or cross-referenced,
risking drift.

**Alternatives considered:**

- New `video-calling` capability with deltas — rejected; too much duplication
  for the small amount of video-specific behavior.

### 3. Single `['call-type','video']` value on inner kind 25050; receivers default to `'voice'` when tag absent

No new inner kinds. Kind 25050 carries the `call-type` tag with a value drawn
from `{'voice','video'}`. Kinds 25051–25054 remain media-agnostic (the SDP in
the answer is the source of truth for what tracks are present).

**Why**: The wire format already plumbs this tag end-to-end on both stacks.
Zero new inner kinds means no expansion of the dispatch surface and no parallel
follow-gate / staleness / dedup logic. The default-to-voice behavior preserves
back-compat with any historical clients that only ever sent voice offers.

**Alternatives considered:**

- New inner kinds 25055–25059 for video — rejected; doubles the dispatch
  surface, no benefit.
- Pure SDP detection (no tag) — rejected; the Android `IncomingCallActivity`
  needs to know the kind before parsing SDP to render the right UI.

### 4. Camera-off uses `track.enabled = false`, not `removeTrack`/renegotiation

When the user taps camera-off, the local video track's `enabled` flag flips to
`false`. WebRTC sends black frames to the peer. The peer keeps the remote
`<video>` element / `SurfaceViewRenderer` mounted — the video just goes black
(or shows the last frame, depending on the platform). No SDP renegotiation.

**Why**: Mirrors the existing mute pattern (audio track `enabled`). Avoids the
complexity of removing and re-adding tracks mid-call. Standard WebRTC pattern.

**Alternatives considered:**

- `removeTrack` + renegotiation — rejected; complex and unnecessary.
- Stop the camera capturer entirely — possible on Android, but stopping and
  restarting the camera takes ~1 second on real devices and creates visible
  black flicker. Track-enabled is instant.

### 5. Camera flip uses `replaceTrack` (web) / `CameraVideoCapturer.switchCamera` (Android), no SDP renegotiation

Web: the existing video sender's `replaceTrack(newVideoTrack)` swaps the local
track without touching the SDP. The new track comes from
`getUserMedia({video:{facingMode}})`.

Android: `CameraVideoCapturer.switchCamera(handler)` is the standard
Stream-WebRTC pattern that swaps which physical camera feeds the same
`VideoSource`/`VideoTrack`. No track replacement, no SDP change.

**Why**: Both APIs are designed for this; no renegotiation is needed.

**Alternatives considered:**

- Stop and recreate the entire video track — rejected; visible glitch and
  unnecessary.

### 6. New `AndroidCamera` Capacitor plugin for runtime camera permission

Mirrors `AndroidMicrophonePlugin`. Methods: `checkPermission`,
`requestPermission`. Used by `VoiceCallServiceNative.initiateCall('video')`
and `acceptCall()` (when the offer was a video call).

**Why**: Matches the existing pattern. Keeps the permission dance off the
critical path of `getUserMedia` (which on Android via Capacitor would also
prompt, but the explicit check lets us fail fast and show our own UI before
WebRTC initialization).

**Alternatives considered:**

- Extend `AndroidMicrophonePlugin` with a camera permission method — rejected;
  separation of concerns matters more than DRY here.
- Rely on `getUserMedia` to prompt — rejected for Android because the prompt
  appears mid-`getUserMedia` and complicates error handling.

### 7. Default speakerphone ON for video calls at ACTIVE

When a video call transitions to `active`, set `isSpeakerOn = true`
automatically. User can still toggle off.

**Why**: Users hold phones away from their face during video calls; the
earpiece is wrong. Standard pattern across Signal/WhatsApp/etc.

### 8. Call history kind 1405 gains `['call-media-type', 'voice'|'video']`

Existing tags on the call-history rumor are preserved unchanged (`['p',...]`,
`['type','call-event']`, `['call-event-type', X]`, `['call-initiator', ...]`,
optional `['call-duration', N]`). Add one tag indicating media type. Receivers
default to `'voice'` when the tag is absent.

**Why**: Lets the call-history UI render a video-camera icon next to video
calls without requiring a new event kind.

### 9. EglBase shared between `NativeVoiceCallManager` and `ActiveCallActivity`

The manager owns the `EglBase` instance (created lazily in `ensureFactory`,
released in `dispose()`). The Activity binds to the FGS, retrieves the
`EglBase` via a getter, and uses its `getEglBaseContext()` to initialize both
`SurfaceViewRenderer`s. The Activity must NOT release the `EglBase` — only
the manager does, on call teardown.

**Why**: Renderers, encoders, and decoders all need to share GL context; using
two `EglBase` instances would split the GL state and break rendering.

**Risks → Mitigation:**

- If the Activity outlives the manager (rare race during teardown), renderer
  release on a destroyed `EglBase` could crash. Mitigation: check
  `manager.isDisposed()` before any renderer op in the Activity; null-check
  on every callback.

## Risks / Trade-offs

- **Older voice-only clients fail to handle video offers** → Documented
  non-goal; user retries with voice. We don't ship capability advertisement.
- **Performance on low-end Android (< 2 GB RAM)** → Default 640×480 @ 30 fps
  with hardware H.264/VP8 decoders should be fine. If not, the
  `DefaultVideoDecoderFactory` falls back to software VP8.
- **Camera permission denied during accept** → The call is aborted with a
  clear error; the user can retry or switch to a voice call. No silent
  downgrade — the caller's UI promised video.
- **Battery / thermal load** → Video calls are inherently more expensive than
  voice. Speakerphone defaults further raise this. Acceptable trade-off; users
  expect this.
- **Camera capturer + GL surface lifecycle bugs on Android** → Mitigated by
  test coverage (`NativeVoiceCallManagerListenerTest`) and by following the
  Stream-WebRTC sample patterns for `Camera2Enumerator` /
  `CameraVideoCapturer` / `SurfaceTextureHelper` / `SurfaceViewRenderer`.
- **Mirror local self-view on front camera** → Standard UX; achieved via
  `localRenderer.setMirror(isFrontCamera)`.
- **Wire-format fixture regeneration must stay in lock-step on both sides**
  → Existing `wireParity.test.ts` (JS) and `NativeNipAcSenderTest.java`
  (Java) both consume the same fixture and assert the same canonical event
  IDs. Adding video cases regenerates IDs in one place; both tests must pass.

## Migration Plan

The change ships in seven phases (see `tasks.md`). Each phase ends in a green
test suite and is independently mergeable:

1. OpenSpec scaffolding (this change).
2. Type & Svelte store foundation (no behavior change).
3. Wire-format generalization (parameterize `call-type`; add fixture cases).
4. Web/PWA video implementation (web↔web video calls work end-to-end).
5. `AndroidCamera` Capacitor plugin (permission only).
6. Android native video implementation (full parity).
7. Call-history `call-media-type` tag.

After all phases ship and end-to-end smoke tests pass on both platforms,
sync the spec deltas into `openspec/specs/voice-calling/spec.md` and archive
the change.

**Rollback**: each phase is small enough to revert in isolation. The
wire-format change (Phase 3) is the only one that touches the
network-protocol surface; if production traffic shows incompatibility issues,
revert that single commit and the offers go back to always-voice.

## Open Questions

None at this stage — the brainstorm with the human covered all major decision
points. Remaining decisions are tactical (e.g., exact icon assets for the
notification, exact PiP corner) and will be made during implementation.
