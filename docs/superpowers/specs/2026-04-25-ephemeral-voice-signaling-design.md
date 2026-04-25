# Design: Ephemeral Voice-Call Signaling

**Status:** Draft
**Date:** 2026-04-25
**Branch:** voice-calling
**Related:** `docs/superpowers/plans/2026-03-28-voice-calling.md` (original implementation plan)

## Problem

The current voice-call signaling layer publishes WebRTC offer/answer/ICE messages
as NIP-17 gift wraps (kind 1059) carrying a kind 14 rumor with a
`['type', 'voice-call']` discriminator tag. Encryption and metadata privacy are
solid, but the signal events have no expiration. Cooperating relays can store
them indefinitely alongside regular text DMs, even though they are useless after
the call attempt window closes.

Two concrete consequences:

1. **Storage waste on relays.** A noisy ICE-trickle session can produce dozens
   of gift wraps per call; persisting them serves no purpose.
2. **Replay surface on reconnect.** A recipient that reconnects after being
   offline could receive stale signals from old call attempts. The current
   `VoiceCallService` would either treat a stale `offer` as a fresh incoming
   call (causing a phantom ring) or reject it via the `idle`-check + `busy`
   reply, which is itself wasteful chatter.

The codebase already has a precedent for "ephemeral-via-conventions": **read
receipts** (`Messaging.ts:1766` `sendReadReceipt`) use the same gift-wrap
transport with a NIP-40 `expiration` tag and `skipDbSave: true` /
`skipSelfWrap: true`. Voice signals already use `skipDbSave` / `skipSelfWrap`
behavior (they bypass `sendEnvelope` for performance) but do not set
`expiration`.

## Goal

Mark voice-call signaling events as ephemeral via a NIP-40 `expiration` tag
applied to the gift wrap, the seal, and the inner rumor, so cooperating relays
drop them shortly after the call window closes. Add a defense-in-depth
receive-side check that silently drops any rumor whose `expiration` is in the
past, so non-cooperating relays cannot cause stale-signal replay.

## Non-goals

- No change to the subscription filter `{kinds:[1059], '#p':[me]}`.
- No change to NIP-44 encryption, gift-wrap structure, or seal structure
  beyond adding the `expiration` tag.
- No change to NIP-17 sender-impersonation checks
  (`seal.pubkey === rumor.pubkey`).
- No change to `VoiceCallService` — expiration is purely a Messaging-layer
  concern.
- No change to relay caching, connected-relays-only publishing, or
  fire-and-forget ICE behavior.
- No introduction of true Nostr ephemeral kinds (20000-29999). Inner rumor kind
  stays at 14 to remain compatible with other NIP-17 clients.

## Approach

Mirror the read-receipt pattern. Add a 60-second NIP-40 `expiration` tag to
voice-call signal events at three layers:

1. **Inner rumor (kind 14)** — so the expiration survives if the rumor is ever
   leaked or replayed by a misbehaving party.
