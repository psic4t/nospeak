# Change: Fix Android NIP-AC compliance gaps

## Why

A NIP-AC compliance audit identified three native-Android-only deviations
from the spec. Each is invisible while the WebView is alive (the JS layer
covers the spec correctly), but each breaks compliance the moment the
JS layer is dead — which is the entire reason the native pipeline
exists.

1. **Native `sendVoiceCallReject` hard-codes `content=""`.** The JS
   sender (`Messaging.ts:2560`) propagates the caller's `reason` —
   including the spec-significant `"busy"` per NIP-AC §"Busy
   Rejection". The Java sender
   (`NativeBackgroundMessagingService.java:3535`) ignores the reason
   and writes an empty string, so a native-driven reject can never
   carry `"busy"` and remote peers cannot distinguish "user declined"
   from "user is on another call".

2. **No global pre-session ICE buffer.** NIP-AC §"ICE Candidate
   Buffering" mandates two layers: a global buffer keyed by sender
   pubkey for candidates that arrive before any peer connection
   exists, and a per-session buffer for candidates after the peer
   connection but before `setRemoteDescription` resolves. The web
   path implements both (`VoiceCallService.ts:131-141, 585-593`). The
   Android path implements only the per-session buffer
   (`NativeVoiceCallManager.handleRemoteIceCandidate:671-675`).
   When ICE candidates trickle in during the cold-start FSI window
   (offer received → ringing → user accepts → FGS starts → manager
   built), the candidates fall through to the "drop non-offer kind
   while app closed" branch at
   `NativeBackgroundMessagingService.java:3403-3408` and are silently
   discarded. The call relies on WebRTC re-trickle to recover.

3. **Self-authored Answer/Reject events blanket-dropped.** NIP-AC
   §"Multi-Device Support" requires that a self-authored kind 25051
   or 25054 with matching `call-id` dismisses any in-progress incoming
   ringer. The web path implements this for `incoming-ringing`
   (`Messaging.ts:454-468` → `VoiceCallService.handleSelfAnswer/Reject`).
   The native path drops every self-authored event regardless of kind
   at `NativeBackgroundMessagingService.java:3262-3264`. When the JS
   layer is dead and another device of the same user accepts/rejects,
   the lockscreen FSI ringer keeps ringing on this device.

All three are local-platform fixes with no wire-format breakage and no
changes to JS path correctness.

## What Changes

### Wire-format parity (kind 25054)
- Plumb a `reason` parameter through native
  `sendVoiceCallReject(recipientHex, callId, reason)`. Existing call
  sites (lockscreen Decline path) pass `null`/`""`. New native busy
  auto-reject (below) passes `"busy"`.
- Extend `tests/fixtures/nip-ac-wire/inner-events.json` with a
  `"busy"` reject case so JS↔Java byte-equivalence is locked at the
  fixture level.

### Native concurrent-call detection (NEW behavior)
- When a `NativeVoiceCallManager` exists with a non-idle, non-ended
  status AND a kind-25050 offer arrives over the live relay
  subscription with a different `callId`, the native handler SHALL
  auto-reject with `content="busy"` and self-wrap, mirroring the
  JS busy auto-reject. The existing call SHALL be unaffected and the
  new offer SHALL NOT be persisted to SharedPreferences nor produce
  a notification.

### Native global pre-session ICE buffer
- Add a global ICE buffer in `NativeBackgroundMessagingService`
  keyed by sender hex pubkey, holding kind-25052 ICE candidate
  payloads that arrive when no `NativeVoiceCallManager` exists for
  that peer. Per-sender FIFO cap 32 candidates; total cap 256
  senders; entries older than 60 s (matching
  `NIP_AC_STALENESS_SECONDS`) SHALL be evicted on add.
- Drain the per-peer buffer into the manager's per-session buffer
  when `VoiceCallForegroundService` instantiates a
  `NativeVoiceCallManager` for that peer. Mirrors the web path's
  `VoiceCallService.ts:585-593` behavior.

