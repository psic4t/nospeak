# Design: Call Renegotiation (NIP-AC kind 25055)

## Context

The voice-calling capability (post-`add-video-calling`) supports symmetric
voice and video calls negotiated up front via kind 25050 with a `call-type`
tag of `'voice'` or `'video'`. Once a call is `active`, the `callKind` is
fixed for its lifetime: mute, camera-off, and camera-flip are all
implemented at the WebRTC track level (`track.enabled`, `replaceTrack`,
`CameraVideoCapturer.switchCamera`) without touching SDP.

NIP-AC PR #2301 defines a sixth signaling kind, **25055 (Call Renegotiate)**,
for mid-call SDP changes. Today the codebase silently drops it
(`Messaging.ts:416-430`). The most useful renegotiation flow — and the one
this change implements — is **voice → video mid-call upgrade**.

## Goals / Non-Goals

**Goals:**

- Receive 25055 from peers in `connecting` or `active` and respond with a
  kind-25051 Call Answer (no extra tags).
- Send 25055 ourselves only as part of a single, user-initiated UX flow:
  voice → video upgrade.
- Implement the draft's glare resolution exactly: pubkey lex-compare,
  higher wins, loser rolls back.
- Full web/PWA + Android native parity from day one.
- Reuse the existing video media stack from `add-video-calling`
  (`getUserMedia`, `VIDEO_MEDIA_CONSTRAINTS`, `attachLocalVideoTrack`,
  `AndroidCamera` plugin, `SurfaceViewRenderer` rendering).

**Non-Goals:**

- Mid-call video → voice downgrade. Track-disable is sufficient for the
  user-facing case ("turn off my camera").
- Codec / bitrate auto-renegotiation on quality drops.
- Mute and camera-off via 25055. Both stay at track level; instant UX
  matters more than spec purity here.
- Group calls. Existing 1‑on‑1 limitation unchanged.
- Backwards-compatibility shims for peers that don't speak 25055. The voice
  call continues unaffected if the peer drops our 25055; only the upgrade
  fails.
- Self-wrapping 25055. The draft does not require it; renegotiations are
  per-active-call and naturally device-local. Multi-device handling for
  in-flight renegotiation is out of scope; in practice only one device is
  ever the active endpoint of a call.

## Decisions

### 1. Single inner kind 25055 added; no other wire changes

The wire format gains exactly one new inner kind. No new outer kinds.
The inner event shape mirrors kind 25050 minus the `call-type` tag (the
original 25050 already established the call type at setup; renegotiation
preserves the call's `call-id` and adds/removes m-lines). No `call-type`
on 25055 means receivers MUST detect media changes by parsing the SDP, not
by tag. This matches the draft text.

**Why**: Minimal surface area. Reuses existing `p` / `call-id` / `alt` tag
plumbing. Receiving stack already verifies signature, applies staleness
and dedup, and runs the self-event filter — all before kind dispatch — so
adding 25055 to the allow-list inherits all of those for free.

### 2. Renegotiation answer reuses kind 25051 with no special marker

Per the draft, the response to a 25055 is a kind 25051 (Call Answer). The
sender does not embed any "this is a renegotiation answer, not the original
answer" marker — both sides know from local state. The receive-side
distinction lives in `VoiceCallService.handleAnswer`:

- If `status === 'outgoing-ringing'` → treat as initial answer (existing
  path: transition to `connecting`).
- Else if `renegotiationState === 'outgoing'` → treat as renegotiation
  answer: `setRemoteDescription` only; do NOT change `status`.
- Else → drop.

**Why**: Matches the draft. Avoids inventing nospeak-specific markers that
break interop. The state machine cleanly distinguishes the two cases.

**Alternatives considered:**

- Add a dedicated kind 25056 "renegotiation answer". Rejected — the draft
  is clear that kind 25051 is reused, and inventing a kind would break
  Amethyst interop.
- Add a tag like `['renegotiation', 'true']` on the kind-25051 answer.
  Rejected — same reason.

### 3. Glare resolution: lowercase hex pubkey lex compare, higher wins, loser rolls back

The draft says: "the peer with the **higher** pubkey wins (their offer
takes priority). The losing peer MUST roll back their local offer via
`setLocalDescription(rollback)`". Pseudocode for the receive side:

