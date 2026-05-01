## Context

The nospeak Android app currently runs a hybrid voice calling stack: incoming-call ringing is handled by a native Android `Activity` (`IncomingCallActivity`) launched via a high-priority CallStyle notification's full-screen intent, but the active-call UI (`ActiveCallOverlay.svelte`) and the WebRTC peer connection (`VoiceCallService.ts`) live entirely in the WebView/JavaScript layer. The native side already runs a foreground service (`VoiceCallForegroundService`) for the duration of the call (audio mode, wake lock), but the FGS does not own any call state or media — it only annotates the system that a call is happening.

This split has three concrete consequences:

1. **Lifecycle fragility** — the WebRTC peer connection is hosted in the WebView. If Android's process budget reclaims or throttles the WebView (background memory pressure, idle backoff), audio drops mid-call. The FGS keeps the process alive but cannot revive a frozen WebRTC stack.
2. **Cold-start accept latency** — when a user taps Accept on a lockscreen ringer, the native flow must boot `MainActivity`, hand control to the SvelteKit router, run `incomingCallAcceptHandler.ts`, dispatch a synthesized inner event into `VoiceCallService`, and only then call `getUserMedia` and send the answer. This adds 1-3 seconds before the callee hears the caller.
3. **UX inconsistency** — ringing feels native (lockscreen activity, system Accept/Decline buttons), then the call drops back into a webview overlay. There is no native lockscreen affordance for an active call.

The migration target is to move WebRTC, the active-call UI, NIP-AC signaling dispatch, ringback tone, and call-history authoring fully into native Android code, while preserving the existing web/PWA codepath unchanged. The native layer becomes the authoritative owner of voice calls on Android; JS becomes a thin facade that mirrors native state into the existing `voiceCallState` Svelte store and forwards user intents through plugin calls.

The infrastructure for this migration already exists in the codebase. `NativeBackgroundMessagingService.java` already:

- Decrypts NIP-17/NIP-44 gift wraps (`decryptNip44`, `:2118`)
- Signs Nostr events with both Amber (NIP-55) and local nsec (`signEvent`, `:2587`)
- Builds NIP-AC kind-21059 wraps (`buildNipAcWrap`, `:3438`)
- Publishes events to specific relays, reusing connected sockets (`publishEventToRelayUrls`, `:3784`)
- Resolves a recipient's NIP-17 messaging relays from a kind-10050 cache (`resolveRecipientRelays`, `:3741`)
- Authors a complete NIP-AC kind-25054 reject end-to-end with self-wrap for multi-device (`sendVoiceCallReject`, `:3355`)
- Authors a complete kind-1405 chat-history rumor for the `declined` event natively (`sendVoiceCallDeclinedEvent`, `:3520`)

The single largest piece of net-new code is the WebRTC peer connection itself. We will use `io.getstream:stream-webrtc-android` 1.3.x — an actively maintained community fork of Google's WebRTC builds, distributed via Maven Central as a single AAR with prebuilt `.so` binaries. Its `org.webrtc.*` package layout is identical to Google's deprecated artifact, so the API maps near-1:1 from `RTCPeerConnection` in the existing TypeScript.

Stakeholders: Android users (UX improvement), web/PWA users (must remain unaffected), nospeak interop (NIP-AC wire format must be unchanged). NIP-AC is a custom protocol used by nospeak; backward compatibility means the new native senders produce byte-equivalent gift wraps to the existing JS senders.

## Goals / Non-Goals

**Goals:**

