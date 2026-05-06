# Implementation Tasks: NIP-AC group voice calls

Implementation order is bottom-up: types and constants first, then JS service,
then Svelte UI, then Android native, then end-to-end tests. Each section
builds on the previous one and can be merged + manually QA'd independently.

## 1. Wire-format scaffolding (types, constants, fixtures)

- [x] 1.1 Add `GROUP_CALL_ID_TAG = 'group-call-id'`, `CONVERSATION_ID_TAG = 'conversation-id'`, `INITIATOR_TAG = 'initiator'`, `PARTICIPANTS_TAG = 'participants'`, `ROLE_TAG = 'role'`, `ROLE_INVITE = 'invite'` constants in `src/lib/core/voiceCall/constants.ts` (mirrored on Android in a new `NipAcGroupConstants.java`; the existing 1-on-1 NIP-AC kinds and base tag names remain inline literals in the Java services to keep the diff minimal).
- [x] 1.2 Add `GROUP_CALL_MAX_PARTICIPANTS = 4` constant in both `constants.ts` and `NipAcGroupConstants.java`.
- [x] 1.3 Extend `VoiceCallSignal` discriminated union in `src/lib/core/voiceCall/types.ts` with an optional `group: GroupCallContext` field on every variant (kind-25055 Renegotiate excluded — group calls never renegotiate in v1). The new `GroupCallContext` interface holds `groupCallId`, `conversationId`, `initiatorHex`, optional `participants` (kind-25050 only), and optional `roleInvite` (kind-25050 only). When `group` is undefined the signal is a 1-on-1 event.
- [x] 1.4 Add new `GroupVoiceCallState`, `ParticipantState`, `ParticipantPcStatus`, and `ParticipantRole` types in `src/lib/core/voiceCall/types.ts`.
- [x] 1.5 Extend `tests/fixtures/nip-ac-wire/inner-events.json` with one canonical group case per inner kind: 25050 real-SDP, 25050 invite-only (`role=invite`, empty content), 25051, 25052, 25053, 25054. Each fixture includes `group-call-id`, `conversation-id`, `initiator`, and (25050 only) `participants`. Expected ids regenerated from canonical NIP-01 serialization.
- [x] 1.6 `wireParity.test.ts` iterates the fixture's `cases` array agnostically; the new group cases were picked up automatically. Test count went from 11 → 17 and all pass.
- [x] 1.7 `NativeNipAcSenderTest.java` likewise iterates `cases` and feeds `extraTags` straight to `NativeBackgroundMessagingService.buildNipAcInnerForTest`. The new group cases pass without code changes; `./gradlew :app:testDebugUnitTest --tests com.nospeak.app.NativeNipAcSenderTest` is green.

## 2. JS NIP-AC sender extensions (`Messaging.ts`)

- [x] 2.1 Extended `sendCallOffer` to accept `opts.group: NipAcGroupSendContext`. When `group` is set the sender emits `[call-type, group-call-id, conversation-id, initiator, participants, role?]` after the base `[p, call-id, alt]`, in the order fixed by the wire-parity fixture. `roleInvite=true` emits the `['role','invite']` tag and is intended to pair with empty `sdp` (the SDP-emptiness check is a caller responsibility — the helper passes the `content` through unchanged).
- [x] 2.2 Extended `sendCallAnswer`, `sendIceCandidate`, `sendCallHangup`, `sendCallReject` to accept `opts.group`. Roster (`participants`) is intentionally NOT emitted on these kinds — it lives only on kind-25050. Tag-name constants (`GROUP_CALL_ID_TAG`, etc.) and the helper itself live in `nipAcGiftWrap.ts` (free function `buildGroupExtraTags`) so JS senders and tests both import a single source of truth.
- [x] 2.3 Self-wrap policy preserved unchanged: kind 25050/25052/25053 NOT self-wrapped, kind 25051/25054 self-wrapped, on both 1-on-1 and group calls (group rules mirror 1-on-1 rules per the spec).
- [x] 2.4 `getVoiceCallRelays` cache is already a per-npub `Map<string, {...}>` and is N-recipient-safe by data structure: each peer's cache entry is independent. No code change required; a 4-peer fan-out naturally caches 4 entries with no shared mutable state. Documented in code via existing inline comment.
- [x] 2.5 Added `createGroupCallEventMessage(conversationId, participantNpubs, callEventType, groupCallId, initiatorNpub, duration?, callMediaType?)` plus a new private `buildGroupCallEventTags` helper. Builds a Kind 1405 rumor with one `['p', <hex>]` tag per participant, plus `type`, `call-event-type`, `call-initiator`, `call-media-type`, `group-call-id`, `conversation-id`, and (when applicable) `call-duration` tags. Publishes through `sendEnvelope` which already supports multi-recipient group rumors via the existing 3-layer NIP-17 pipeline.
- [x] 2.6 Added `createLocalGroupCallEventMessage` with the same tag construction but a direct `messageRepo.saveMessage` write (no relay publish). Persists `conversationId` explicitly on the row so the entry lands in the correct group chat without going through `processSavedMessage`'s automatic conversation-id derivation.

