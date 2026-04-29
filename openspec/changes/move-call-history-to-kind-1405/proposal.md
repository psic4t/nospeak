# Change: Move call-history rumors from Kind 16 to Kind 1405

## Why
Kind 16 is officially **NIP-18 "Generic Repost"** in the Nostr ecosystem. We
have been using it for NIP-17 sealed call-history rumors (`ended`, `missed`,
`declined`, `no-answer`, `busy`, `failed`, `cancelled`), which has nothing to
do with reposts. Even though these rumors are sealed inside `kind:1059` gift
wraps and never appear publicly as Kind 16 events, the kind number is still
a public protocol identifier — squatting on a defined kind for unrelated
semantics is a protocol-citizenship bug and creates ambiguity for any
future client or spec reader looking at our schema.

We also can't use NIP-17's reserved kinds (14 chat, 15 file, 7 reaction)
because call-history rows must remain disjoint from chat content for
storage, rendering, unread-count, and notification purposes.

The replacement kind needs to be:
1. Unassigned by any published NIP.
2. In the **regular range** (1000–9999) — same class as NIP-17's kinds 14
   and 15, because call-history rumors are persistent client-side (saved
   to local DB, rendered indefinitely in the conversation timeline). The
   ephemeral range (20000–29999) is wrong because its public meaning is
   "not stored" — the opposite of what these rumors do on the client.
3. Free of nearby semantic confusion (e.g. NIP-A0 voice messages occupy
   1222 and 1244, which are unrelated to voice calling but adjacent enough
   that reusing those numbers would mislead readers).

**Selected kind: 1405.** Adjacent to NIP-17's kinds 14/15, the "14" prefix
flags the family relationship; "05" is a memorable suffix. Currently
unassigned per the NIPs index.

## What Changes

### Wire change (BREAKING for cross-version peers)
- The inner rumor `kind` for all call-history events changes from `16` to
  `1405`.
- The receive path (`Messaging.processGiftWrap` and the native queue
  variant) is **hard-switched**: it accepts `1405` and rejects `16`.
- This is intentionally a hard break. During the rollout window, calls
  between an upgraded peer and a non-upgraded peer will produce no
  call-history pill on the non-upgraded side. Acceptable because
  call-history is advisory (the call itself works either way), and a
  permanent dual-read path leaves dead code forever.

### Local DB migration (one-time)
- A new Dexie schema version adds an `.upgrade()` step that rewrites
  every `messages` row whose `rumorKind === 16` AND whose `callEventType`
  is set to `rumorKind: 1405`. Rows without `callEventType` are left
  alone (defensive — no kind-16 rows of other types should exist, but if
  they do we don't corrupt them).
- The migration is idempotent: re-running finds no kind-16 rows after the
  first pass.

### Single source of truth for the kind
- A new constant `CALL_HISTORY_KIND = 1405` is exported from a TypeScript
  module and mirrored as `CALL_HISTORY_KIND = 1405` in Java.
- All literal `16` references in call-history paths reference the
  constant.

### Native Android update
- `NativeBackgroundMessagingService.sendVoiceCallDeclinedEvent` writes
  `rumor.put("kind", 1405)`.
- All comments and JSDoc that name "Kind 16" are updated to "Kind 1405".

## Impact
- **Affected specs:** `voice-calling` — the "Call History via Kind 16
  Events" requirement is renamed and rewritten to reference kind 1405.
- **Affected code:**
  - `src/lib/core/Messaging.ts` — receive path, `createCallEventMessage`,
    `createLocalCallEventMessage`
  - `src/lib/core/voiceCall/kinds.ts` — new constant module (created)
  - `src/lib/db/db.ts` — new schema version with the upgrade migration;
    update doc-comment
  - `src/lib/components/ChatView.svelte` — renderer branch condition
  - `android/app/.../NativeBackgroundMessagingService.java` — kind
    literal and comments
  - `android/app/.../IncomingCallActionReceiver.java` — comment
  - `src/lib/core/voiceCall/VoiceCallService.test.ts` — adjust any
    fixtures asserting the old kind (most fixtures route through
    `Messaging` so the constant flows through automatically)
  - New test: DB migration test seeded with kind-16 rows
  - New test: receive-path test asserting kind 16 is rejected and 1405 is
    accepted
- **Backwards compatibility:** local DB rows are migrated automatically.
  Wire-level interop with non-upgraded peers loses call-history pills
  during the rollout window only; the calls themselves are unaffected
  because live signaling continues to use kind 14 (unchanged).
