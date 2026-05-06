# Change: Add NIP-AC group voice calls (full-mesh, up to 4 participants)

## Why

Voice calling over NIP-AC is stable for 1-on-1 on both web/PWA and Android.
Users now expect to be able to call the participants of a group conversation
together. The wire transport (kind 21059 ephemeral gift wraps over inner kinds
25050-25054), the WebRTC stack, and the per-pair state machine are all already
in place; the missing piece is correlating multiple peer connections into one
logical "call" and fanning out signaling to N-1 peers.

Building this on top of the existing NIP-AC pipeline preserves nospeak's
serverless property — no SFU, no media server, no new external dependency.

## What Changes

- Introduce a **group voice call** concept anchored to an existing group
  conversation (the 16-char hex `conversationId` from `ConversationRepository`).
- **Topology**: full-mesh peer-to-peer. Each device holds up to 3 simultaneous
  `RTCPeerConnection`s. **Hard cap of 4 participants** (including the
  initiator).
- **Wire format**: no new inner kinds. Group semantics are conveyed by new
  tags on the existing inner kinds 25050-25054:
  - `['group-call-id', <hex32>]` — call-level identifier (distinct from the
    per-pair `call-id`).
  - `['conversation-id', <hex16>]` — local group-conversation anchor.
  - `['initiator', <hex>]` — explicit initiator pubkey, authoritative across
    the call.
  - `['participants', <hex>, <hex>, ...]` — full roster, on kind 25050 only.
  - `['role', 'invite']` — on kind 25050 with empty SDP, used by the
    initiator to seed edges where they are the lex-answerer.
- **Mesh formation**: deterministic-pair offerer rule. For each unordered pair
  `{A, B}`, the participant with the lexicographically lower lowercase-hex
  pubkey is the offerer for that edge. Same rule already used for kind-25055
  renegotiation glare resolution.
- **Closed roster**: late join is not supported in v1. Once the initiator
  publishes the first round of offers, the participant set is fixed.
- **Voice only in v1**: kind 25050 with `['call-type', 'video']` and a
  `group-call-id` is rejected. Group video is a follow-up change.
- **Group follow-gate**: for inbound kind-25050 with `group-call-id`, the
  existing 1-on-1 NIP-02 contact-list gate is **bypassed**. Membership is
  authenticated by local group-conversation membership plus exact roster
  set-equality (anti-impersonation).
- **One call total** invariant preserved: while in a group call, any inbound
  1-on-1 offer or group offer with a *different* `group-call-id` is
  auto-rejected with `busy`. Multiple inbound offers carrying the *same*
  `group-call-id` are mesh-formation, not concurrent.
- **Leave semantics**: hangup leaves the call; remaining participants
  continue. The call ends naturally for the local user when every other
  participant's per-pair connection has ended (last-one-standing).
- **Call history**: each participant authors one Kind 1405 with multiple `p`
  tags (one per other roster member), `['group-call-id', <hex32>]`, and
  `['conversation-id', <hex16>]`, anchored to the group conversation. Renders
  as a system entry in the group chat timeline.
- **Multi-device** `answered-elsewhere` / `rejected-elsewhere` generalized to
  key on `group-call-id` when present.
- **Android native helpers and senders** (this change): the pure-Java
  decision helpers (`NativeBusyRejectDecision`, `GlobalIceBuffer`,
  `NativeSelfDismissDecision`) are generalized to be group-aware and the
  Java NIP-AC senders gain group-context overloads that emit byte-equivalent
  output to the JS senders (verified by `NativeNipAcSenderTest` against the
  cross-platform fixture). This delivers Android receive-side spec compliance
  for group offers (busy-reject vs mesh-formation), ICE buffering, and
  multi-device dismissal keyed on `group-call-id`.