```
on receive 25055 with valid call-id, valid status:
    if peerConnection.signalingState === 'have-local-offer':
        # Glare. Compare lowercase hex pubkeys.
        if myPubkeyHex > theirPubkeyHex:
            # We win. Drop their offer; keep waiting for their 25051 to ours.
            renegotiationState = 'glare'   # informational; cleared on our answer
            return
        else:
            # We lose. Roll back our pending offer.
            await peerConnection.setLocalDescription({type: 'rollback'})
            # Drop the just-attached local video track if upgrade was outgoing.
            removeOutgoingUpgradeArtifacts()
            renegotiationState = 'incoming'  # now processing theirs
            # fall through to apply their offer normally
    else:
        renegotiationState = 'incoming'
    await peerConnection.setRemoteDescription({type: 'offer', sdp})
    # if their offer adds a video m-line and we don't have local video yet,
    # acquire camera here; on deny, set transceiver direction='recvonly'
    answer = await peerConnection.createAnswer()
    await peerConnection.setLocalDescription(answer)
    senders.sendAnswer(npub, callId, answer.sdp)
    if answer SDP carries video m-line:
        callKind = 'video'
        store.setActive({...current, callKind: 'video'})
    renegotiationState = 'idle'
```

**Why**: Exact compliance with the draft. Lowercase hex string
comparison is unambiguous, deterministic, and trivially equivalent across
languages.

**Alternatives considered:**

- Compare raw byte arrays of the pubkey. Rejected — same ordering for
  proper hex, but harder to reason about and to reproduce in tests.
- Just end the call on glare with `error` reason. Rejected by user
  decision; full compliance was selected.

### 4. Mute / camera-off / camera-flip stay at track level

Mute uses `audioTrack.enabled` (`VoiceCallService.ts:414`). Camera-off
uses `videoTrack.enabled` (`add-video-calling`). Camera-flip uses
`replaceTrack(newTrack)` on web and `CameraVideoCapturer.switchCamera()` on
Android — neither touches SDP transceivers, so no renegotiation is needed.
This change does NOT introduce 25055 for any of those flows.

**Why**: Track-level toggles are instant. Renegotiation has a network
round-trip and a brief media interruption window. The user expects mute to
mute now, not after a 200–500 ms RTT. Track-level toggles are also
already implemented and tested.

### 5. Voice → video upgrade is the only outbound flow in this change

Outbound 25055 is triggered exclusively by the user tapping "Add video" on
the active-call UI during a voice call. No automated outbound renegotiation
(no codec downgrades, no bandwidth adaption, no auto-recovery).

**Why**: User decision. Single, well-defined entry point keeps the test
matrix small and the UX predictable.

**Future work**: Video → voice downgrade could be added later; it would
follow the same pattern but call `removeTrack` and emit a 25055 with a
declined video m-line. Not in scope here.

### 6. 30-second timeout on outgoing renegotiation; rollback on expiry

A pending outgoing 25055 that doesn't receive a 25051 within 30 s triggers:

1. `peerConnection.setLocalDescription({type: 'rollback'})`.
2. Remove the just-attached video track from the local stream and the
   sender list.
