# Design: NIP-AC group voice calls

## Context

Voice calling over NIP-AC currently supports strict 1-on-1 calls. Calls hold
exactly one `RTCPeerConnection` (web) or one native
`org.webrtc.PeerConnection` (Android) for the lifetime of the call, follow a
`peerNpub`-keyed state machine, and are explicitly hidden from group chats.

This change generalizes the system to call the members of an existing group
conversation together, using the same NIP-AC ephemeral gift-wrap pipeline,
without introducing media servers, capability advertisement, or new inner
kinds.

The design is informed by:

- The existing 1-on-1 spec in `openspec/specs/voice-calling/spec.md`, which
  this change extends rather than replaces.
- The pubkey-lex glare-resolution rule already used by the in-flight kind
  25055 renegotiation (`add-call-renegotiation`) — reused here as the mesh
  edge-ownership rule.
- The NIP-AC wire-parity fixture at `tests/fixtures/nip-ac-wire/inner-events.json`
  which is doubly enforced by `wireParity.test.ts` (JS) and
  `NativeNipAcSenderTest.java` (Java).

## Goals / Non-Goals

### Goals

- Group voice calls between 2-4 members of an existing group conversation.
- Full-mesh peer-to-peer; no media server.
- Reuse of the existing NIP-AC kind-21059 wrap and inner kinds 25050-25054.
- Preserve nospeak's serverless property — nothing new to deploy.
- Preserve the "one call total" invariant.
- Native multi-PC parity on Android (lockscreen ringing, FGS, PIN-locked
  nsec accept all work).
- Group call history rendered in the anchor group's chat timeline.

### Non-Goals (explicitly deferred)

- Late-join / re-invite (closed roster only in v1).
- Group video calls.
- Mid-call media-kind upgrade (kind 25055 unused for groups).
- SFU-backed scaling beyond 4 participants.
- "Host can end for everyone" mechanic.
- Quorum-threshold ringback termination.
- Per-peer mute/kick by another participant.
- Screen sharing.
- Capability advertisement for older clients.

## Decisions

### Topology: full-mesh P2P

Each device holds N-1 simultaneous `RTCPeerConnection`s (or native
`PeerConnection`s on Android). Every roster pair has its own SDP offer/answer
and its own ICE exchange. The shared concept across all pairs is a single
**`group-call-id`** (32-byte hex).

**Alternatives considered.** SFU-backed (rejected: requires server infra,
breaks the no-backend property). MCU-backed (rejected: same plus much heavier
server). Cascaded star/forwarder (rejected: asymmetric and fragile).

### Anchor: existing group conversation

Group calls are anchored to a `Conversation` row with `isGroup === true` and
a 16-char hex `id`. The initiator must be a local member of that conversation;
the recipient must also be a local member to ring. **Local conversation
membership replaces the 1-on-1 NIP-02 follow-gate** for inbound group offers.

**Alternative considered.** Ad-hoc participant sets, with the group
conversation created implicitly on accept. Rejected: every group call needs
a `conversationId` to land call history into; reusing existing groups is
cleaner UX and doesn't require a "new chat created" toast surprise on
recipients.

### No new inner kinds

Group calls reuse inner kinds 25050 (Offer), 25051 (Answer), 25052 (ICE),
25053 (Hangup), 25054 (Reject). Group semantics are conveyed by additional
tags. This minimizes the wire-format surface and keeps backward-compatible
1-on-1 dispatch as a clean fall-through (group-aware code branches strictly
on the presence of `['group-call-id', ...]`).

**Alternative considered.** Allocate kinds 25060-25064 for group variants.
Rejected: doubles the kind table, doubles the test fixtures, doubles the
native dispatch table, and adds nothing the tag-based approach doesn't
already give us.

### Mesh formation: deterministic-pair offerer rule + invite-only seed

For every unordered pair of roster members `{A, B}`, exactly one side is the
designated offerer:

> The participant with the lexicographically lower lowercase-hex pubkey is
> the offerer for that edge.

This rule is **applied uniformly** to every pair, including pairs involving
the initiator. To give every recipient a uniform "incoming call" experience
at the same instant, the initiator seeds *every* edge with a kind-25050
addressed to that peer:

