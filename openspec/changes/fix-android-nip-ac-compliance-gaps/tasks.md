# Tasks

## 1. Wire-format parity for `"busy"` reject content

- [x] 1.1 Change Java
      `NativeBackgroundMessagingService.sendVoiceCallReject(recipientHex, callId)`
      to `sendVoiceCallReject(recipientHex, callId, reason)`. When
      `reason` is null or empty, write `content=""` (preserves
      existing behavior). When `reason` is non-empty, write
      `content=reason`. Update the inline comment at
      `:3530-3531` accordingly.
- [x] 1.2 Update existing call sites (lockscreen Decline path in
      `IncomingCallActionReceiver` and any other internal callers)
      to pass `null` explicitly.
- [x] 1.3 Add a `"busy"` reject case to
      `tests/fixtures/nip-ac-wire/inner-events.json`. Use
      `nostr-tools` to compute the `expectedId` from the canonical
      NIP-01 serialization. Document the inputs in the fixture's
      `_doc` block.
- [x] 1.4 Extend `src/lib/core/voiceCall/wireParity.test.ts` to
      cover the new `"busy"` fixture case.
- [x] 1.5 Extend
      `android/app/src/test/java/com/nospeak/app/NativeNipAcSenderTest.java`
      to assert byte-equivalent inner-event id for the new
      `"busy"` case via the same fixture.

## 2. Native concurrent-call detection (busy auto-reject)

- [x] 2.1 Add `NativeVoiceCallManager.getActiveCallId()` and
      `isBusy()` (returns true for any status that is neither
      `IDLE` nor `ENDED`).