3. Surface a non-blocking error toast ("Couldn't add video — call
   continues as voice").
4. Reset `renegotiationState` to `idle`.

The underlying voice call continues uninterrupted because the rollback
restores the pre-upgrade SDP state.

**Why**: Mirrors the existing `CALL_OFFER_TIMEOUT_MS` and
`ICE_CONNECTION_TIMEOUT_MS` design. 30 s is generous given the original
WebRTC negotiation usually completes inside 1–2 s.

### 7. New `renegotiationState` store field

Four-state enum: `'idle' | 'outgoing' | 'incoming' | 'glare'`. Drives:

- Visibility of the "Add video" button (only when `idle`).
- Optional spinner / disabled state on the upgrade button when not `idle`.
- Test assertions about the renegotiation lifecycle.
- Logs for debugging.

The `glare` state is set transiently on the winning side after detecting
glare; it clears once that side's outgoing answer round-trip completes.

### 8. Camera permission denial during incoming 25055 (peer adds video)

If a peer sends 25055 with a new video m-line and we lack camera permission
or the user denies the prompt:

- We still send a kind-25051 answer (so the peer doesn't time out).
- The video transceiver direction is set to `recvonly` — peer sees us as
  audio-only, but we render their video.
- The local `callKind` flips to `video` (because we are now rendering
  remote video) and the active-call UI switches to the video layout, but
  the local self-view stays hidden / placeholder.
- A toast informs the user "Camera blocked; you'll see them but they
  won't see you".

**Why**: Better UX than refusing the upgrade entirely. The peer's
intention to upgrade is honored; only the symmetry is degraded.

### 9. Native Android parity is required, not optional

Per user decision. Android's `NativeVoiceCallManager` gets full
renegotiation support in lockstep with web. The `add-video-calling`
infrastructure (camera plugin, `attachLocalVideoTrack`, `SurfaceViewRenderer`
wiring, `EglBase` ownership) is already in place; this change only adds
the renegotiation control flow on top.

**Why**: Without Android parity, an Android user can't accept a video
upgrade from a web peer, which would be a glaring asymmetry given web↔Android
voice and video are otherwise at full parity.

## Risks / Trade-offs

- **Browser/library `setLocalDescription({type:'rollback'})` quirks** —
  Standard WebRTC supports it; Stream-WebRTC supports it. We add a
  feature-detect with graceful fallback (end call with `error` reason if
  rollback throws).
- **Lex-compare ambiguity** — Pin to lowercase hex string compare in
  both stacks; assert in tests. Document explicitly in the spec.
- **`addTrack` ordering** — Web spec allows `addTrack` before
  `createOffer`; this is the path used. Tests assert the resulting
  transceiver is `sendrecv`.
- **Native PeerConnection ICE re-gathering** — Stream-WebRTC handles
  renegotiation ICE updates within the same PC. We don't generate a new
  `call-id`. New ICE candidates from the renegotiated SDP flow through the
  existing kind-25052 path.
- **UI thrash on `callKind` flip** — The Svelte and Android UIs already
  re-render reactively when `callKind` changes (proven by `add-video-calling`).
  This change only adds a single new transition (`voice` → `video`); the
  reverse is not implemented in this change.
- **Glare path is rarely exercised** — Add a debug query-param toggle
  during development that delays the outgoing 25055 by N ms so QA can
  reproduce. Hide behind a runtime flag for production.
- **Wire-fixture lock-step** — `wireParity.test.ts` and
  `NativeNipAcSenderTest.java` both consume the same fixture and assert
  the same canonical event IDs. Adding 25055 cases regenerates IDs in one
  place; both tests must pass.
- **Self-event filter for kind 25055** — Self-renegotiate is always
  ignored (same rule as self-ICE/self-hangup). Documented in the spec
  delta.

## Migration Plan

Seven phases (see `tasks.md`), each independently mergeable with green
test gates:

1. OpenSpec scaffolding (this design + proposal + tasks + delta spec).
2. Type, store, constants foundation.
3. Wire format: signing & receive dispatch; fixture additions.
4. Web/PWA renegotiation: receive + glare + send + upgrade UX.
5. Android native renegotiation parity.
6. Call-history `call-media-type` correctness for upgraded calls
   (mostly tests).
7. Spec sync, validation, archive.

**Rollback**: each phase reverts cleanly. Phase 3 is the only one that
touches the network protocol surface. If interop issues surface, revert
that single phase and the senders/receivers fall back to ignoring 25055.

## Open Questions

None blocking — the brainstorm captured all scope decisions. Tactical
choices (exact button copy, exact icon assets, exact toast wording) will
be made during implementation.