- For edges where the initiator's pubkey is lex-lower than the peer's, the
  initiator's kind-25050 carries a real SDP offer (`content` non-empty, no
  `role` tag).
- For edges where the initiator's pubkey is lex-higher than the peer's, the
  initiator's kind-25050 carries empty `content` and a `['role', 'invite']`
  tag — it is an addressing-only invite, not an SDP offer. On accept, the
  recipient (the actual offerer for that edge) creates the
  `RTCPeerConnection` and sends a real-SDP kind-25050 back.

For accepter-to-accepter edges (B accepts → B must connect to C, who has
also accepted), the deterministic-pair rule is applied without any seeding:
B looks up C's pubkey, compares lex, and either offers (B lex-lower) or
waits for C to offer (B lex-higher).

**Alternative considered.** Special-case "initiator is always the offerer
for first-round edges". Rejected: introduces two rules instead of one. With
the invite-only seed mechanism, the rule is uniform.

**Alternative considered.** "All-to-all simultaneous offers + glare
resolution". Rejected: doubles SDP traffic and exercises the glare path on
every pair.

### Authoritative initiator + roster

Every group-call inner event carries an explicit `['initiator', <hex>]` tag
naming the initiator and (on kind 25050) a `['participants', ...]` tag
listing the full roster. The **first** kind-25050 received locally for a
given `group-call-id` establishes the authoritative
`(group-call-id, initiator, roster, conversation-id)` quadruple. Any later
inner event whose tags disagree with this cached quadruple is dropped.

This kills two failure modes:

1. Race condition where an accepter's mesh-formation offer arrives before
   the initiator's offer — they would have agreed on `group-call-id` but
   disagreement on `initiator` would still flag the race.
2. Roster forgery by a real member (lying about who else is in the call).

**Alternative considered.** Derive initiator from "first received". Rejected:
brittle under reordering and harder to specify.

### Closed roster

Late join is not supported. Late accepters within the per-edge 60s offer
timeout window can still join; after that window, the per-pair offer
expires and the would-be participant is `'missed'` from their side and
`'no-answer'` from any peer that offered to them.

**Rationale.** Late-join requires either a new "join request" inner kind
(more wire surface) or active members maintaining "who's currently in the
call" state (more spec surface). Both are deferrable.

### Cap of 4

Hard cap of 4 total participants — enforced at the initiation UI (button
greyed if local roster size > 4) and at every receive site (drop kind-25050
whose `participants` tag has more than 4 entries).

**Rationale.** 4 means each device has 3 simultaneous PCs. Mid-range Android
mobiles handle 3 inbound audio decoders comfortably; 5+ approaches thermal
limits and bandwidth saturation on weak networks. Matches the choice made by
comparable mesh-based group call apps.

### Voice-only in v1

Inner kind 25050 with `group-call-id` and `['call-type', 'video']` is
rejected by the receiver (drop silently). The chat-header video-call button
is hidden for group conversations. The 1-on-1 video-call button (from the
in-flight `add-video-calling` change) is unaffected.

**Rationale.** 3 simultaneous video decoders + 1 encoder + camera capture is
a substantially different cost class than voice. UI design (multi-tile grid,
PiP self-view, per-tile mute indicators) is also non-trivial. Defer to a
follow-up change once mesh voice is proven.

### Concurrency: one call total

The existing "one active call" invariant is preserved with one wrinkle:
**multiple inbound 25050s carrying the same `group-call-id` as the current
call are not concurrent**, they are mesh-formation. Specifically:

