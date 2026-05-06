<!-- OPENSPEC:START -->
# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:
- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:
- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->

# Agent Guidelines

## Commands
- **Build**: `npm run build`
- **Lint/Type Check**: `npm run check` (runs svelte-check against tsconfig)
- **Test**: `npx vitest` (runs all tests; use `--run` for single pass)
- **Single Test**: `npx vitest src/path/to/test.ts` or `npx vitest -t "pattern"`

## Code Style & Conventions
- **Indentation**: Use 4 spaces for indentation.
- **TypeScript**: Strict mode enabled. Define explicit interfaces/types for all data structures.
- **Naming**: PascalCase for Classes/Components/Interfaces. camelCase for functions/vars.
- **Imports**: Group external libraries first, then internal modules.
- **Error Handling**: Use `try/catch` for async operations.
- **Testing**: Write unit tests for logic in `src/lib/core`. Use `vi.mock` for dependencies.
- **Components**: Follow Svelte 5 syntax. Place components in `src/lib/components`.
- **State**: Use Svelte 5 runes or stores in `src/lib/stores`.
- **Validation**: ALWAYS run `npm run check` and `npx vitest run` before finishing a task.
- **Commits**: Use [Conventional Commits](https://www.conventionalcommits.org/) with scope, e.g. `fix(android): description`.

## Voice Calling

Voice and video calls are signaled over Nostr via NIP-AC (kind 21059 ephemeral gift wraps over inner kinds 25050–25055). The two platforms have intentionally different code paths:

- **Web/PWA**: `VoiceCallServiceWeb` (`src/lib/core/voiceCall/VoiceCallService.ts`) owns the `RTCPeerConnection`, captures audio (and optionally video) via `getUserMedia`, sends NIP-AC events through `Messaging.ts`'s typed senders. UI is `ActiveCallOverlay.svelte`.
- **Android native**: `VoiceCallServiceNative` (`src/lib/core/voiceCall/VoiceCallServiceNative.ts`) is a thin proxy to the `AndroidVoiceCall` Capacitor plugin. The actual peer connection lives in `NativeVoiceCallManager.java`, hosted by `VoiceCallForegroundService.java` (FGS type `phoneCall`). UI is `IncomingCallActivity` (lockscreen ringer) and `ActiveCallActivity` (in-call surface). NIP-AC events are dispatched in `NativeBackgroundMessagingService.java` directly into the manager; `Messaging.ts` skips them on Android.

The factory in `src/lib/core/voiceCall/factory.ts` returns the right backend based on `Capacitor.getPlatform()`. UI components subscribe only to the `voiceCallState` Svelte store and never touch a backend directly.

**NIP-AC inner kinds**: 25050 Call Offer, 25051 Call Answer, 25052 ICE Candidate, 25053 Call Hangup, 25054 Call Reject, **25055 Call Renegotiate** (mid-call SDP changes — voice→video upgrade is the only outbound flow today). Renegotiation logic in `VoiceCallService.handleRenegotiate` / `requestVideoUpgrade` (web) and `NativeVoiceCallManager.handleRemoteRenegotiate` / `requestVideoUpgrade` (Android). Glare resolves by lowercase-hex pubkey lex compare — higher pubkey wins, loser uses `setLocalDescription({type:'rollback'})` and accepts the winner's offer.

When changing voice-call behavior:
- **Always update both** `VoiceCallService.ts` (web) and the Android stack if the change is cross-platform.
- **NIP-AC wire format** changes must update both the JS senders in `Messaging.ts` AND the Java senders in `NativeBackgroundMessagingService.sendVoiceCall*`. The fixture at `tests/fixtures/nip-ac-wire/inner-events.json` exercises both via `wireParity.test.ts` (JS) and `NativeNipAcSenderTest.java` (Java).
- **State-machine entry points** in `NativeVoiceCallManager` (`initiateCall` / `acceptIncomingCall` / `notifyIncomingRinging`) must call `runIdleResetIfPendingOrEnded()` first so back-to-back calls work.
- **Renegotiation state** is mirrored in the `voiceCallState.renegotiationState` Svelte store (`'idle' | 'outgoing' | 'incoming' | 'glare'`). The Android side pushes via the `renegotiationStateChanged` plugin event. Mid-call media-kind changes use the dedicated `callKindChanged` plugin event so the `callStateChanged` event isn't overloaded.
- **Android NIP-AC compliance helpers** (pure-Java, unit-testable, all in `com.nospeak.app`):
  - `NativeBusyRejectDecision` — when an offer arrives while `NativeVoiceCallManager.isBusy()`, decides between busy auto-reject (different call-id), duplicate-ignore (same call-id), and normal flow.
  - `GlobalIceBuffer` — pre-session ICE candidate buffer keyed by sender pubkey for kind-25052 events arriving before any manager exists. Drained in `NativeVoiceCallManager.acceptIncomingCall` / `initiateCall` via `MessagingBridge.drainPreSessionIce(senderHex)`. Per-sender FIFO cap 32, total cap 256 senders, 60 s TTL matching `NIP_AC_STALENESS_SECONDS`.
  - `NativeSelfDismissDecision` — kind-aware self-event filter. Self-25050/25052/25053/25055 always drop; self-25051/25054 with a matching call-id either end the manager (`endForAnsweredElsewhere`/`endForRejectedElsewhere`) when one is `INCOMING_RINGING`, or dismiss the lockscreen FSI ringer when only the `nospeak_pending_incoming_call` SharedPrefs slot matches.
- **Native `sendVoiceCallReject`** has both a 2-arg `(recipientHex, callId)` form (legacy callers, content `""`) and a 3-arg `(recipientHex, callId, reason)` form (`reason="busy"` for the busy auto-reject; reason becomes the inner event's `content` field byte-equivalently with the JS `sendCallReject`).
- **OpenSpec**: voice-calling capability lives at `openspec/specs/voice-calling/spec.md`. Material changes to the call lifecycle, NIP-AC wire format, or call-history kinds need a new OpenSpec change proposal.

### Group Voice Calls (NIP-AC, full-mesh, ≤4 participants)

Group calls reuse the existing NIP-AC kind-21059 wrap and inner kinds 25050-25054 (kind 25055 is voice-only and not used for groups). Group semantics are conveyed via additional tags on the inner event: `['group-call-id', <hex32>]`, `['conversation-id', <hex16>]`, `['initiator', <hex>]`, plus `['participants', <hex>, ...]` on kind 25050, plus `['role', 'invite']` on invite-only kind-25050 offers. Receivers branch strictly on the presence of `['group-call-id', ...]`.

- **Topology**: full-mesh peer-to-peer (each device holds N-1 simultaneous PCs). Hard cap of 4 total participants.
- **Anchor**: an existing group `Conversation` (16-char hex `id`, `isGroup=true`). The anchor conversation's local membership replaces the 1-on-1 NIP-02 follow-gate for inbound group offers (the user has already opted in by being a group member).
- **Edge ownership**: deterministic-pair offerer rule — the participant whose lowercase-hex pubkey is lex-lower is the SDP offerer for that pair. Same rule already used for kind-25055 renegotiation glare resolution. Initiator-as-answerer edges are seeded with invite-only kind-25050 (empty SDP, `role=invite` tag); the recipient — the designated offerer — sends a real-SDP kind-25050 back on accept.
- **Concurrency**: "one call total" invariant preserved. Inbound kind-25050 with the SAME `group-call-id` as the active call is mesh formation (not concurrent); different `group-call-id` or any cross-mode (group↔1-on-1) is busy-rejected.
- **Multi-device dismissal**: kind-25051/25054 self-events keyed on `group-call-id` (group calls) or `call-id` (1-on-1 calls) per the modified self-event filter.
- **Call history**: one Kind-1405 rumor with multiple `p` tags + `['group-call-id', ...]` + `['conversation-id', ...]` per participant, through the existing 3-layer NIP-17 group rumor pipeline (distinct from the kind-21059 signaling pipeline).

**Web/PWA implementation**: `VoiceCallServiceWeb` holds a per-peer `Map<peerHex, RTCPeerConnection>` for the group call (alongside its existing single-PC 1-on-1 fields). Group-call entry points: `initiateGroupCall(conversationId)` / `acceptGroupCall()` / `declineGroupCall()` / `hangupGroupCall()` / `toggleGroupMute()`. Store: `groupVoiceCallState` (parallel to `voiceCallState`). UI: `GroupActiveCallOverlay.svelte` (mounted alongside the 1-on-1 overlay), generalized `IncomingCallOverlay.svelte`, chat-header group-call button gated on `isAndroidNative()` and roster size.

**Android implementation status**: the pure-Java helpers (`NativeBusyRejectDecision`, `GlobalIceBuffer`, `NativeSelfDismissDecision`) are group-aware and the Java NIP-AC senders accept a `GroupSendContext` for byte-equivalent group inner events. The full multi-PC `NativeVoiceCallManager` rewrite plus the lockscreen `IncomingCallActivity` / `ActiveCallActivity` group variants are **deferred to a follow-up change** (`add-group-voice-calling-android-manager`). Until that follow-up lands the chat-header group-call button is hidden on Android and `VoiceCallServiceNative.initiateGroupCall` etc. throw.

When changing group-call behavior:
- **Wire format**: every inner-event change must extend both the JS `buildGroupExtraTags` helper in `nipAcGiftWrap.ts` AND the Java `NativeBackgroundMessagingService.buildGroupExtraTags` helper, then add a fixture entry to `tests/fixtures/nip-ac-wire/inner-events.json` so `wireParity.test.ts` (JS) and `NativeNipAcSenderTest` (Java) both verify byte-equivalence.
- **Authoritative quadruple**: receivers cache `(group-call-id, initiator, conversation-id, roster)` from the first kind-25050 with that `group-call-id`; subsequent inner events whose `initiator` or `conversation-id` tag disagrees are dropped. The roster is also re-validated against the local DB membership for kind-25050 (group follow-gate).
- **State machine**: aggregate per-call status is *derived* from the `participants` map via `deriveGroupStatus` (exported from `voiceCall.ts` for unit testing). Never store the aggregate independently.
- **OpenSpec**: group-call requirements are captured under the same `voice-calling` capability. Changes that affect lifecycle, wire format, or follow-gate need a new change proposal.

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git commit` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd sync
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed (dont push)
7. **Hand off** - Provide context for next session