2. **Seal (kind 13)** — recommended by NIP-17 ("This tag SHOULD be included on
   the kind 13 seal as well, in case it leaks").
3. **Outer gift wrap (kind 1059)** — what cooperating relays actually see and
   act on without decryption.

On the receive side, after decrypting the rumor and before any kind-specific
routing, check the rumor's `expiration` tag. If it is in the past, drop the
rumor silently (debug-log only). This protects against relays that ignore
NIP-40 and against signals that arrive after a long offline period.

The expiration window is **60 seconds**, matching `CALL_OFFER_TIMEOUT_MS`
(`src/lib/core/voiceCall/constants.ts`). Past 60 seconds the call attempt has
timed out anyway, so any lingering signal is by definition useless.

## Architecture

The change is contained entirely within `src/lib/core/Messaging.ts` and
`src/lib/core/voiceCall/constants.ts`. No new modules. No changes to the
`VoiceCallService` API surface. No changes to the wire format other than
adding the `expiration` tag.

```
                                     +-------------------+
                                     | VoiceCallService  |  unchanged
                                     +---------+---------+
                                               |
                                               v
                       +-----------------------+-----------------------+
                       | Messaging.sendVoiceCallSignal                  |
                       |   - compute expiresAt = now + 60               |
                       |   - rumor.tags += ['expiration', expiresAt]    |
                       |   - createGiftWrap(rumor, pk, signer, expiresAt)|
                       +-----------------------+-----------------------+
                                               |
                                               v
                       +-----------------------+-----------------------+
                       | Messaging.createGiftWrap                       |
                       |   - seal.tags  += ['expiration', expiresAt]    |  NEW
                       |   - wrap.tags  += ['expiration', expiresAt]    |  already present
                       +-----------------------+-----------------------+

  Receive side:
                       +-----------------------+-----------------------+
                       | Messaging.handleGiftWrap                       |
                       |   - decrypt rumor                              |
                       |   - if rumor.expiration < now: drop, return    |  NEW
                       |   - existing routing                           |
                       +------------------------------------------------+
                       (same drop applied in processGiftWrapToMessage)
```

## Components and data flow

### New constant

`src/lib/core/voiceCall/constants.ts`

```ts
export const CALL_SIGNAL_EXPIRATION_SECONDS = 60;
```

Sized to match `CALL_OFFER_TIMEOUT_MS = 60_000`. Co-located with other
voice-call constants for discoverability.

### `sendVoiceCallSignal` changes (`Messaging.ts:1875`)

Compute `expiresAt`, attach to the rumor, and pass to `createGiftWrap`:

```ts
const nowSec   = Math.floor(Date.now() / 1000);
const expiresAt = nowSec + CALL_SIGNAL_EXPIRATION_SECONDS;

const rumor: Partial<NostrEvent> = {
    kind: 14,
    created_at: nowSec,
    content: signalContent,
    tags: [
        ['p', recipientPubkey, recipientRelays[0]],
        ['type', 'voice-call'],
        ['expiration', String(expiresAt)]
    ],
    pubkey
};
// ...
const giftWrap = await this.createGiftWrap(rumor, recipientPubkey, s, expiresAt);
```

### `createGiftWrap` audit-fix (`Messaging.ts:1929`)

Current state: `createGiftWrap` already adds `['expiration', ...]` to the
gift-wrap tags when `expiresAt` is provided (line 1983-1985), but does **not**
add it to the seal. NIP-17 explicitly recommends it on the seal as well.

Fix: when `expiresAt` is provided, initialize `seal.tags` with the expiration
tag:

```ts
const sealTags: string[][] = [];
if (expiresAt !== undefined) {
    sealTags.push(['expiration', String(expiresAt)]);
}
const seal: Partial<NostrEvent> = {
    kind: 13,
    pubkey: sealPubkey,
    created_at: ...,
    content: encryptedRumor,
    tags: sealTags
};
```

This audit-fix benefits read receipts too (they already pass `expiresAt`
through `sendEnvelope`).

### Receive-side expiration drop

Two near-identical paths receive gift wraps and need the same check:

- `handleGiftWrap` (`Messaging.ts:163`) — live subscription path.
- `processGiftWrapToMessage` (`Messaging.ts:278`) — Android native-queue path.

After decrypting the rumor and verifying seal/rumor pubkey match (the existing
NIP-17 anti-impersonation gate), and after the existing my-pubkey-in-p-tags
check, but **before** any kind-specific routing — i.e. before the kind-7
reaction branch (`Messaging.ts:249`), the voice-call branch
(`Messaging.ts:255`), and the fall-through `processRumor` call
(`Messaging.ts:270`) — insert:

```ts
const expirationTag = rumor.tags?.find(
    (t: string[]) => t[0] === 'expiration'
);
if (expirationTag) {
    const expiresAt = parseInt(expirationTag[1], 10);
    if (!Number.isNaN(expiresAt) && expiresAt < Math.floor(Date.now() / 1000)) {
        if (this.debug) {
            console.log(
                '[NIP-40] Dropping expired rumor',
                { kind: rumor.kind, expiresAt }
            );
        }
        return;
    }
}
```

Generic by design — any rumor with a past-due `expiration` tag is dropped.
This catches future expiration use cases (read receipts already use it; any
new ephemeral types get the behavior for free).

## Wire format

A voice-call signal gift wrap after this change:

```jsonc
// Outer gift wrap (kind 1059) — visible to relays
{
  "kind": 1059,
  "pubkey": "<ephemeral>",
  "created_at": <random past 2 days>,
  "tags": [
    ["p", "<recipient>"],
    ["expiration", "<now + 60>"]    // NEW for voice signals (already present for read receipts)
  ],
  "content": "<nip44(seal)>",
  "sig": "<ephemeral sig>"
}

// Seal (kind 13) — visible only to the recipient after first decrypt
{
  "kind": 13,
  "pubkey": "<sender>",
  "created_at": <random past 2 days>,
  "tags": [
    ["expiration", "<now + 60>"]    // NEW
  ],
  "content": "<nip44(rumor)>",
  "sig": "<sender sig>"
}

// Rumor (kind 14) — visible only to the recipient after second decrypt
{
  "kind": 14,
  "pubkey": "<sender>",
  "created_at": <now>,
  "tags": [
    ["p", "<recipient>", "<relay-hint>"],
    ["type", "voice-call"],
    ["expiration", "<now + 60>"]    // NEW
  ],
  "content": "<json voice-call signal>",
  "id": "<hash>"
}
```

## Error handling

- **Cooperating relay drops the gift wrap before delivery:** the recipient
  never sees the signal. WebRTC degrades gracefully — `VoiceCallService`'s
  60-second offer timeout (or 30-second ICE timeout) fires and the call is
  marked `timeout`. This is the same behavior as the recipient being offline.
- **Non-cooperating relay stores the gift wrap forever:** delivered late, the
  receive-side expiration check drops it silently. No phantom ring, no busy
  reply, no DB entry.
- **Recipient clock is fast:** if the recipient's wall clock is more than 60s
  ahead of the sender's, fresh signals will be dropped at receive. This is the
  primary clock-skew risk. Mitigation: 60s is sufficient for normal NTP-synced
  clocks; if field reports show drops, the constant can be bumped.
- **Sender clock is fast:** the relay sees an `expiration` in the future
  (relative to its own clock), so it stores normally. No additional risk
  beyond status quo.
- **Malformed expiration tag** (non-numeric value): `Number.isNaN(expiresAt)`
  short-circuits the drop. The rumor proceeds to normal processing. This
  matches "tags you don't understand SHOULD be ignored" Nostr conventions.

## Testing strategy

Unit tests in vitest, following project conventions (4-space indent, `vi.mock`
for dependencies, no `@testing-library/svelte`).

### Send-side tests (`src/lib/core/Messaging.test.ts` or new file)

1. `sendVoiceCallSignal` adds `['expiration', String(now + 60)]` to the rumor
   tags.
2. `sendVoiceCallSignal` calls `createGiftWrap` with `expiresAt` set to
   `now + 60`.
3. `createGiftWrap(rumor, pk, signer, expiresAt)` produces a seal whose
   `tags` array contains `['expiration', String(expiresAt)]`.
4. `createGiftWrap(rumor, pk, signer, expiresAt)` produces a gift wrap whose
   `tags` array contains `['expiration', String(expiresAt)]`.
5. `createGiftWrap(rumor, pk, signer)` (no `expiresAt`) produces a seal and
   gift wrap with no `expiration` tag (back-compat for normal text DMs).

### Receive-side tests

6. `handleGiftWrap` silently drops a decrypted rumor whose `expiration` tag is
   in the past. Verified by:
   - No call to `voiceCallService.handleSignal`.
   - No call to `processRumor`.
   - No write to `messageRepo`.
7. `handleGiftWrap` dispatches a rumor whose `expiration` tag is in the future
   (60s from now).
8. `handleGiftWrap` dispatches a rumor with no `expiration` tag (regression
   guard for normal text DMs).
9. `handleGiftWrap` dispatches a rumor whose `expiration` tag value is
   non-numeric (defensive — must not throw, must not drop).
10. **Regression**: `handleGiftWrap` dispatches a kind 7 read-receipt rumor
    with a 7-day-future `expiration` (i.e. the existing read-receipt flow is
    unaffected).
11. Same six scenarios (#6–#10 minus #5) for `processGiftWrapToMessage`.

### Manual smoke test

12. Two-tab call between two npubs:
    - Initiate call from A to B, B accepts, talk briefly, A hangs up. Confirm
      ringing, connection, and ended-event message all work.
    - Initiate call from A to B, B declines. Confirm `rejected` end reason.
    - Initiate call from A to B, B never picks up. Confirm `timeout` end
      reason at 60s.
13. (Optional) Capture relay traffic with a tool like `nak` or browser
    websocket inspector and confirm voice-signal gift wraps carry
    `["expiration","<unix>"]` tags.

## Risks and trade-offs

- **NIP-40 is advisory.** Many relays do not honor it. The receive-side
  check is the load-bearing safety net.
- **60s window is tight.** A round-trip through a slow relay plus the
  `publishWithDeadline` 5s timeout could leave only a few seconds of slack on
  the recipient side. Acceptable because: (a) ICE candidates are continuously
  re-emitted, so individual misses are recoverable; (b) the call already
  fails at 60s anyway via `CALL_OFFER_TIMEOUT_MS`.
- **Generic receive-side drop touches the read-receipt path.** Read receipts
  carry a 7-day expiration so they are unaffected in practice, but a bug in
  the drop logic could silently break read receipts. Mitigated by regression
  test #10.
- **Rumor `expiration` tag inside an encrypted seal is invisible to relays.**
  The relay-side benefit comes entirely from the wrap-level tag. The seal-
  and rumor-level tags exist for defense if the gift wrap is ever leaked
  decrypted. Worth the few extra bytes.
- **No change to `created_at` randomization.** NIP-17 randomizes `created_at`
  up to 2 days in the past on both seal and gift wrap to obscure timing. The
  `expiration` tag is an absolute future timestamp and does not interact with
  this — it expresses "drop after this wall-clock time" regardless of when
  the relay first saw the event.

## Out of scope

- Rate limiting on signal sending.
- Replay-attack defense beyond expiration (a captured-and-replayed signal
  within the 60s window will still be processed; this is not a regression
  from the current state).
- Migrating other ephemeral-style messages (read receipts already have
  expiration; nothing else is currently ephemeral).
- True Nostr ephemeral kinds (20000-29999) for either rumor or wrap.

## OpenSpec capability

A new `voice-calling` capability spec will be backfilled at
`openspec/specs/voice-calling/spec.md` covering the existing voice-calling
behavior plus this delta. (No OpenSpec change proposal under
`openspec/changes/` per user direction — Superpowers workflow tracks the
in-flight work; OpenSpec captures the end state.)