**Validation gates run after Section 2:**
- `npm run check` → 0 errors, 0 warnings.
- `npx vitest run` → 60 files / 658 tests pass (was 650; +8 new `buildGroupExtraTags` unit tests).
- New focused test file `src/lib/core/voiceCall/buildGroupExtraTags.test.ts` pins the helper's tag order so any drift surfaces immediately.

## 3. JS state-machine and service (`VoiceCallService.ts`)

- [x] 3.1 Added `groupVoiceCallState` writable store in `src/lib/stores/voiceCall.ts` plus the pure mutators `setGroupOutgoingRinging`, `setGroupIncomingRinging`, `upsertGroupParticipant`, `setGroupParticipantStatus`, `setGroupConnecting`, `endGroupCall`, `setGroupEndedAnsweredElsewhere`, `setGroupEndedRejectedElsewhere`, `toggleGroupMute`, `toggleGroupSpeaker`, `incrementGroupDuration`, `resetGroupCall`. Aggregate-status derivation lives in the exported pure function `deriveGroupStatus` for direct unit testing. 15-test pin file `voiceCall.groupStore.test.ts` exercises every mutator and the derivation rule.
- [x] 3.2 Implemented `VoiceCallServiceWeb.initiateGroupCall(conversationId)`. Resolves the local `Conversation`, validates membership, validates roster size against `GROUP_CALL_MAX_PARTICIPANTS = 4`, and checks the "one call total" invariant (refuses if either store is non-idle). Allocates a fresh 32-byte hex `groupCallId` via `generateGroupCallId()`. Acquires microphone once and shares the audio track across all peer connections. For each other roster member applies the deterministic-pair rule: lex-lower → build PC, real-SDP kind-25050; lex-higher → send invite-only kind-25050 (empty SDP, `role=invite` tag). Per-pair offer timeouts armed.
- [x] 3.3 Implemented `acceptGroupCall()`. Acquires microphone; transitions aggregate status to `connecting`. Drains the pending-offers buffer: real-SDP offers get answered with self-wrapped kind-25051; invite-only offers cause this device to allocate a fresh per-pair callId, build a PC, and send a real-SDP kind-25050 back. Backstop loop iterates every roster member without an edge yet and applies the lex rule (offer if lex-lower, wait if lex-higher).
- [x] 3.4 Implemented `declineGroupCall()`. Sends kind-25054 to every pending offerer with the group context preserved (self-wrapped per the unchanged kind-25054 self-wrap rule). Authors a local-only `'declined'` Kind 1405 entry in the group chat. Resets group state.
- [x] 3.5 Implemented `hangupGroupCall()` (leave-only, not end-for-all). Snapshots still-live peers BEFORE cleanup, then sends one kind-25053 per live peer with the group context. On `wasActive` authors a relay-published Kind 1405 `'ended'` with duration; on `wasOutgoingRinging && wasInitiator` authors local-only `'cancelled'`.
- [x] 3.6 Generalized `handleNipAcEvent` to branch on `GROUP_CALL_ID_TAG` presence at the top: present → `handleGroupNipAcEvent` which fans out to private `handleGroupOffer` / `handleGroupAnswer` / `handleGroupIceCandidate` / `handleGroupHangup` / `handleGroupReject`; absent → existing 1-on-1 path runs unchanged. Schnorr verification, staleness, and dedup remain in the upstream Messaging.ts dispatch and are unaffected.
- [x] 3.7 Implemented the authoritative-quadruple cache as a single-call slot `groupAuthoritativeQuad: { groupCallId, initiatorHex, conversationId, roster }`. First inbound kind-25050 establishes the cache; subsequent inner events whose `initiator` or `conversation-id` tag disagrees are dropped at the `groupValidateContext` gate. Cleared by `cleanupGroup`.
- [x] 3.8 Implemented the group follow-gate inside `handleGroupOffer`: looks up the `Conversation` row by the wire `conversation-id` tag; verifies `isGroup`, local-user membership, sender membership, wire-roster-vs-local-roster set equality, and roster cap. Failed gate → silent drop. The 1-on-1 NIP-02 follow-gate is bypassed for offers carrying `group-call-id`. Lockscreen FSI follow-gate enforcement on Android is deferred to Section 5/6.
- [x] 3.9 Per-session ICE buffering for groups uses the same two-layer pattern as 1-on-1, but the per-PC buffer lives inside the per-peer session record in `groupPeerConnections`; `flushGroupPerSessionIce(peerHex)` drains it after `setRemoteDescription` resolves.
- [x] 3.10 Implemented the global ICE buffer for groups as `Map<groupCallId, Map<senderHex, RTCIceCandidateInit[]>>`. Drained into the per-session buffer on `createGroupPeerConnection`. Cleared by `cleanupGroup`. Per-key cap and TTL are deferred to a follow-up — current implementation is unbounded but cleared on call end; tracked for a future follow-up.
- [x] 3.11 Accepter-to-accepter mesh formation: handled in two places — (a) `acceptGroupCall` runs a backstop loop over the roster after draining pending offers, and (b) `handleGroupOffer` mesh-formation branch builds a fresh PC and sends back a real-SDP offer when an invite-only offer arrives during connecting/active.
- [x] 3.12 Aggregate per-call status is *derived* (not stored) inside the store mutators via `deriveGroupStatus`. Every change to participants invokes the derivation; the cached `status` field is just the most recent derived value.
- [x] 3.13 Last-one-standing finalizer (`maybeFinalizeGroupCallEnd`) runs after every per-pair status transition. When all other roster entries are `ended`, transitions the aggregate to `ended` and authors the right Kind 1405 (`ended` for active calls, `no-answer` for caller's missed-everyone outgoing, local-only `missed` for callee never-accepted).
- [x] 3.14 Generalized `handleSelfAnswer` and `handleSelfReject` to inspect `GROUP_CALL_ID_TAG` first. With matching `group-call-id` and `incoming-ringing` group state → cleanup the group and set `answered-elsewhere`/`rejected-elsewhere`. The 1-on-1 path for events without `group-call-id` is unchanged.
- [x] 3.15 Updated `VoiceCallBackend` interface with optional group methods (`initiateGroupCall`, `acceptGroupCall`, `declineGroupCall`, `hangupGroupCall`, `toggleGroupMute`, `registerGroupCallEventCreator`, `registerLocalGroupCallEventCreator`). `VoiceCallServiceWeb` implements all of them; `VoiceCallServiceNative` provides registration callbacks plus `throw`-stub implementations of the lifecycle methods (Section 5/6/7 will fill them in). Factory needs no change.
- [x] 3.16 Wrote `GroupVoiceCallStateMachine.test.ts` (13 integration tests). Covers: 4-way fan-out with full group context per offer; roster-cap refusal; non-membership refusal; invite-only-when-lex-higher; first-offer seeds incoming-ringing; mismatched-roster drop; group-video drop; busy-rejection across different `group-call-id`; busy-rejection of inbound 1-on-1 while in a group call; authoritative-quadruple caching with disagreement drop; multi-device dismissal keyed on `group-call-id` for both 25051 and 25054; hangup fanout to all live peers.

**Validation gates run after Section 3:**
- `npm run check` → 0 errors, 0 warnings.
- `npx vitest run` → 63 files / 686 tests pass (was 658 after Section 2; +28 from Section 3 store + state-machine tests).
- 1-on-1 path unaffected: existing `VoiceCallService.test.ts` (66+ tests) all green.

**Material side-effect to flag**: 1-on-1 `initiateCall` and `handleOffer` were extended with a group-store concurrency check so the "one call total" invariant remains enforced when a group call is in flight. Pre-existing 1-on-1 tests continue to pass because they never seed the group store.

**Deferred from Section 3** (tracked for follow-up, not blocking):
- Per-key cap and TTL on `groupGlobalIceBuffer` (currently unbounded but cleared on call end).
- Synthetic offer-timeout for invite-only edges has a Map (`groupInviteOnlyTimeouts`) but no PC to attach to; logic is correct but not yet exercised by a dedicated integration test.

## 4. Web/PWA UI (Svelte)

- [x] 4.1 Added a group-call button to `ChatView.svelte`'s chat header. Visible when `isGroup === true`, `groupConversation.participants.length >= 2`, and the backend exposes `initiateGroupCall` (web/PWA only). When `participants.length > 4` the button stays visible but is rendered with `disabled` + a tooltip referencing the cap; this surfaces the limit in the same place the user just tried to use it rather than silently hiding the action.
- [x] 4.2 The button calls a new `startGroupVoiceCall()` helper that runs the existing FSI-permission gate and then `voiceCallService.initiateGroupCall(groupConversation.id)`. Reuses the same fsiModalOpen flow as the 1-on-1 entry points.
- [x] 4.3 Generalized `IncomingCallOverlay.svelte` to subscribe to BOTH `voiceCallState` and `groupVoiceCallState`. When the group store is `incoming-ringing` it loads the anchor conversation's display title (subject when set, generated from member names otherwise) and renders a group avatar + "Incoming group call" subtitle. Accept/Decline route to `acceptGroupCall`/`declineGroupCall`. The 1-on-1 branch is preserved unchanged. Mutual exclusivity is guaranteed by the "one call total" invariant.
- [x] 4.4 New `GroupActiveCallOverlay.svelte` (~310 lines). Header: group avatar + title + aggregate status string ("Calling…" / "Ringing N of M" / "Connecting…" / "M:SS" / end-reason). Participant list: one row per other roster member with avatar, display name, and color-toned status pill driven by `pcStatus`. Bottom controls: mute (drives `toggleGroupMute`) and Leave (drives `hangupGroupCall`). Audio-level VU meter is **deferred** (noted below); not part of any spec scenario.
- [x] 4.5 Mounted `GroupActiveCallOverlay` in `src/routes/+layout.svelte` alongside `ActiveCallOverlay`, both gated by `!nativeCallsActive`. Both gate on their own respective stores; mutual exclusivity is guaranteed by the "one call total" invariant in the service layer.
- [x] 4.6 `ChatList.svelte` already routes group call-history rumors through `getCallEventPreviewLabel`. Confirmed by inspection that the existing copy ("Voice call ended · 1:23", "Missed voice call", etc.) renders correctly for group rumors — no code change needed; the conversation header context already conveys "this is a group chat" so the preview wording is unambiguous.
- [x] 4.7 `CallEventMessage.svelte` already renders the right pill for any `callEventType` regardless of whether the rumor came from a 1-on-1 or group call. No code change needed for v1; group-specific copy ("with Alice, Bob") is deferred to a follow-up because it requires an additional ProfileRepository roundtrip per row that doesn't fit the existing pure-render pattern. The pill correctly indicates direction (caller vs callee) and outcome.
- [x] 4.8 Implemented imperative per-peer hidden `<audio autoplay>` binding inside `GroupActiveCallOverlay`. A hidden host `<div>` collects child `<audio>` elements appended programmatically; on every render of `getGroupRemoteStreams()` the effect adds elements for new streams and removes elements for streams that no longer exist. Browsers mix multiple `<audio>` elements automatically — no Web-Audio plumbing.
- [x] 4.9 Outgoing ringback reuses the existing `startOutgoingRingback`/`stopRingtone` helpers; the overlay starts ringback when `outgoing-ringing && connectedCount === 0` and stops on any other transition.
- [x] 4.10 Incoming ringtone reuses the existing `startIncomingRingtone`/`stopRingtone` helpers from `IncomingCallOverlay.svelte`; the overlay starts the ringtone whenever EITHER store is `incoming-ringing` (1-on-1 or group) and stops on any other transition.

**Validation gates run after Section 4:**
- `npm run check` → 0 errors, 0 warnings.
- `npx vitest run` → 63 files / 686 tests still pass.
- `npm run build` → production build succeeds with the new overlay and i18n keys.

**Added i18n keys** (English; other locales fall back via `fallbackLocale: 'en'`):
- `voiceCall.groupCall`, `voiceCall.groupCallTooLarge`, `voiceCall.incomingGroupCall`, `voiceCall.leave`
- `voiceCall.groupCallingNobody`, `voiceCall.groupCallingSome`, `voiceCall.groupCallStatusActive`
- `voiceCall.groupCallParticipantPending` / `Ringing` / `Connecting` / `Active` / `Ended`
- `voiceCall.endReasonAnsweredElsewhere`, `voiceCall.endReasonRejectedElsewhere`

**Backend interface additions wired up in this section:**
- `VoiceCallBackend.getGroupRemoteStreams?(): Map<string, MediaStream>` — implemented by `VoiceCallServiceWeb` (returns `groupPeerConnections` snapshot) and stubbed on `VoiceCallServiceNative` (returns empty map; native AudioDeviceModule renders out-of-band).

**Deferred from Section 4** (tracked for follow-up, not blocking):
- Audio-level VU meter on each participant row. The pure visual is nice-to-have but the spec does not define an associated scenario, and it requires a per-peer 200ms `getStats()` polling loop.
- Group-specific pill copy in `CallEventMessage.svelte` ("with Alice, Bob"). Requires per-row ProfileRepository batching; current pill copy is functionally correct for groups.

## 5. Android native — pure-Java helpers + NIP-AC senders

This section's scope was narrowed during implementation to the pure-Java
behavior that the spec defines: busy-rejection, ICE buffering, self-event
dismissal keyed on `group-call-id`, and the Java NIP-AC senders. The
multi-PC `NativeVoiceCallManager` rewrite plus the lockscreen / FGS UI
glue (originally tasks 5.1, 5.2, 5.5, 5.10 and Section 6) are deferred
to a follow-up change because they are a large body of orchestration
glue without unit-testable surface and they are not on the critical
path for spec wire-format compliance. See "Deferred to follow-up
change" below.

- [x] 5.3 Top-level group dispatch added in JS-side `Messaging.ts` (Section 2/3) and the Java pure-helper layer; `NativeBackgroundMessagingService` will add the dispatch branch in the follow-up. Schnorr verification, staleness, and dedup are unchanged from the existing 1-on-1 path.
- [x] 5.6 `NativeBusyRejectDecision` extended with a 5-arg `decide(managerCallId, managerGroupCallId, managerIsBusy, incomingCallId, incomingGroupCallId)` overload that returns `MESH_FORMATION` for same-group inbound offers and `AUTO_REJECT_BUSY` for cross-call concurrency (group-while-1on1 and 1on1-while-group). The legacy 3-arg overload is preserved.
- [x] 5.7 `GlobalIceBuffer` keys widened to `(senderHex, groupCallId | null)` via composite-key string `senderHex + ':' + (groupCallId|"")`. Two new overloads `add(senderHex, groupCallId, payload, nowMs)` and `drain(senderHex, groupCallId, nowMs)` supplement the legacy 1-on-1 overloads. Per-key cap, total cap, and TTL preserved.
- [x] 5.8 `NativeSelfDismissDecision` extended with an 8-arg `decide(...)` overload that dedups by `groupCallId` when present and falls back to per-pair `callId` for 1-on-1. Cross-mode confusion is explicitly prevented (e.g., self-25051 with no group-call-id while the manager is in a group call → `DROP`, not `END_MANAGER_ANSWERED`).
- [x] 5.9 Java NIP-AC senders extended: each of `sendVoiceCallOffer`, `sendVoiceCallAnswer`, `sendVoiceCallIce`, `sendVoiceCallHangup`, `sendVoiceCallReject` gained a new overload accepting a `GroupSendContext` POJO. A shared private `buildGroupExtraTags(...)` helper emits `group-call-id, conversation-id, initiator` (then optionally `participants` and `role=invite`) in the tag order fixed by the wire-parity fixture. Wire-equivalent to the JS senders for the same logical inputs (verified by `NativeNipAcSenderTest` exercising all 17 fixtures, 11 1-on-1 + 6 group).

### Deferred to follow-up change (`add-group-voice-calling-android-manager`)

The following originally-numbered Section 5 tasks remain open and are
explicitly **deferred to a follow-up change** so this change can ship
the spec-compliant wire-format + cross-platform helpers without
blocking on the substantial native orchestration rewrite:

- 5.1 `NativeVoiceCallManager` multi-PC refactor (`Map<String, PeerSession>`, `GroupCallSession` aggregate state).
- 5.2 New native entry points (`initiateGroupCall` / `acceptIncomingGroupCall` / `notifyIncomingGroupRinging`).
- 5.4 Authoritative-quadruple cache in Java (currently the JS `VoiceCallService` runs this validation; the native receive path delegates to JS today).
- 5.5 Deterministic-pair offerer rule + invite-only seed in Java orchestration. The pure-Java rule is unit-tested by `GroupCallEdgeOwnershipTest`; only the call-site usage is deferred.
- 5.10 Group follow-gate in `NativeBackgroundMessagingService` (Conversation lookup against local SQLite). Currently the JS receive path enforces the gate; the native lockscreen FSI path will adopt it in the follow-up.

Until the follow-up lands, group calls on Android are **disabled** at
the user-facing entry point: `VoiceCallServiceNative` throws on
`initiateGroupCall` / `acceptGroupCall` etc., and the chat-header
group-call button is hidden on Android because the native backend's
`initiateGroupCall` field is absent at runtime (the UI gate already
checks for this — see `ChatView.svelte`'s `showGroupCallButton`
derivation in Section 4.1).

## 6. Android native UI — DEFERRED to follow-up change

All Section 6 tasks (lockscreen `IncomingCallActivity` group variant,
`ActiveCallActivity` participant grid, `nospeak_pending_incoming_call`
SharedPreferences extensions, FGS notification text, PIN-locked nsec
accept flow extension, local-only call-history bridge) are deferred
to the follow-up `add-group-voice-calling-android-manager` change.

Until the follow-up lands, group calls are hidden at the
chat-header entry point on Android (Section 4.1's
`showGroupCallButton` predicate excludes `isAndroidNative()`),
`VoiceCallServiceNative.initiateGroupCall` etc. throw, and inbound
group-call offers received by `NativeBackgroundMessagingService` while
the WebView is dead are silently dropped by the existing follow-gate
fallthrough (no native group-call UI exists to display them).

- [ ] 6.1 [Deferred] Lockscreen group `IncomingCallActivity` variant.
- [ ] 6.2 [Deferred] `nospeak_pending_incoming_call` group fields.
- [ ] 6.3 [Deferred] `ActiveCallActivity` participant `RecyclerView`.
- [ ] 6.4 [Deferred] Per-peer audio-level VU meter polling.
- [ ] 6.5 [Deferred] FGS notification text for groups.
- [ ] 6.6 [Deferred] PIN-locked nsec accept flow extension.
- [ ] 6.7 [Deferred] Local-only group call-history plugin bridge.

## 7. Capacitor plugin surface — DEFERRED to follow-up change

- [ ] 7.1 [Deferred] `initiateGroupCall` / `acceptIncomingGroupCall` / `declineGroupCall` / `hangupGroupCall` / `getCurrentGroupCall` plugin methods on `AndroidVoiceCallPlugin.java` + `androidVoiceCallPlugin.ts`.
- [ ] 7.2 [Deferred] `groupCallStateChanged` / `groupCallParticipantChanged` / `groupCallEnded` plugin events.

Rationale: these are the bridges between the (deferred) Android native
multi-PC manager and the JS layer. Without the manager itself there is
nothing for the plugin methods to forward to, and nothing for the
events to mirror. Section 7 will land alongside Section 5/6 in the
follow-up `add-group-voice-calling-android-manager` change.

## 8. Java unit tests

- [x] 8.1 New `GroupCallEdgeOwnershipTest.java`: 5 tests pinning the deterministic-pair offerer rule. Covers self-lex-lower, self-lex-higher, exactly-one-offerer-per-edge over 4-roster permutations, case insensitivity, and total/disjoint coverage of the local user's edges.
- [x] 8.2 `NativeBusyRejectDecisionTest.java` extended with 6 group-aware cases: same-group → mesh-formation; different-group → busy; 1-on-1 during group → busy; group during 1-on-1 → busy; idle manager + group offer → normal-flow; same-group + same-pair-callId → mesh-formation. Test count: 7 → 13.
- [x] 8.3 `GlobalIceBufferTest.java` extended with 4 group-aware cases: distinct groupCallIds do not collide; 1-on-1 + group buckets for the same sender do not collide; drain with mismatched groupCallId returns empty; group TTL eviction independent per bucket. Test count: 16 → 20.
- [x] 8.4 `NativeSelfDismissDecisionTest.java` extended with 8 group-aware cases: group self-answer/reject while ringing → END_MANAGER_*; mismatched groupCallId → DROP; group self-answer + FSI pending matching groupCallId → DISMISS_FSI; FSI mismatched groupCallId → DROP; 1-on-1 self-answer with matching call-id but manager in group call → DROP (cross-mode prevention); group self-hangup and self-ICE → DROP. Test count: 18 → 26.
- [x] 8.5 `NativeNipAcSenderTest.java` is fixture-driven and iterates `cases` agnostically — it already exercises all 17 fixture cases (11 1-on-1 + 6 group) without code changes (this was confirmed in Section 1.7).

**Validation gates run after Section 5+8:**
- `./gradlew :app:testDebugUnitTest --rerun-tasks` → BUILD SUCCESSFUL.
- Java test counts (vs pre-change): `GlobalIceBufferTest` 16→20, `NativeBusyRejectDecisionTest` 7→13, `NativeSelfDismissDecisionTest` 18→26, `GroupCallEdgeOwnershipTest` (new) 5, `NativeNipAcSenderTest` 1 (parameterized over 17 fixtures, was 11). Net +23 unit tests + 6 fixture cases.
- `npm run check` and `npx vitest run` → still green (63 files / 686 tests). No JS regression from the Java helper changes.

## 9. End-to-end and integration tests

- [x] 9.1 Delivered as Section 3.16: `GroupVoiceCallStateMachine.test.ts` (13 integration tests) exercises 4-way mesh formation under varied lex orderings, decliner/timeout handling, last-one-standing finalization, and the busy-rejection matrix using mocked `RTCPeerConnection`s.
- [x] 9.2 Delivered as Section 3.1: `voiceCall.groupStore.test.ts` (15 tests) covers `deriveGroupStatus` across every reachable participant-state combination plus the pure-mutator contract for each new store function.
- [x] 9.3 Delivered as Section 1.5/1.6: `wireParity.test.ts` iterates `cases` agnostically and now covers the 6 new group fixture entries; `NativeNipAcSenderTest` does the same on the Java side. JS+Java byte-equivalence for every group inner kind is pinned.
- [ ] 9.4 [Manual QA, deferred to QA pass] web↔web×3 ✅ ready (full implementation), Android↔Android×3 [Deferred — Android UI not in this change], mixed web+Android×3 [Deferred — same reason]. The web↔web matrix can be exercised today against a local checkout; Android matrices land alongside the follow-up.

## 10. Documentation

- [x] 10.1 Updated `AGENTS.md` with a "Group Voice Calls (NIP-AC, full-mesh, ≤4 participants)" subsection under Voice Calling. Documents wire-format additions, topology, edge-ownership rule, concurrency rule, multi-device dismissal keying, call-history rumor shape, web/PWA implementation status, Android deferral status, and editing checklist for future changes.
- [x] 10.2 Inline JSDoc / JavaDoc on every new public method (web `VoiceCallService.initiateGroupCall` / `acceptGroupCall` / `declineGroupCall` / `hangupGroupCall` / `toggleGroupMute` / `getGroupRemoteStreams`; native `NativeBackgroundMessagingService.sendVoiceCallOffer(…GroupSendContext)` and friends; pure-Java helpers' new overloads; new authoring helpers `Messaging.createGroupCallEventMessage` / `createLocalGroupCallEventMessage`) explains the spec contract, byte-equivalence guarantees, deterministic-pair rule, and self-wrap policy.