- Move the entire active voice-call stack (UI + WebRTC + signaling dispatch + audio + ringback + history authoring) to native on Android.
- Preserve the web/PWA path with zero behavior change.
- Eliminate the JS round-trip on lockscreen accept; native call manager builds the peer connection and sends the Answer directly.
- Provide a native active-call UI that can be shown over the lockscreen (matching the ringing UI's lockscreen capability).
- Keep the NIP-AC wire protocol byte-identical so existing clients interoperate.
- Ship incrementally behind a `enableNativeCalls` feature flag with four well-bounded phases, each independently shippable and revertible.
- Maintain the existing `voiceCallState` Svelte store as the single source of truth for UI state on both platforms; native pushes state into it via plugin events on Android.
- Add Schnorr signature verification to the native NIP-AC inbound path (security hygiene; today only JS verifies).

**Non-Goals:**

- iOS native calling. No iOS app exists.
- TelecomManager / ConnectionService integration. Out of scope; potential future phase.
- Group calls or video calls.
- Native PIN entry UI. We reuse the existing JS unlock screen via a documented intent contract.
- Replacing the `voiceCallState` store with a native-only state container. The existing store is reused on both platforms.
- Migrating the kind-1405 chat-history rumors authored in `Messaging.ts` to native for the **web** build. Only the Android build switches to native authoring.
- Solving the "WebView killed mid-call" problem on the **web** path. Web users continue to depend on browser tab lifecycle.

## Decisions

### 1. WebRTC SDK: `io.getstream:stream-webrtc-android` 1.3.x

Use Stream's community fork of Google WebRTC, distributed via Maven Central as a single-line gradle dependency:

```gradle
implementation 'io.getstream:stream-webrtc-android:1.3.8'
```

The package layout is `org.webrtc.*` — identical to Google's old `org.webrtc:google-webrtc` artifact — so all existing Android WebRTC tutorials and code samples apply without modification. The AAR ships prebuilt native `.so` libraries for `arm64-v8a`, `armeabi-v7a`, `x86`, and `x86_64`. License: Apache 2.0.

**Alternatives considered:**

- **Build official Google WebRTC from source** — Google stopped publishing Maven artifacts in 2023. Building from source requires `depot_tools`, a multi-GB Chromium-style checkout, and a Linux build host. Strongly rejected: prohibitive build infrastructure cost for a single dependency.
- **`livekit-android-sdk`** — bundles SFU client glue and signaling we don't need. Higher-level than what fits here. Rejected.
- **`com.dafruits:webrtc`** — another community fork. Less actively maintained than Stream's. Rejected.

### 2. Active in-call UI: full native `Activity` (not a hybrid Svelte overlay driven by native state)

Introduce `ActiveCallActivity` with XML layout `activity_active_call.xml`. The visual style mirrors `activity_incoming_call.xml` (avatar, caller name, status text) and replaces accept/decline with mute, speaker, and hangup `ImageButton`s plus a `Chronometer` widget for duration. The Activity uses `FLAG_SHOW_WHEN_LOCKED` and `FLAG_TURN_SCREEN_ON` like `IncomingCallActivity` so it can run over the lockscreen.

The Svelte `ActiveCallOverlay.svelte` is kept for the web/PWA build, gated to non-Android in `+layout.svelte` (mirroring the existing `IncomingCallOverlay` gating).

**Alternatives considered:**

- **Hybrid: Svelte overlay driven by native state events** — smaller scope, single UI to maintain, but does not solve the "active call needs a lockscreen affordance" requirement and keeps the active-call UI dependent on WebView health. Rejected because lockscreen access for the active call is one of the user-visible wins driving this change.
- **Native Activity only when locked, Svelte when unlocked** — most complex of the three; introduces dual UIs that must stay in sync. Rejected because once we have a native Activity, the maintenance cost of also supporting the Svelte overlay on Android is the same as not having the native one.

### 3. Native call manager hosted by `VoiceCallForegroundService` (not its own service)

`NativeVoiceCallManager` is a plain Java class instantiated and lifecycle-bound by `VoiceCallForegroundService`. The FGS already runs for the entire call duration with `FOREGROUND_SERVICE_TYPE_PHONE_CALL`, owns the wake lock, and configures `AudioManager.MODE_IN_COMMUNICATION`. Adding the `PeerConnectionFactory`, ICE buffer, and call timer to the FGS is the natural fit; no second service needed.

**Alternatives considered:**

- **Standalone `Service` for the call manager** — extra Service component to register, separate lifecycle to manage, redundant given the FGS is already always running for calls. Rejected.
- **Manager in the Application class** — too long-lived; would survive call ends and risk leaks. Rejected.

### 4. Cold-start accept routes through native, not JS

Today: lockscreen `IncomingCallActivity` Accept tap → launches `MainActivity` with `accept_pending_call=true` → JS reads pending offer from SharedPreferences → synthesizes inner event → calls `voiceCallService.acceptCall()`.

After: lockscreen `IncomingCallActivity` Accept tap → starts `VoiceCallForegroundService` with `ACTION_ACCEPT` extra → `NativeVoiceCallManager` reads pending offer from SharedPreferences → builds `PeerConnection` → sends Answer → starts `ActiveCallActivity`. JS receives a `callStateChanged` event after the fact and updates the store; if the user later opens MainActivity it sees the call already active.

This eliminates 1-3 seconds of JS bootstrap from the critical path and makes accept latency comparable to a native phone app.

**Alternatives considered:**

- **Keep current JS handoff, just swap WebRTC implementation** — the JS bootstrap remains on the critical path. Rejected because reducing accept latency is one of the user-visible wins.

### 5. NIP-AC inbound dispatch: extend native handler, gate JS dispatch on Android

The native `handleNipAcWrapEvent` (`NativeBackgroundMessagingService.java:3160-3334`) currently dispatches kind-25050 offers (persisting to SharedPreferences and posting the FSI notification) and drops kinds 25051/25052/25053/25054 at line `:3245-3250`. Extend it so that, when the Android app is foreground and `enableNativeCalls=true`, all inner kinds dispatch directly into `NativeVoiceCallManager` (offer → setRemoteDescription + transition to `incoming-ringing`; answer → setRemoteDescription + transition to `connecting`; ICE → addIceCandidate; hangup → close PC + transition to `ended`).

Simultaneously, extend the JS-side skip pattern at `Messaging.ts:490-497` (which today only skips offers on Android) to skip *all* NIP-AC inner kinds on Android when native calls are enabled. This prevents echo/duplicate dispatch.

**Alternatives considered:**

- **Always dispatch in JS, have native send commands to JS via plugin** — keeps the dispatch single-sourced but reintroduces the JS dependency for the in-call signaling path. Rejected: defeats the WebView-independence goal.
- **Always dispatch in native, JS gets state events only** — what we're doing on Android. Web continues to dispatch in JS (no native side there).

### 6. NIP-AC outbound senders: model on `sendVoiceCallReject`

The native reject-send path is a complete reference: it builds a kind-25054 inner event, encrypts to recipient with NIP-44, signs with an ephemeral key inside `buildNipAcWrap`, and publishes via `publishEventToRelayUrls`. The new senders are parameterized variants (~30 lines each):

- `sendVoiceCallOffer(recipientHex, callId, sdp)` → kind 25050
- `sendVoiceCallAnswer(recipientHex, callId, sdp)` → kind 25051
- `sendVoiceCallIce(recipientHex, callId, candidate, sdpMid, sdpMLineIndex)` → kind 25052
- `sendVoiceCallHangup(recipientHex, callId, reason)` → kind 25053

Each preserves the existing self-wrap behavior so multi-device "answered/rejected elsewhere" works on every signal type.

The JSON payload format must match `Messaging.ts` byte-for-byte (same property names, same ordering, same tag conventions) to maintain wire compatibility with web nospeak clients and any other NIP-AC-compatible clients. Phase 0 includes a parity test: build the same logical event in JS and Java, normalize JSON, assert byte-equivalence.

**Alternatives considered:**

- **Single generic `sendNipAcSignal(kind, callId, payload)` helper** — slightly DRYer but loses per-kind type safety on the Java side and complicates testing. Rejected; explicit per-kind methods are clearer.

### 7. Schnorr signature verification on native

Today the native receive path does not verify Schnorr signatures of decrypted inner events; it relies on the JS layer's `unwrapNipAcGiftWrap` to verify. After migration the JS layer is no longer on the path on Android, so we must verify natively. BouncyCastle (already a dependency, used for `schnorrSign` at `:2756`) supports BIP-340 verification through the same primitives.

Implementation: a `schnorrVerify(messageBytes, signatureHex, pubkeyHex)` helper modeled on `schnorrSign`, called immediately after rumor decryption and before kind-specific dispatch. Verification failures log and drop the event silently.

**Alternatives considered:**

- **Skip verification, rely on relay-side checks** — relays do not validate inner-event signatures inside gift wraps (they're encrypted). Rejected.
- **Defer verification to Phase 4** — defers a security improvement. Rejected; the verify helper is simple enough to ship in Phase 1.

### 8. PIN-locked nsec: launch MainActivity unlock intent, resume on broadcast

When a user accepts a call with `currentMode == "nsec"` and `localSecretKey == null` (PIN-locked), the native call manager:

1. Persists the call accept intent (callId + offer) to SharedPreferences with key `nospeak_pending_call_unlock`.
2. Launches `MainActivity` with intent extra `EXTRA_UNLOCK_FOR_CALL=callId` plus `FLAG_ACTIVITY_NEW_TASK`.
3. JS unlock screen, on successful PIN entry, sends a `LocalBroadcastManager` broadcast `ACTION_UNLOCK_COMPLETE` with the callId.
4. `NativeVoiceCallManager` (subscribed via `LocalBroadcastReceiver`) catches the broadcast, retries reading `localSecretKey`, and resumes the accept flow.

Outgoing initiate from a PIN-locked state errors out cleanly with a "unlock to call" toast; the user must unlock first via normal app flow.

**Alternatives considered:**

- **Native PIN entry UI** — duplicates UI code that already exists in JS. Rejected.
- **Defer the locked-nsec edge case** — calls already break in this state today. We are not adding a new failure mode; we are replacing one (silently failing to send Answer) with a recoverable one (prompt unlock, then resume). Worth doing in Phase 2.

### 9. Local-only call history events: native→JS bridge

`missed` and `cancelled` chat-history events are written directly to the JS `messageRepo` IndexedDB store with no Nostr round-trip. They cannot be authored purely natively without opening Capacitor's IndexedDB from Java, which is fragile.

Decision: native fires a `callHistoryWriteRequested` plugin event with the rumor payload (recipientNpub, type, callId, initiatorNpub, durationSec?). A JS handler in `VoiceCallServiceNative` calls `messageRepo.saveMessage(...)`. If the WebView is not alive when the native event fires, the event is queued in SharedPreferences and replayed when the WebView next mounts.

**Alternatives considered:**

- **Open IndexedDB from native** — possible but fragile across Capacitor versions and Android storage layout changes. Rejected.
- **Punt: leave `missed`/`cancelled` in JS only, fire only when WebView alive** — acceptable status quo today, but a backgrounded missed call would no longer create a history entry after migration. Rejected.

### 10. Outgoing ringback tone: move to native

Currently `src/lib/core/voiceCall/ringtone.ts` plays a Web Audio tone. After migration the active-call UI is native; keeping the ringback in JS means the Svelte layer must stay alive specifically to play ringback. Cleaner: the FGS plays the ringback via `MediaPlayer` looping a generated tone or a small bundled audio asset. Stops on transition out of `outgoing-ringing`. The same tone characteristics defined in `voice-calling` spec (single-tone every 4 seconds) are preserved.

**Alternatives considered:**

- **Keep ringback in JS** — works in WebView but ties the WebView lifecycle to the call. Rejected for symmetry with the rest of the migration.

### 11. JS-side abstraction: `VoiceCallBackend` interface + factory

`src/lib/core/voiceCall/types.ts` defines `VoiceCallBackend` (initiate, accept, decline, hangup, toggleMute, toggleSpeaker, signal handlers, store-mirror callbacks, getRemoteStream). Two implementations:

- `VoiceCallServiceWeb` — the existing class, renamed. RTCPeerConnection in JS, all signaling via `Messaging.ts`. Used on web/PWA.
- `VoiceCallServiceNative` — thin proxy. Forwards method calls to `AndroidVoiceCall.*` plugin. Listens for `callStateChanged`, `durationTick`, `muteStateChanged`, `callError`, `callHistoryWriteRequested` events. Mirrors state into the existing `voiceCallState` Svelte store. `getRemoteStream()` returns null (audio plays via native AudioTrack).

Factory in `index.ts`:

```ts
export const voiceCallService: VoiceCallBackend =
  Capacitor.getPlatform() === 'android' && enableNativeCalls
    ? new VoiceCallServiceNative()
    : new VoiceCallServiceWeb();
```

UI components (`ActiveCallOverlay.svelte`, `IncomingCallOverlay.svelte`, `ChatView.svelte`, `+layout.svelte`) consume the same `voiceCallService` and `voiceCallState` and need no changes.

**Alternatives considered:**

- **Single class with platform branches inside each method** — bloats `VoiceCallService.ts` and makes web behavior harder to reason about. Rejected.

### 12. Feature flag: `enableNativeCalls`

A boolean flag controlling whether Android uses the native path. Implementation: a build-time constant in `src/lib/config/featureFlags.ts` plus a SharedPreferences override on Android for staged rollout to internal testers. Default false in Phases 0-1; flipped to true once Phase 2 (incoming) and Phase 3 (outgoing) are stable. Phase 4 removes the flag entirely.

When flag is false on Android, the existing JS path is used and the native code is dormant (handlers no-op, plugin methods reject if called unexpectedly). This makes rollback to the JS path trivial.

## Risks / Trade-offs

- **`stream-webrtc-android` upstream divergence** → Mitigation: pin to a specific version (`1.3.8`); Stream's M-line cadence is documented; we re-evaluate on each WebRTC point release.
- **Wire-format drift between JS and Java NIP-AC senders** → Mitigation: Phase 0 adds a parity unit test that builds the same logical event on both sides, normalizes JSON, and asserts byte-equivalence (run from JS using `vitest` against fixed JSON references for the Java output).
- **Echo/double-dispatch during Phase 1 parallel implementation** → Mitigation: gate native dispatch on the feature flag; the JS skip pattern at `Messaging.ts:490-497` is also flag-aware. Either both layers run in JS (flag off) or both layers run in native (flag on); never both.
- **Cold-start accept while WebView is dead** → Mitigation: native call manager works without the WebView (no dependencies on JS during accept). The MainActivity launch happens in parallel with the call setup; JS catches up by reading current state from native via `getCurrentCallState()` plugin method on first connection.
- **PIN-locked nsec accept fails if user dismisses unlock** → Mitigation: timeout the accept after 30s of unlock pending (matches existing offer timeout), send a reject to the caller, persist a `missed` history event.
- **AudioManager mode collisions with other audio apps** → Mitigation: existing `VoiceCallForegroundService.configureAudioMode()` already handles mode capture/restore; native WebRTC's `AudioDeviceModule` plays nicely with `MODE_IN_COMMUNICATION`.
- **Inner-event Schnorr verification adds CPU during ICE bursts** → Mitigation: BouncyCastle Schnorr verify is fast (~1ms per event on mid-tier Android); ICE candidate frequency is bounded by WebRTC (a few per second at peak). Negligible.
- **Native code is harder to test than TypeScript** → Mitigation: keep critical logic (ICE buffer, state machine) algorithmically simple; Phase 4 adds Robolectric tests; existing `androidTestImplementation` config in `build.gradle:99-100` is unused but configured.
- **Back-compat for users who downgrade to a pre-migration build** → Mitigation: NIP-AC wire format is unchanged; persisted SharedPreferences (`nospeak_pending_incoming_call`, etc.) keep the same schema; downgrade-then-upgrade works.
- **Capacitor plugin API changes** → Mitigation: `AndroidVoiceCall` plugin already exists and follows the established pattern; new methods are additive.

## Migration Plan

### Phase 0 — Plumbing (flag default off, no behavior change)

- Add `io.getstream:stream-webrtc-android:1.3.8` to `android/app/build.gradle`.
- Add native NIP-AC senders for kinds 25050/25051/25052/25053 (model on `sendVoiceCallReject`).
- Add native Schnorr-verify helper.
- Refactor `VoiceCallService.ts` behind `VoiceCallBackend` interface (existing class becomes `VoiceCallServiceWeb`). Factory returns web implementation regardless of platform.
- Add `enableNativeCalls` feature flag (default false).
- Add JS-side wire-format parity test against fixed Java-produced JSON fixtures.

**Acceptance:** `npm run check` and `npx vitest run` pass; manual smoke test of Android voice calls shows zero regression (still using the JS path).

**Rollback:** revert the gradle dep + delete the new Java methods; the refactored interface is benign.

### Phase 1 — Native WebRTC manager (parallel implementation, flag-gated)

- New `NativeVoiceCallManager` class hosted by `VoiceCallForegroundService`.
- Extend `AndroidVoiceCallPlugin` with new methods (`initiateCall`, `acceptCall`, `declineCall`, `hangup`, `toggleMute`, `toggleSpeaker`) and new events (`callStateChanged`, `durationTick`, `callError`, `muteStateChanged`, `callHistoryWriteRequested`).
- Extend native inbound dispatch in `handleNipAcWrapEvent` for kinds 25051/25052/25053 (gated by flag).
- Add Schnorr-verify call before dispatch.
- New `VoiceCallServiceNative` TS class implementing `VoiceCallBackend`.
- Bridge `callHistoryWriteRequested` event to `messageRepo.saveMessage` on the JS side.
- Update factory: when `enableNativeCalls === true && platform === 'android'`, return `VoiceCallServiceNative`.
- Extend `Messaging.ts:490-497` skip pattern to all NIP-AC inner kinds when flag is true.

**Acceptance:** with flag enabled on Android, can place and receive a call between two test devices. State store updates correctly. Mute, speaker, hangup work. Web build still functions.

**Rollback:** flip flag to false; native code is dormant.

### Phase 2 — Native ActiveCallActivity + cutover for incoming calls

- New `activity_active_call.xml` layout.
- New `ActiveCallActivity` Java class with `FLAG_SHOW_WHEN_LOCKED`.
- Update `IncomingCallActivity` Accept path to start FGS with `ACTION_ACCEPT` (no JS round-trip).
- PIN-locked nsec fallback: `EXTRA_UNLOCK_FOR_CALL` intent + `LocalBroadcastReceiver` + retry logic.
- JS unlock screen: emit `ACTION_UNLOCK_COMPLETE` broadcast on successful PIN entry when `EXTRA_UNLOCK_FOR_CALL` is present.
- Suppress `ActiveCallOverlay.svelte` on Android (gate at `+layout.svelte:659`).
- Repurpose or remove `MainActivity.handleIncomingCallIntent` `accept_pending_call=true` handling.

**Acceptance:** receive a call with device locked → tap Accept → call connects without showing MainActivity → `ActiveCallActivity` displays over lockscreen → mute/speaker/hangup work → call ends cleanly.

**Rollback:** flip flag to false; the new Activity becomes unreachable; old JS path resumes.

### Phase 3 — Cutover for outgoing calls + native ringback

- `ChatView.svelte:1303` outgoing initiate routes through `VoiceCallServiceNative.initiateCall` → plugin → `NativeVoiceCallManager.initiateCall`.
- `NativeVoiceCallManager.initiateCall`: generate callId, build PC, get local audio, send Offer (kind 25050), apply 60s offer timeout, start FGS, launch `ActiveCallActivity`.
- Move outgoing ringback tone from `ringtone.ts` to native `MediaPlayer`.
- ICE candidate trickle: native `Observer.onIceCandidate` → `sendVoiceCallIce`.

**Acceptance:** initiate call from chat → `ActiveCallActivity` shows → ringback plays from native → callee accepts → call connects → ends cleanly.

**Rollback:** flip flag to false.

### Phase 4 — Cleanup & hardening

- Move gift-wrapped chat-history rumors (`ended`, `no-answer`, `failed`, `busy`) to native parameterized author (variant of `sendVoiceCallDeclinedEvent`).
- Remove `enableNativeCalls` flag and dead branches.
- Trim `VoiceCallServiceWeb` to web-only API surface (remove Android session calls).
- Add Robolectric tests for `NativeVoiceCallManager` ICE buffering and state machine.
- Update CLAUDE.md / AGENTS.md / README architecture documentation.
- Permissions audit: verify `RECORD_AUDIO` runtime permission flow on initiate and accept paths.

**Acceptance:** full E2E test matrix passes (initiate / answer / decline / hangup × foreground / background / locked × nsec / Amber). No `enableNativeCalls` references remain. No dead code from the JS WebRTC path.

**Rollback:** Phase 4 removes the safety net. Rollback after Phase 4 requires reverting the corresponding commits.

## Open Questions

- Should the native `ActiveCallActivity` use `Chronometer` (zero-config but limited formatting) or a manual `TextView` updated by `durationTick`? (Leaning Chronometer for simplicity.)
- For the wire-format parity test in Phase 0, do we ship Java-produced fixture JSON in the repo, or run an instrumented test that produces fixtures on first run? (Leaning fixtures-in-repo: simpler, gives us a documentary record of the wire format.)
- Do we want a "leave call" notification action for the active call (separate from the existing FGS hangup action), or is the FGS hangup action sufficient? (Leaning sufficient.)
- Should ringback fall back to Web Audio in the brief window between offer-send and FGS startup, or always native? (Leaning always native: send Offer only after FGS is up and ringback is ready, so no gap.)