- While in a group call with `group-call-id=X`, any inbound 25050 with
  `group-call-id=X` is processed as mesh formation (Section "Recipient
  flow").
- Any inbound 25050 with `group-call-id=Y ≠ X` (or no `group-call-id`) is
  auto-rejected with `busy`.
- While in a 1-on-1 call, any inbound 25050 with a `group-call-id` is
  auto-rejected with `busy`.

### Group follow-gate

For inbound kind 25050 with `group-call-id`, the receiver requires:

1. Local DB has a `Conversation` with `id === conversation-id` tag value,
   `isGroup === true`, and the local user in its `participants`.
2. The sender's pubkey is in that local conversation's `participants`.
3. The wire `participants` tag's set equals the local conversation's
   `participants` set.
4. `participants` tag size ≤ 4.
5. Inner Schnorr signature verifies (existing rule, unchanged).

If all hold, the offer rings (or, for non-initiator inbound mesh-formation
offers during an existing accepted group call, drives mesh formation). If
any fails, drop silently.

**The 1-on-1 NIP-02 contact-list gate is bypassed for group offers.** The
user has implicitly opted in by being a member of the local group
conversation.

For inner kinds 25051/25052/25053/25054 with `group-call-id`, the receiver
verifies the `group-call-id` matches an active local per-call session and
the sender is in the cached roster — no full follow-gate re-check.

### Leave = leave

Tapping hangup sends one kind-25053 per still-active edge (per-pair `call-id`,
plus `group-call-id`, `conversation-id`, `initiator` tags) and tears down
those PCs. Remaining participants stay connected to each other. Aggregate
per-call status transitions to `ended` only on the leaving device. The call
ends for everyone naturally when only one participant is left
(last-one-standing → `ended` with reason `hangup`).

**Alternative considered.** Initiator can "End for everyone". Rejected: adds
a host concept that doesn't exist elsewhere in nospeak; YAGNI for v1.

### Ringback terminates on first peer connect

Initiator's ringback stops the moment any one peer's `pcStatus` reaches
`active`. Other still-pending edges continue connecting in the background
and surface in the active-call UI as "Connecting…" rows.

### Native parity on Android

`NativeVoiceCallManager` becomes multi-PC: a `Map<String, PeerSession>`
keyed by peer pubkey. `IncomingCallActivity` and `ActiveCallActivity` are
rebuilt to render rosters. The FGS holds one wake lock and one audio-mode
override regardless of how many peers. Same lockscreen ring, same FSI
behavior, same PIN-locked-nsec accept flow.

**Alternative considered.** Web-only in v1; ship Android in a follow-up.
Rejected by user during brainstorming: parity is a v1 requirement.

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| 3 simultaneous PCs thermal/battery cost on mid-range Android | Hard cap of 4 (3 PCs); document expected battery cost; voice-only keeps decoder count manageable. |
| Mesh formation chatty under bad networks (N-1 ICE exchanges) | Existing per-edge ICE buffering and 5-second publish deadline already in place; ICE candidates fire-and-forget per-edge. |
| Race conditions during simultaneous accept | Deterministic-pair offerer rule eliminates offer-glare; per-pair `call-id` keeps edges independent. |
| Roster forgery by a real member | Authoritative `initiator` + `participants` quadruple (cached on first kind-25050) plus exact set-equality check against local DB membership. |
| Older nospeak clients see unfamiliar tags | Older clients fall through to 1-on-1 dispatch. They cannot participate in mesh formation but won't crash; the rest of the mesh is unaffected. Documented as informal-breaking in the proposal. |
| Multi-device dismissal needs to key on `group-call-id` not `call-id` | Spec change: self-event filter uses `group-call-id` when present, falls back to per-pair `call-id` for 1-on-1 (existing behavior). |
| Java multi-PC refactor regresses 1-on-1 | 1-on-1 path stays as the default code path; group code branches on `group-call-id` presence. Existing Java unit tests (busy-reject, self-dismiss, ICE buffer) remain green; new tests added for group cases. |
| Group call history dedup with multi-device authoring | Existing message dedup keys on event id; same-author Kind 1405 with same `group-call-id` from two devices is naturally deduped because they share the rumor id (deterministic content + tags + ts). Tested in `MessageRepository.test.ts` extension. |

## Migration Plan

No data migration. The `Conversation` table and existing call-history Kind 1405
schema are unchanged. Pre-existing 1-on-1 calls are unaffected.

The `nospeak_pending_incoming_call` SharedPreferences slot on Android gains
optional fields (`groupCallId`, `conversationId`, `initiatorHex`, `rosterJson`,
`pendingOffersJson`). Old-shape entries without `groupCallId` continue to be
treated as 1-on-1 calls. A pre-existing rule already says "Old-shape entries
from prior versions (lacking the new keys) SHALL be ignored on first read
after upgrade" — that rule applies here too.

## Open Questions

None at design time. All branch points were resolved during brainstorming.