### Native self-event filter exception (kinds 25051, 25054)
- Replace the unconditional self-event drop at
  `NativeBackgroundMessagingService.java:3262-3264` with kind-aware
  logic:
  - Kinds 25050, 25052, 25053, 25055 from self → drop (unchanged).
  - Kinds 25051 / 25054 from self: if the inner `call-id` matches
    either the `nospeak_pending_incoming_call` SharedPreferences
    slot OR an active `NativeVoiceCallManager` in
    `INCOMING_RINGING` for that callId, the system SHALL cancel
    the FSI notification, clear SharedPreferences, and (when a
    manager is present) end the call with reason
    `answered-elsewhere` (for 25051) or `rejected-elsewhere` (for
    25054). Other self 25051/25054 (no matching pending call) →
    drop.

### Pure-Java decision helpers (testability)
- Extract the ICE buffer policy and the self-dismiss decision into
  pure-Java helper classes that can be unit-tested without
  Robolectric or device emulation, following the precedent set by
  `CallHistoryDecision` in the
  `2026-05-01-add-native-voice-calls` change.

## Impact

- **Affected specs:** `voice-calling`
- **Affected code:**
  - `android/app/src/main/java/com/nospeak/app/NativeBackgroundMessagingService.java`
    — `sendVoiceCallReject` signature (now takes `reason`); native
    busy auto-reject branch in `handleNipAcWrapEvent`; new
    `GlobalIceBuffer` field + buffer add path replacing the
    line-3403 fall-through; replaced self-event drop with
    `NativeSelfDismissDecision.decide(...)`-driven branch.
  - `android/app/src/main/java/com/nospeak/app/NativeVoiceCallManager.java`
    — new `getActiveCallId()`, `isBusy()`, `getStatus()` accessors;
    new `endForAnsweredElsewhere(callId)` /
    `endForRejectedElsewhere(callId)` helpers (or equivalent
    end-reason wiring); new method to drain pre-session ICE
    candidates from the global buffer at construction time.
  - `android/app/src/main/java/com/nospeak/app/VoiceCallForegroundService.java`
    — drain per-peer global ICE buffer when instantiating the
    manager.
  - **NEW** pure-Java helpers under
    `android/app/src/main/java/com/nospeak/app/voicecall/`:
    `GlobalIceBuffer.java`, `NativeSelfDismissDecision.java`,
    `NativeBusyRejectDecision.java`.
  - `android/app/src/main/java/com/nospeak/app/IncomingCallActionReceiver.java`
    (or wherever the lockscreen Decline path lives) — pass
    `null` to the new `reason` parameter explicitly.
  - `tests/fixtures/nip-ac-wire/inner-events.json` — add the
    `"busy"` reject case.
  - `src/lib/core/voiceCall/wireParity.test.ts` — exercise the new
    fixture case.
  - `android/app/src/test/java/com/nospeak/app/NativeNipAcSenderTest.java`
    — exercise the `"busy"` parity case and the new `reason`
    parameter on `sendVoiceCallReject`.
  - **NEW Java unit tests:** `GlobalIceBufferTest`,
    `NativeBusyRejectDecisionTest`, `NativeSelfDismissDecisionTest`.
  - `android/app/src/main/java/com/nospeak/app/NativeBackgroundMessagingService.java`
    — remove the stale "signature verification on the inner event
    is NOT performed here" doc-comment block at lines 3208-3214
    (cosmetic, code already verifies).
  - `AGENTS.md` — extend the "Voice Calling" section to mention
    the three new Android-side behaviors.

- **Backwards compatibility:** No wire-format changes affect remote
  peers. Local SharedPreferences slot shapes are unchanged. The new
  `"busy"` content on native rejects is what NIP-AC requires; remote
  peers that ignore the content field continue to work unchanged.

- **Out of scope for this change:**
  - Group calls (NIP-AC §"Group Calls").
  - Bumping `NIP_AC_STALENESS_SECONDS` from 60 s to 20 s
    (deliberately deferred elsewhere).
  - Unifying the JS dedup ring (256) with the native shared one
    (500).
  - Tagging existing tests with NIP-AC's published `E*/R*/I*/G*`
    test-vector ID labels.
