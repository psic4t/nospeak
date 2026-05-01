## Why

Nospeak's voice-call signaling is currently a homegrown convention layered on the NIP-17 chat pipeline (kind 14 rumors discriminated by a `['type','voice-call']` tag, wrapped in kind 1059 gift wraps with a NIP-13 seal). NIP-AC (PR [nostr-protocol/nips#2301](https://github.com/nostr-protocol/nips/pull/2301)) standardizes WebRTC voice and video calls over Nostr using dedicated event kinds 25050–25054 and a single-layer ephemeral gift wrap (kind 21059). Migrating to NIP-AC aligns nospeak with the emerging Nostr standard, eliminates a custom protocol, fixes a latent ICE-candidate buffering race, and adds spec-mandated multi-device and follow-gating behavior.

## What Changes

- **BREAKING** Replace voice-call signaling kinds: gift wrap **1059 → 21059**, inner rumor **kind 14 + JSON content → signed inner events of kinds 25050 (Offer), 25051 (Answer), 25052 (ICE), 25053 (Hangup), 25054 (Reject)**.
- **BREAKING** Remove the NIP-13 seal layer for signaling (NIP-AC ephemeral gift wrap is single-layer; inner event is signed by the sender's real key).
- **BREAKING** Move `call-id`, `call-type`, and `alt` from JSON `content` to first-class event tags. SDP becomes the raw `content` of Offer/Answer; ICE Candidate `content` becomes a strict `{candidate, sdpMid, sdpMLineIndex}` JSON.
- **BREAKING** Drop NIP-40 `expiration` tag from outgoing signaling events (the ephemeral kind range conveys transience).
- Add a 60-second `created_at` staleness check on receive (one constant; tunable to NIP-AC's 20s default if upstream consensus changes).
- Add multi-device support: self-wrap kinds 25051 and 25054 only, with new end reasons `answered-elsewhere` and `rejected-elsewhere`.
- Add a two-layer ICE candidate buffer (global, keyed by sender pubkey; per-session, flushed after `setRemoteDescription`).
- Add hardcoded follow-gated incoming ringing: drop kind 25050 Offers from non-followed pubkeys; drop if the contact list is not yet loaded.
- Add native plugin method `dismissIncomingCall(callId)` on Android so multi-device "answered/rejected elsewhere" cancels the lockscreen full-screen-intent ringer.
- Update `NativeBackgroundMessagingService` to subscribe to `kinds:[1059, 21059] #p:[me]` and to mirror NIP-AC wrap/unwrap and follow-gating.
- Tidy stale spec text: the existing capability still references "Kind 16" for call history; correct to **Kind 1405** (already in code).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- **voice-calling** — signaling protocol overhaul (transport, kinds, encryption, tags), new requirements for ICE buffering, multi-device self-notification, and follow-gating; removal of the NIP-40 ephemerality requirement; corrections to call-history kind references.

## Impact

**Affected specs:**
- `openspec/specs/voice-calling/spec.md`

**Affected TypeScript code:**
- `src/lib/core/voiceCall/constants.ts` — new NIP-AC kinds, drop legacy constants.
- `src/lib/core/voiceCall/types.ts` — kind-based `VoiceCallSignal`, new end reasons.
- `src/lib/core/voiceCall/VoiceCallService.ts` — kind-based dispatch, ICE buffering, multi-device end reasons.
- `src/lib/core/voiceCall/incomingCallAcceptHandler.ts` — updated handoff slot schema.
- `src/lib/core/voiceCall/androidVoiceCallPlugin.ts` — new `dismissIncomingCall` method.
- `src/lib/core/Messaging.ts` — new `createNipAcGiftWrap`/parse helpers, typed send helpers, kind 21059 receive branch with staleness/dedup/self-event-filter/follow-gate.
- `src/lib/stores/voiceCall.ts` — new `setEndedAnsweredElsewhere`/`setEndedRejectedElsewhere` reducers.
- `src/lib/core/voiceCall/VoiceCallService.test.ts` — refactor to kind-based fixtures.
- New tests: `Messaging.nipAcGiftWrap.test.ts`, `VoiceCallService.iceBuffer.test.ts`, `Messaging.followGate.test.ts`.

**Affected Android (Java) code:**
- `android/app/src/main/java/com/nospeak/app/NativeBackgroundMessagingService.java` — NIP-AC wrap/unwrap, kind-based dispatch, follow-gating before FSI, multi-device self-wrap on reject, subscription filter update to include kind 21059.
- `android/app/src/main/java/com/nospeak/app/IncomingCallActionReceiver.java` — emit kind 25054 with self-wrap on decline.
- `android/app/src/main/java/com/nospeak/app/AndroidVoiceCallPlugin.java` — expose `dismissIncomingCall(callId)`.
- Cold-start handoff SharedPreferences slot `nospeak_pending_incoming_call` — schema update; old-shape entries ignored on first boot of the new version.

**No backwards compatibility:** older nospeak builds cannot interoperate with the new build for calls. README NIP list updated; release notes call this out. No legacy-version UX hint is shown.

**Amber users get a one-time NIP-AC permission warmup.** The Android NIP-55 (Amber) sign-permission grant is established per-app+kind. Empirically, Amber v6.x ignores the `permissions` extra at `getPublicKey` time and only adds kinds to the grant set after the first interactive sign prompt for that kind. The accept-call flow naturally seeds kinds 25051 / 25052 / 25053 (Answer / ICE / Hangup) via the JS-side `Nip55Signer.signEvent`, but kind 25050 (Offer) is signed only when the user *initiates* a call, and kind 25054 (Reject) is signed by the native Java decline path which runs in a BroadcastReceiver context with no Activity available to host an interactive prompt — meaning kind 25054 can never be seeded by natural usage.

To close this gap, `loginWithAmber` (and the Amber session-restore path) fires a one-time pre-warm via `warmAmberNipAcPermissions` (`src/lib/core/voiceCall/amberPermissionsWarmup.ts`). It dispatches dummy `signEvent` calls for kinds 25050 and 25054 through the JS signer; Amber's existing interactive-Intent fallback (for null cursor, i.e. no prior grant) prompts the user to approve + remember each kind. The signed events are discarded — never published. A localStorage flag (`nospeak:amber_nip_ac_warmed_v1`) gates re-runs so users see the prompts exactly once. The flag is cleared on logout. Existing Amber users see the prompts on their first launch after upgrading; new users see them at login. Per-kind sign rejections are logged but not surfaced to the user. Local-key (nsec) and Web (NIP-07) users need no action.

**Out of scope (deferred follow-ups):** video calls, mid-call renegotiation (kind 25055), group calls, replacing kind 1405 call history.
