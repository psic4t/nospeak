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
- **OpenSpec**: voice-calling capability lives at `openspec/specs/voice-calling/spec.md`. Material changes to the call lifecycle, NIP-AC wire format, or call-history kinds need a new OpenSpec change proposal.

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
