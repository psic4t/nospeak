# Change: Add NIP-AC Call Renegotiate (kind 25055) with mid-call voice→video upgrade

## Why

The voice-calling capability implements NIP-AC PR #2301 inner kinds 25050–25054
but silently drops the sixth kind defined by the draft, **kind 25055 (Call
Renegotiate)**. This leaves a receive-path interop hole: a strict NIP-AC peer
(e.g. Amethyst) that initiates a mid-call media change — most importantly,
turning their camera on during a voice call — gets no answer back from
nospeak and their renegotiation hangs.

The `add-video-calling` change shipped voice + video calls but locked the
`callKind` for the lifetime of a call. That was a deliberate non-goal at the
time. Now that video is in production, the natural next step is mid-call
voice→video upgrade, which **requires** kind 25055 because the original
kind-25050 offer for a voice call has no video transceiver to toggle.

## What Changes

- Add `NIP_AC_KIND_RENEGOTIATE = 25055` constant; widen the receive-path kind
  allow-list and the `VoiceCallSignal` discriminated union to include it.
- New typed sender `Messaging.sendCallRenegotiate(npub, callId, sdp)` —
  identical wire shape to a kind-25050 offer except (a) kind = 25055,
  (b) `alt` = `"WebRTC call renegotiation"`, (c) **no `call-type` tag**,
  (d) **no self-wrap**.
- Receive flow on web (`VoiceCallService.handleRenegotiate`) and Android
  native (`NativeVoiceCallManager.handleRenegotiate`): accept a 25055 only
  when the local status is `connecting` or `active` AND the `call-id`
  matches the active call. Apply via `setRemoteDescription` → `createAnswer`
  → `setLocalDescription` → publish a kind-25051 Call Answer (no extra tags).
  Reject in any other state. Reject with mismatched `call-id`.
- **Glare handling** when both peers send 25055 simultaneously: detect via
  `signalingState === 'have-local-offer'`. Compare lowercase hex pubkeys
  lexicographically — **higher pubkey wins**. The losing side calls
  `setLocalDescription({type: 'rollback'})` and then accepts the winner's
  offer normally. The winning side ignores the loser's 25055 and continues
  waiting for its own answer.
- **Voice → video mid-call upgrade UX**: a new "Add video" button on the
  active-call surface (web `ActiveCallOverlay.svelte` and Android
  `ActiveCallActivity`) is visible only when `callKind === 'voice'` AND
  `status === 'active'` AND no renegotiation is in flight. Tapping it
  acquires camera (web `getUserMedia`, Android `AndroidCamera` plugin),
  attaches a video track to the existing peer connection, creates a new
  SDP offer, and sends it as kind 25055. On receipt of the kind-25051
  answer, the local `callKind` flips to `'video'` and the existing video UI
  takes over.
- New store field `VoiceCallState.renegotiationState: 'idle' | 'outgoing' |
  'incoming' | 'glare'` so the UI can disable the upgrade button while a
  renegotiation is pending.
- Mute, camera-off, and camera-flip continue to use the existing
  track-`enabled` and `replaceTrack` / `switchCamera` paths. They are NOT
  switched to renegotiation. (Track-level toggles are instant; renegotiation
  takes a round-trip.)
- Wire-fixture additions and parity tests on both stacks. Glare-specific
  unit tests on both stacks.
- 30 s timeout on outgoing renegotiations; on timeout we roll back the
  local offer, remove the just-attached video track, surface an error toast,
  and leave the underlying call active (the voice call survives).

This change also closes the second of the three known NIP-AC compliance
gaps documented in the May 2026 compliance review (the other two:
60→20 s staleness window — deliberately deferred — and group calls — out of
scope). After this change, nospeak is fully compliant with the 1‑on‑1
voice + video subset of NIP-AC PR #2301.

## Capabilities

### New Capabilities

None. The work extends the existing `voice-calling` capability.

### Modified Capabilities

- `voice-calling` — adds receive + send support for kind 25055, glare
  handling, voice→video mid-call upgrade UX, and a new
  `renegotiationState` field. Lifecycle, signaling-transport, audio-capture,
  active-call-controls, and call-history requirements are touched.

## Impact

- **Code (web)**:
  - `src/lib/core/voiceCall/constants.ts` — add `NIP_AC_KIND_RENEGOTIATE`.
  - `src/lib/core/voiceCall/types.ts` — extend `VoiceCallSignal`,
    `NipAcSenders`, `VoiceCallBackend`, `VoiceCallState`.
  - `src/lib/core/voiceCall/VoiceCallService.ts` — new `handleRenegotiate`,
    `requestVideoUpgrade`, glare branch, renegotiation timeout, refactor
    `handleAnswer` to distinguish initial vs renegotiation answers.
  - `src/lib/core/voiceCall/VoiceCallServiceNative.ts` — proxy
    `requestVideoUpgrade` to the plugin.
  - `src/lib/stores/voiceCall.ts` — `renegotiationState` field +
    `setRenegotiationState`.
  - `src/lib/core/Messaging.ts` — new `sendCallRenegotiate`; receive-path
    kind allow-list extension; self-event filter row for self-renegotiate
    (always ignored).
  - `src/lib/components/ActiveCallOverlay.svelte` — "Add video" button.
- **Code (Android)**:
  - `NativeVoiceCallManager.java` — `handleRenegotiate`, `requestVideoUpgrade`,
    glare branch, rollback path.
  - `NativeBackgroundMessagingService.java` — `sendVoiceCallRenegotiate`,
    extend `dispatchInnerNipAcEvent` to route 25055.
  - `AndroidVoiceCallPlugin.java` — `@PluginMethod requestVideoUpgrade`,
    new `renegotiationStateChanged` event emitter.
  - `ActiveCallActivity.java` + `res/layout/activity_active_call.xml` —
    "Add video" button, gated visibility.
  - `src/lib/core/voiceCall/androidVoiceCallPlugin.ts` — typed shim for
    `requestVideoUpgrade` and `renegotiationStateChanged`.
- **Wire format**: kind 25055 is now legal on send and receive. Inner-event
  shape mirrors kind 25050 minus the `call-type` tag. No new outer kinds.
  Wire-parity fixture (`tests/fixtures/nip-ac-wire/inner-events.json`)
  gains two cases (`voice-to-video-renegotiate-25055`,
  `wrong-call-id-renegotiate-25055`).
- **Tests**: `VoiceCallService.test.ts`, `wireParity.test.ts`,
  `voiceCall.test.ts` (store), `MessagingService.test.ts`,
  `NativeNipAcSenderTest.java`, `NativeVoiceCallManagerListenerTest.java`,
  new `RenegotiationGlareTest.java`.
- **Permissions**: no new permissions. Camera permission already declared
  by `add-video-calling`; same `AndroidCamera` plugin path is reused.
- **Dependencies**: none new.
- **Docs**: `AGENTS.md` voice-calling section will note 25055 support
  after archive.
