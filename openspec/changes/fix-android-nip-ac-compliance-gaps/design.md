# Design: Fix Android NIP-AC compliance gaps

## Context

A NIP-AC compliance audit identified three native-Android-only spec
deviations. All are invisible while the WebView is alive (the JS path
is already compliant) but break compliance the moment the JS layer is
dead — which is exactly the scenario the native pipeline exists to
serve.

The three gaps are independent in their immediate symptom but share a
single piece of architecture: `NativeBackgroundMessagingService.handleNipAcWrapEvent`,
the function that decrypts a kind-21059 wrap, verifies the inner
event, and routes it. Two of the three fixes touch this function
directly; the third (busy auto-reject) is a new branch added to the
same function. Bundling them keeps the change scoped to a single
state machine.

The matching JS path lives in `Messaging.handleNipAcWrap` and
delegates to `VoiceCallService.handle*` for state-machine work. We
deliberately do NOT change the JS path — it is already compliant —
except to extend wire-parity test fixtures.

## Goals

- Bring the native NIP-AC path to byte-equivalent and
  behavior-equivalent compliance with NIP-AC for the three audited
  concerns.
- Preserve the JS path's correctness; do not duplicate logic that the
  JS path already performs while running.
- Keep new logic testable without Robolectric or device emulation by
  extracting decision policies into pure-Java helper classes
  (precedent: `CallHistoryDecision`).

## Non-Goals

- Group calls (NIP-AC §"Group Calls"). Out of scope for one-to-one.
- Bumping `NIP_AC_STALENESS_SECONDS` from 60 s to 20 s.
- Reorganizing the dedup ring (JS uses 256, Java uses 500 shared with
  kind-1059).
- Tagging existing tests with NIP-AC's published `E*/R*/I*/G*` IDs.
- Changes to the kind-1405 call-history pipeline.

## Decisions

### Native busy auto-reject is additive, not a replacement

The JS path detects busy by inspecting `voiceCallState`
(`Messaging.handleNipAcWrap` reads `voiceCallState` via
`VoiceCallService`). When the WebView is alive, the JS path runs and
correctly auto-rejects. When the WebView is dead, the JS path doesn't
run and the native path takes over.

We gate native busy detection on `NativeVoiceCallManager.isBusy()`,
which is true only when native owns the call (FGS is up, manager is
in a non-idle/non-ended status). When JS owns the call, the native
manager is idle and the native path falls through to the normal
follow-gate / FSI ringer path. No double-rejects.

**Alternative considered:** Move busy detection entirely to native
even when the WebView is alive. Rejected — it forces the FGS to be up
for any in-foreground 2nd-call scenario, which is not the case today
and would force unrelated lifecycle changes.

### Global ICE buffer lives in NativeBackgroundMessagingService

The `NativeVoiceCallManager` doesn't exist yet during the buffer-needed
window (the offer arrives → FSI rings → user accepts → FGS starts →
manager built). The buffer must outlive the manager's absence. The
messaging service is the right home: it's the entity that receives
inbound wraps, it lives for the duration of the messaging
subscription, and it is exactly the parallel of the JS
`VoiceCallService` instance that owns `globalIceBuffer` on the web
side.

**Alternative considered:** SharedPreferences persistence. Rejected —
ICE candidates are short-lived (60 s expiry) and a process-death
recovery scenario is irrelevant; if the messaging service dies, the
call is already dead.

**Alternative considered:** A static field on a holder class.
Rejected for testability and encapsulation; dependency-injecting
`GlobalIceBuffer` lets us write a clean `GlobalIceBufferTest`.

### Buffer caps and expiry

- **Per-sender cap:** 32 candidates. ICE trickle for a single peer
  rarely exceeds 10–15 candidates in practice.
- **Total sender cap:** 256. Bounds memory under attack scenarios
  (hostile sender flooding ICE candidates from many ephemeral
  pubkeys).
- **TTL:** 60 s, matching `NIP_AC_STALENESS_SECONDS`. NIP-AC's
  staleness rule already says inner events older than 60 s SHOULD be
  dropped, so a candidate older than 60 s is by definition
  uninteresting.
- **Eviction:** opportunistic on `add` (no timer thread), drain
  scrubs stale entries too. Idle buffers slowly leak memory until
  the next add for that peer or the next service restart; in
  practice every buffer entry is consumed within seconds (call
  accept) or evicted within 60 s (offer never accepted).

### Self-event dismissal extracts a pure-Java decision class

Following the precedent of `CallHistoryDecision` (introduced in the
2026-05-01 archive `add-native-voice-calls`), we extract
`NativeSelfDismissDecision.decide(...)` as a pure function over
primitive inputs (kind, callIds, status name). The
`NativeBackgroundMessagingService` does the I/O (read SharedPrefs,
look up manager, invoke the relevant cancellation), the helper
makes the policy decision. This is testable from a vanilla JVM
unit test without instantiating `NativeBackgroundMessagingService`.

### Idempotent dismissal

`handleRemoteCallCancellation(callId)` already cancels the
notification and clears SharedPrefs idempotently — calling it twice
is a no-op. This means the JS-path dismissal and the native-path
dismissal can both fire (e.g. a transient WebView wake-up) without
creating UI artifacts.

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| Native busy-detect races JS busy-detect when WebView is alive | Native gates on `NativeVoiceCallManager.isBusy()`; the manager is idle when JS owns the call. |
| Global ICE buffer leaks memory if offers don't arrive | 60 s TTL evicted on add; total-sender cap. |
| Self-dismissal fires when JS already dismissed in-process | `handleRemoteCallCancellation` is idempotent; double-end on the manager is gated by `callMismatch` plus a status guard inside `endForAnsweredElsewhere`. |
| Per-sender cap of 32 too low for some networks | Bumped to 64 in a follow-up if telemetry shows drops; not a wire-format change. |
| Pure-Java helpers diverge from JS reference rules | The decision matrix is small enough to inline as a comment in each helper that quotes NIP-AC's spec text verbatim. |

## Migration Plan

None. All changes are local-platform behavior:

- New `reason` parameter has a backwards-compatible default for
  existing callers (pass `null` → empty content, identical to
  today).
- New global ICE buffer is an in-memory addition with no on-disk
  state.
- New self-event filter exception only changes behavior for
  self-authored 25051/25054 events; the previous behavior (drop) was
  the wrong thing to do, and no other consumer depends on it.

No SharedPreferences shape changes, no Dexie schema changes, no wire
changes affecting remote peers.

## Open Questions

- Should `NativeVoiceCallManager.endForAnsweredElsewhere(callId)`
  also play the existing "ringing stopped" UI cue, or is silent
  dismissal preferred? The JS path is silent (`setEndedAnsweredElsewhere`
  transitions state without UI noise). Default to silent for parity.

- Do we want a debug log line when the native busy auto-reject
  fires? Yes, gated by `isDebugBuild()` to match other NIP-AC log
  lines.
