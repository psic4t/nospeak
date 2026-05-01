## Context

Nospeak today carries WebRTC signaling on the NIP-17 chat pipeline:

- Outer envelope: kind **1059** gift wrap (NIP-59).
- Seal: kind **13** (NIP-17 / NIP-59), signed by the sender, NIP-44-encrypted to the recipient.
- Inner: unsigned kind **14** rumor with `tags = [['p', recipient, relay], ['type', 'voice-call'], ['expiration', now+60]]` and JSON content `{type:'voice-call', action, callId, sdp?, candidate?}`.

Both the TypeScript path (`src/lib/core/Messaging.ts:2125–2196`) and the Java cold-start path (`android/app/src/main/java/com/nospeak/app/NativeBackgroundMessagingService.java`) implement this pipeline.

NIP-AC ([nostr-protocol/nips#2301](https://github.com/nostr-protocol/nips/pull/2301)) is structurally different in three ways that all matter to the implementation:

1. The inner signaling event is a **signed real event** (kind 25050–25054) — not an unsigned rumor.
2. There is **no seal layer**. The single ephemeral wrap (kind **21059**) hides the sender from relays; the inner event signature provides authentication.
3. `call-id`, `call-type`, and `alt` are first-class **tags**, and `content` is the raw SDP / a strict ICE JSON / an empty-or-`"busy"` reason — not a JSON discriminator blob.

The stakeholders for this migration are: (a) nospeak end users, who will need to upgrade in lockstep because there is no backwards compatibility; (b) future interop partners who will ship NIP-AC (Amethyst is in progress per the PR); (c) ourselves as maintainers, who will need to keep the TS and Java sides in sync — already a tech-debt source.

## Goals / Non-Goals

**Goals:**
- Conform to NIP-AC for **voice-only**, **1-on-1** calls.
- Replace the homegrown kind-14 + JSON convention with NIP-AC's kinds 25050–25054 wrapped in kind 21059.
- Implement NIP-AC's two-layer ICE candidate buffer (also fixes a latent race-condition bug regardless of NIP-AC).
- Implement NIP-AC's multi-device self-notification: self-wrap on Answer (25051) and Reject (25054); add `answered-elsewhere` / `rejected-elsewhere` end reasons.
- Implement NIP-AC follow-gated incoming ringing (hardcoded — no settings toggle).
- Keep nospeak-specific call-history pills (kind 1405) untouched. NIP-AC defines no history mechanism.
- Drop the NIP-13 seal layer and the NIP-40 expiration tag from signaling events; rely on the ephemeral kind range plus a 60-second `created_at` staleness check.

**Non-Goals (deferred follow-ups, not in this change):**
- Video calls (`call-type=video`, video tracks, video UI).
- Mid-call renegotiation (kind 25055).
- Group calls (full-mesh, callee-to-callee discovery, glare).
- Replacing kind 1405 call history.
- User-facing toggle for follow-gating (hardcoded per scope decision).
- Refactoring the duplicated TS/Java NIP-44 / NIP-17 layer (treated as a black box; only new entry points added alongside).

## Decisions

### 1. Single-PR breaking cutover, no dual stack

Ship the migration in a single coordinated release. Do not maintain a parallel kind-14 voice-call path during a transition window.

**Rationale:** Dual-stack would double the receive-path surface area, delay cleanup of the old code, and require runtime negotiation logic to pick which kind to use per peer. The active user base is small enough that a single coordinated release is acceptable. NIP-AC's author explicitly states the spec is not backwards compatible with NIP-100.

**Alternatives considered:**
- Dual-stack with capability advertisement → rejected: complexity not justified for this user base.
- Feature flag with progressive rollout → rejected: same maintenance cost as dual-stack.

### 2. New `createNipAcGiftWrap` parallel to existing `createGiftWrap`

Create a new helper in `Messaging.ts` named `createNipAcGiftWrap(signedEvent, recipientPubkey)` that produces a kind-21059 wrap directly from a signed inner event (no seal). Keep the existing `createGiftWrap` for chat (kind 14) and call history (kind 1405).

**Rationale:** The two pipelines have structurally different inner-event semantics (unsigned rumor vs. signed event), outer kind, AND `created_at` treatment:

| | kind 1059 (NIP-17 chat / call history) | kind 21059 (NIP-AC signaling) |
|---|---|---|
| Persisted by relay | Yes | No (ephemeral kind range) |
| Wrap `created_at` | Randomized up to 2 days in past (NIP-59 metadata-leak hardening) | **Now (Unix seconds)** — relays reject ephemeral events with stale `created_at` |
| Inner-event signature | Inner is unsigned rumor; signature lives on the seal | Inner is signed by the sender's real key |

The `created_at` divergence matters at runtime: relays enforce ephemeral-freshness checks on kind 21059 and reject anything more than a few seconds in the past with `"invalid: ephemeral event expired"`. Using the NIP-59 randomization for kind 21059 makes the wrap silently undeliverable. The wrap's anonymity guarantee comes from the fresh ephemeral pubkey, not the timestamp; randomizing the timestamp adds nothing. Reusing `createGiftWrap` would require a boolean flag that obscures these semantic differences and risks the wrong defaults.

**Alternatives considered:**
- Generalize `createGiftWrap` with a `seal: boolean` parameter → rejected: leaks protocol semantics into a generic helper.
- Replace `createGiftWrap` entirely → rejected: breaks chat and call-history paths that are out of scope.

### 3. Drop NIP-40 `expiration` tag from signaling, rely on staleness check

Outgoing kind 21059 wraps and inner kinds 25050–25054 events do **not** carry an `expiration` tag. On receive, drop any inner event whose `created_at` is more than **60 seconds** in the past.

**Rationale:** NIP-AC says the ephemeral kind range (20000–29999) itself communicates transience to relays. Carrying a redundant NIP-40 tag would be non-conformant. The staleness check defends against uncooperative relays that persist ephemeral events.

**60s vs 20s:** NIP-AC PR text says 20s, but PR community feedback (`wcat7`, `vitorpamplona`) acknowledges 20s is too short for cold-start scenarios. Using 60s matches `CALL_OFFER_TIMEOUT_MS` and is robust against the same kinds of issues. One constant; revisit if upstream consensus changes.

**Alternatives considered:**
- Keep NIP-40 expiration alongside ephemeral kind → rejected: non-conformant with NIP-AC; relays should not need both signals.
- Use NIP-AC's 20s default → rejected: too aggressive for cold-start handoff.

### 4. Multi-device: self-wrap only Answer (25051) and Reject (25054)

Only Answer and Reject events are duplicated as a self-addressed gift wrap (`p` tag = sender's own pubkey, wrap encrypted to self). Offer (25050), ICE (25052), and Hangup (25053) are NOT self-wrapped.

**Rationale:**
- **Offer**: only the recipient needs it. Self-wrapping would loop the offer back to the same device that sent it.
- **ICE**: peer-specific by construction; self-wrap is meaningless.
- **Hangup**: the sender already knows locally that they hung up. NIP-AC's "Self-Event Filtering" rules explicitly say self-hangups are always ignored.
- **Answer / Reject**: this is the multi-device hook. A self-addressed Answer/Reject in `IncomingCall` state on another device transitions that device to "answered-elsewhere" / "rejected-elsewhere" instead of leaving it ringing.

**Alternatives considered:**
- Self-wrap everything for symmetry → rejected: wasted relay traffic and complicates the self-event filter.
- Skip self-wrap entirely (defer multi-device) → rejected: scope decision was to bundle multi-device.

### 5. Two-layer ICE candidate buffer

Buffer in two places:
- **Global buffer** on `VoiceCallService`: `Map<senderPubkey, RTCIceCandidateInit[]>`. Holds candidates that arrive before any `PeerConnection` exists for that sender (e.g. callee is still ringing).
- **Per-session buffer**: list on the active call session. Holds candidates that arrive after the PC exists but before `setRemoteDescription()` resolves.

Drain the global buffer into the per-session buffer when a `PeerConnection` is created for that peer. Flush the per-session buffer via `addIceCandidate()` once `setRemoteDescription()` resolves.

**Rationale:** Today's code (`VoiceCallService.ts:463–470`) calls `addIceCandidate` directly. If candidates arrive before the PC is constructed (typical with trickle ICE while the user is still ringing), they are silently lost. NIP-AC mandates this buffering and it independently fixes a latent bug.

**Alternatives considered:**
- Single buffer with state-aware drain → rejected: harder to reason about cleanup, especially when ringing on multiple devices and one accepts.
- Defer ICE buffering to a follow-up change → rejected: bundle decision per scope; minimal additional cost while we're already touching this file.

### 6. Hardcoded follow-gating, drop on cold-start

Drop kind 25050 Offers from non-followed pubkeys silently. If the user's NIP-02 contact list has not yet loaded in the current session, drop the offer.

**Rationale:** This is the safer-by-default behavior. Ringing on cold-start before contacts resolve would be a phone-spam vector. The 1-second-ish window of dropped legitimate calls is acceptable; the caller can retry. NIP-AC spec is SHOULD-level; making it hardcoded MUST simplifies the threat model.

The follow-gate must also live in the Java native path so that the lockscreen full-screen-intent (FSI) doesn't fire when the app is closed and a non-followed user calls. Otherwise the JS-layer gate is bypassed.

**Alternatives considered:**
- Settings toggle "Allow calls from non-followed users" → rejected per scope: simpler hardcoded for now; can be added later.
- Block ringing until contact list resolves with a short timeout → rejected: more complex than dropping; user can retry.
- Allow ringing during cold-start → rejected: spam vector.

### 7. Kind-based dispatch, no JSON content discriminator

The receive-side filter in `Messaging.ts` branches on the outer wrap kind first (1059 → existing chat path; 21059 → new NIP-AC path), then the NIP-AC path branches on the inner signed event's kind to route to `voiceCallService.handleNipAcEvent`. The legacy `['type','voice-call']` tag is removed from the codebase.

**Rationale:** Standard NIP-AC convention. Faster than parsing JSON content. Eliminates a category of malformed-content bugs.

### 8. Java mirror with explicit drift guard

The Android cold-start path has its own NIP-44 / NIP-17 implementation in `NativeBackgroundMessagingService.java`. It must gain `createNipAcGiftWrap` and `parseNipAcGiftWrap` methods alongside the existing seal-based methods. To prevent silent TS/Java drift, add at least one JVM round-trip test that proves a wrap built in Java decrypts successfully when round-tripped (or vice-versa via test fixtures).

**Rationale:** The TS/Java duplication is preexisting tech debt out of scope to deduplicate. The test fence is the cheapest way to keep the migration safe.

### 9. Cold-start handoff slot schema bump

The Android `nospeak_pending_incoming_call` SharedPreferences slot stores the offer payload between the FCM/native receive and the JS pickup. Schema changes from `{callId, sdp, peerHex, expiresAt}` to `{callId, sdp, peerHex, callType, alt, innerEventId, createdAt}`. On first boot of the new version, any old-shape entry is ignored (one-line guard checks for the new keys).

**Rationale:** The new fields are derived from NIP-AC tags; we need them on the JS side for state-machine bookkeeping and dedup. One-time discard of leftover old entries is safe — at worst the user misses one stale incoming call from before the upgrade.

## Risks / Trade-offs

- **NIP-AC PR may change before merge** (especially staleness window 20s vs. 60s). → Use a single named constant (`NIP_AC_STALENESS_SECONDS`); document the divergence in `design.md`.
- **No interop partner today.** Amethyst is implementing but not shipped. → Self-interop covers protocol correctness against the spec text; add cross-client smoke tests once Amethyst ships.
- **TS/Java duplication amplifies migration cost.** → Mitigate with the JVM round-trip test fence; accept the duplication as preexisting tech debt.
- **Older nospeak builds cannot call newer builds** during rollout. → Coordinated single release; release notes call this out. No legacy-version UX hint per scope decision.
- **Cold-start handoff slot schema change.** → One-time ignore of old-shape entries; documented in `design.md` decision 9.
- **Removed NIP-40 expiration on signaling.** Uncooperative relays might persist kind 21059 wraps. → 60s staleness check on receive; same defense NIP-AC mandates for everyone.
- **Follow-gating may surprise users** who currently receive calls from non-followed contacts. → Documented in release notes; users can add the contact to their follow list to unblock calls.
- **Subscription filter change** doubles the kinds the relay must filter (`[1059, 21059]`). → Negligible; filter arrays are cheap.

## Migration Plan

1. Land all TS + Java changes in a single PR.
2. Coordinated single release. Older builds will silently drop NIP-AC wraps; new builds will silently drop legacy kind-14 voice-call rumors.
3. Update README NIP list to mention NIP-AC.
4. Release notes call out the breaking change and the new follow-gating behavior.
5. Manual two-client smoke test on the same dev machine before tagging release.

**Rollback:** revert the PR. There is no in-place fallback: a user who downgrades after a failed call will lose nothing because signaling events are ephemeral and not persisted.

## Open Questions

None remaining for this change. All scope and behavior questions (cold-start follow-gating, legacy hint, settings toggle, staleness threshold, Java NIP-44 refactor) were resolved before drafting (see proposal Q&A trail).