- [x] 2.2 Extract the busy-decision logic into a pure-Java
      `NativeBusyRejectDecision` helper exposing
      `decide(managerCallId, managerIsBusy, incomingCallId): Action`
      where `Action` is one of
      `{ AUTO_REJECT_BUSY, IGNORE_DUPLICATE, NORMAL_FLOW }`.
      `IGNORE_DUPLICATE` covers the existing case from
      `voice-calling/spec.md:328-332` ("Duplicate offer for active
      call is ignored"). `NORMAL_FLOW` is the no-active-call case.
- [x] 2.3 Wire the helper into
      `NativeBackgroundMessagingService.handleNipAcWrapEvent` for
      kind 25050 inner events: after follow-gate and before
      persisting to SharedPreferences / posting FSI, consult the
      decision helper. On `AUTO_REJECT_BUSY` invoke
      `sendVoiceCallReject(senderHex, incomingCallId, "busy")` and
      return without persisting. On `IGNORE_DUPLICATE` return
      silently without sending a reject.
- [x] 2.4 Add `NativeBusyRejectDecisionTest` covering: idle
      manager, busy manager same callId (duplicate), busy manager
      different callId, no manager present.

## 3. Native global pre-session ICE buffer

- [x] 3.1 Create new pure-Java helper
      `android/app/src/main/java/com/nospeak/app/voicecall/GlobalIceBuffer.java`
      with:
      - `static final class IceCandidatePayload { String candidate; String sdpMid; Integer sdpMLineIndex; long receivedAtMs; }`
      - `add(senderHex, payload, nowMs)` — append to per-sender
        FIFO; on overflow per-sender (`> 32`) drop oldest;
        on overflow total senders (`> 256`) drop oldest sender
        entry; on add, evict any payloads older than 60 s.
      - `drain(senderHex, nowMs): List<IceCandidatePayload>` —
        return and remove the per-sender list, evicting stale
        entries during drain.
      - `clearAll()` — drop all buffers.
      - All methods thread-safe (`synchronized` is fine; the
        callsites are infrequent and bounded).
- [x] 3.2 Add `private final GlobalIceBuffer globalIceBuffer = new GlobalIceBuffer();`
      to `NativeBackgroundMessagingService`.
- [x] 3.3 In `handleNipAcWrapEvent` for kind 25052 (ICE) when
      `nativeMgr == null` (no live manager): parse the candidate
      JSON exactly as the existing manager-dispatch branch does
      (`:3340-3352`) and call
      `globalIceBuffer.add(senderHex, payload, System.currentTimeMillis())`,
      then return. Replace the silent fall-through at
      `:3403-3408` for kind 25052 specifically.
- [x] 3.4 In `VoiceCallForegroundService` (or
      `NativeVoiceCallManager.bootstrapForCall(...)`, whichever
      owns manager construction), expose a hook to retrieve the
      `GlobalIceBuffer` from the messaging service and drain the
      per-peer entries into `sessionPendingIce` BEFORE
      `setRemoteDescription`. Mirrors `VoiceCallService.ts:585-593`.
- [x] 3.5 Add `clearAll()` invocation when the messaging service
      shuts down (existing service-stop path).
- [x] 3.6 Add `GlobalIceBufferTest` covering NIP-AC `B*` vectors
      that apply to the no-PC-yet phase: B1 (single candidate
      buffered), B2 (multiple buffered), B3 (drain on session
      creation), B8 (preserved across ringing→accept), B9 (per-
      sender isolation), B10 (drain doesn't affect other peers),
      plus eviction policy tests (per-sender cap, total cap, 60 s
      TTL).

## 4. Native self-event filter exception for kinds 25051 / 25054

- [x] 4.1 Create pure-Java helper
      `android/app/src/main/java/com/nospeak/app/voicecall/NativeSelfDismissDecision.java`
      with:
      - `enum Action { DROP, DISMISS_FSI, END_MANAGER_ANSWERED, END_MANAGER_REJECTED }`
      - `static Action decide(int innerKind, String innerCallId, String pendingPrefsCallId, String managerCallId, String managerStatusName)`
      - Logic:
        - 25052 / 25053 / 25055 / 25050 → `DROP` (always).
        - 25051: if `managerCallId` matches and status is
          `INCOMING_RINGING` → `END_MANAGER_ANSWERED`. Else if
          `pendingPrefsCallId` matches → `DISMISS_FSI`. Else →
          `DROP`.
        - 25054: same shape with `END_MANAGER_REJECTED`.
- [x] 4.2 Replace the unconditional self-event drop at
      `NativeBackgroundMessagingService.java:3262-3264` with logic
      that:
      - Reads `pendingPrefsCallId` from
        `nospeak_pending_incoming_call` SharedPreferences.
      - Reads `managerCallId` and `managerStatusName` from
        `VoiceCallForegroundService.getNativeManager()` (or null).
      - Calls `NativeSelfDismissDecision.decide(...)` and dispatches:
        - `DROP` → return.
        - `DISMISS_FSI` → invoke existing
          `handleRemoteCallCancellation(callId)` and return.
        - `END_MANAGER_ANSWERED` → invoke
          `nativeMgr.endForAnsweredElsewhere(callId)` AND
          `handleRemoteCallCancellation(callId)`, then return.
        - `END_MANAGER_REJECTED` → invoke
          `nativeMgr.endForRejectedElsewhere(callId)` AND
          `handleRemoteCallCancellation(callId)`, then return.
- [x] 4.3 Add `NativeVoiceCallManager.endForAnsweredElsewhere(callId)`
      and `endForRejectedElsewhere(callId)` if not already present;
      they SHALL behave like `handleRemoteHangup` but with the
      indicated end reason and SHALL NOT publish any wire event.
- [x] 4.4 Add `NativeSelfDismissDecisionTest` covering all six
      cases of the decision matrix plus the four "always drop"
      kinds.

## 5. Spec & docs

- [x] 5.1 Update `openspec/specs/voice-calling/spec.md` (via the
      change deltas in
      `openspec/changes/fix-android-nip-ac-compliance-gaps/specs/voice-calling/spec.md`):
      - MODIFY "Native NIP-AC Outbound Senders on Android" — add
        the `reason` parameter requirement and the `"busy"` content
        propagation scenario.
      - MODIFY "Native NIP-AC Inbound Dispatch on Android" — add
        the global pre-session ICE buffer requirement and a
        scenario.
      - ADD "Native Concurrent-Offer Busy Auto-Reject on Android".
      - ADD "Native Self-Event Multi-Device Dismissal on Android".
- [x] 5.2 Remove the stale doc-comment at
      `NativeBackgroundMessagingService.java:3208-3214` claiming
      signature verification isn't done. The code at `:3266-3285`
      already verifies via `SchnorrCrypto.verify`.
- [x] 5.3 Extend the "Voice Calling" section of
      `/home/psic4t/code/nospeak/AGENTS.md` to mention:
      (a) native `sendVoiceCallReject` accepts a `reason`,
      (b) native maintains a global ICE buffer for cold-start ICE
          trickle,
      (c) native dismisses the FSI on self-Answer/self-Reject for
          matching call-id.

## 6. Validation

- [x] 6.1 `openspec validate fix-android-nip-ac-compliance-gaps --strict`
- [x] 6.2 `npm run check`
- [x] 6.3 `npx vitest run` (covers `wireParity.test.ts` and any
      JS-side regressions)
- [x] 6.4 Run new Java unit tests: `GlobalIceBufferTest`,
      `NativeBusyRejectDecisionTest`,
      `NativeSelfDismissDecisionTest`, and the extended
      `NativeNipAcSenderTest`.