- **Android multi-PC manager rewrite — deferred to a follow-up change**.
  `NativeVoiceCallManager`, `IncomingCallActivity`, `ActiveCallActivity`,
  `VoiceCallForegroundService` notification text, and the `nospeak_pending_incoming_call`
  SharedPreferences slot extensions are out of scope for this change because
  the orchestration glue is substantial (≈1500–2000 LOC), has no unit-testable
  surface beyond what's already pinned by the helpers, and risks regressions
  in the existing 1-on-1 Android stack. **Until the follow-up lands, the
  group-call entry point in the chat header is hidden on Android**
  (`isAndroidNative()` gate in `ChatView.svelte`'s `showGroupCallButton`
  predicate); group calls are a web/PWA feature in this version.
  Outbound and inbound NIP-AC group-call inner events are still wire-format
  compliant on Android — the helpers and senders are wired up — but the
  user-facing initiate/accept/hangup flow is not.
- UI: a new `GroupActiveCallOverlay.svelte` is mounted alongside the existing
  `ActiveCallOverlay.svelte`. The chat-header phone icon becomes visible in
  group conversations of 2-4 members.

## Impact

- **Affected specs**: `voice-calling` (single change, ~10 ADDED requirements
  + ~6 MODIFIED requirements). No new capability is split off; the lifecycle,
  signaling transport, ICE handling, multi-device behavior, and call-history
  flow are all shared with 1-on-1 calls.
- **Affected code (TypeScript / Svelte)**:
  - `src/lib/core/voiceCall/types.ts`, `constants.ts`, `factory.ts`.
  - `src/lib/core/voiceCall/VoiceCallService.ts` (web): adds group-call entry
    points and a per-peer `Map`-keyed peer-session model alongside the
    existing 1-on-1 single-PC path.
  - `src/lib/core/voiceCall/VoiceCallServiceNative.ts`: forwards new group
    methods to the Android plugin.
  - `src/lib/core/voiceCall/androidVoiceCallPlugin.ts`: type-level surface
    for the new methods and events.
  - `src/lib/core/Messaging.ts`: NIP-AC senders accept group-context
    parameters (`groupCallId`, `conversationId`, `initiatorHex`,
    `participants`, `role`).
  - `src/lib/stores/voiceCall.ts`: new `groupVoiceCallState` store.
  - `src/lib/components/`: new `GroupActiveCallOverlay.svelte`; small
    generalizations of `IncomingCallOverlay.svelte`, `ChatView.svelte` (chat
    header), `ChatList.svelte` (group call-history preview), and
    `CallEventMessage.svelte` (group copy).
- **Affected code (Android Java)**:
  - `NativeVoiceCallManager.java` (substantial multi-PC refactor).
  - `NativeBackgroundMessagingService.java` (group-aware NIP-AC senders +
    dispatch + group follow-gate; reads `Conversation` rows from local DB).
  - `IncomingCallActivity.java` + layout (group variant).
  - `ActiveCallActivity.java` + new RecyclerView adapter + layout (group
    variant).
  - `VoiceCallForegroundService.java` (group context wiring).
  - `AndroidVoiceCallPlugin.java` (new Capacitor methods + events).
  - `GlobalIceBuffer.java` (key widened to `(senderHex, groupCallId)`).
  - 3 new Java unit-test classes.
- **Wire format**: kind 21059 envelope unchanged. Inner kinds 25050-25054
  unchanged in kind number. New tags listed above. Wire-parity fixture at
  `tests/fixtures/nip-ac-wire/inner-events.json` gains group-call cases,
  exercised by both `wireParity.test.ts` (JS) and `NativeNipAcSenderTest.java`
  (Java).
- **Permissions**: no new Android permissions. Microphone permission already
  declared and warmed up by existing voice-call flow.
- **Dependencies**: no new npm or Gradle dependencies.
- **BREAKING (informal)**: older nospeak clients receiving a group-call
  inner event will see the unfamiliar `group-call-id` tag. They follow the
  existing 1-on-1 path and either ring (if the sender is followed) or drop
  silently (if not). Either way the older client cannot participate in the
  mesh because they will not author accepter-to-accepter offers. We accept
  this rather than introducing a capability-advertisement layer.
