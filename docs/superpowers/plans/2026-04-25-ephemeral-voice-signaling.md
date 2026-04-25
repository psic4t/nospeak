# Ephemeral Voice-Call Signaling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mark voice-call signaling messages as ephemeral via NIP-40 expiration tags so cooperating relays drop them after 60 seconds, and silently drop expired rumors on receive.

**Architecture:** Add a 60-second `expiration` tag to the voice-signal rumor (Kind 14), the seal (Kind 13), and the gift wrap (Kind 1059). Add a generic receive-side expiration check in both `handleGiftWrap` and `processGiftWrapToMessage` that drops any rumor whose expiration is in the past. No changes to `VoiceCallService` or the subscription filter.

**Tech Stack:** TypeScript (strict mode), Svelte 5, vitest, nostr-tools, NIP-17/NIP-40/NIP-59.

**Spec:** `openspec/specs/voice-calling/spec.md` — Requirement "Ephemeral Signaling via NIP-40"
**Design:** `docs/superpowers/specs/2026-04-25-ephemeral-voice-signaling-design.md`

---

## File Map

| File | Change |
|---|---|
| `src/lib/core/voiceCall/constants.ts` | Add `CALL_SIGNAL_EXPIRATION_SECONDS = 60` |
| `src/lib/core/Messaging.ts` (`sendVoiceCallSignal`, ~L1875) | Compute `expiresAt`, add `expiration` to rumor tags, pass `expiresAt` to `createGiftWrap` |
| `src/lib/core/Messaging.ts` (`createGiftWrap`, ~L1929) | Add `expiration` to the seal tags when `expiresAt` is provided |
| `src/lib/core/Messaging.ts` (`handleGiftWrap`, ~L228) | Add generic expiration drop after pubkey-match check, before kind-specific routing |
| `src/lib/core/Messaging.ts` (`processGiftWrapToMessage`, ~L320) | Mirror the same expiration drop |
| `src/lib/core/MessagingService.test.ts` | Add tests for send-side and receive-side behavior |

---

## Conventions

- 4-space indentation (per `AGENTS.md`).
- TypeScript strict mode; explicit interfaces.
- `try/catch` for async.
- `vi.mock` for dependencies in tests.
- Run `npm run check` and `npx vitest run` before declaring a task done.
- Conventional Commits with scope, e.g. `feat(voice-call): ...`.

---

## Task 1: Add the expiration constant

**Files:**
- Modify: `src/lib/core/voiceCall/constants.ts`
- Test: (constants are not unit-tested directly; consumed in Task 2)

- [ ] **Step 1: Edit `src/lib/core/voiceCall/constants.ts`**

Append a new constant immediately after `CALL_END_DISPLAY_MS` (line 4):

```ts
export const CALL_OFFER_TIMEOUT_MS = 60_000;
export const ICE_CONNECTION_TIMEOUT_MS = 30_000;
export const CALL_SIGNAL_TYPE = 'voice-call' as const;
export const CALL_END_DISPLAY_MS = 2_000;
/**
 * NIP-40 expiration window for voice-call signaling gift wraps.
 * Sized to match CALL_OFFER_TIMEOUT_MS — past 60s the call attempt has
 * timed out anyway, so any lingering signal is useless. Cooperating relays
 * SHOULD drop expired events; receivers also drop them defensively.
 */
export const CALL_SIGNAL_EXPIRATION_SECONDS = 60;
export const AUDIO_CONSTRAINTS: MediaStreamConstraints = {
    audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
    },
    video: false
};
```

- [ ] **Step 2: Run typecheck to verify**

Run: `npm run check`
Expected: PASS (no errors).

- [ ] **Step 3: Commit**

```bash
git add src/lib/core/voiceCall/constants.ts
git commit -m "feat(voice-call): add CALL_SIGNAL_EXPIRATION_SECONDS constant (60s)"
```

---

## Task 2: Test that `sendVoiceCallSignal` adds expiration tag to rumor

**Files:**
- Modify: `src/lib/core/MessagingService.test.ts` (add new `describe` block at end of file)
- Read: `src/lib/core/Messaging.ts:1875-1927` (current `sendVoiceCallSignal`)

This is the RED phase of TDD — the test will fail because we haven't modified the implementation yet.

- [ ] **Step 1: Add the test block at the end of `src/lib/core/MessagingService.test.ts`** (before the closing `});` of the file's outer block, or as a new top-level `describe` if there is no outer block).

Inspect the file to see the existing structure: top-level `describe('MessagingService', ...)` likely wraps everything. Add the new describe block as a sibling to the existing `describe('NIP-17 seal signature verification ...')` block.

```ts
describe('voice-call signal expiration (NIP-40 send-side)', () => {
    let messaging: MessagingService;
    let mockSigner: any;
    const myPubkey = '79dff8f426826fdd7c32deb1d9e1f9c01234567890abcdef1234567890abcdef';
    const recipientNpub = 'npub1recipient';

    beforeEach(() => {
        vi.clearAllMocks();
        messaging = new MessagingService();

        mockSigner = {
            getPublicKey: vi.fn().mockResolvedValue(myPubkey),
            encrypt: vi.fn().mockResolvedValue('A'.repeat(200)),
            signEvent: vi.fn().mockImplementation(async (e: any) => ({
                ...e,
                id: 'sealid',
                sig: 'sealsig',
            })),
            decrypt: vi.fn(),
        };

        vi.mocked(get).mockReturnValue(mockSigner);

        // Stub relay lookup — bypass profile resolver / discovery.
        vi.spyOn(messaging as any, 'getVoiceCallRelays')
            .mockResolvedValue(['wss://relay.example']);

        // Stub connection health so all relays are treated "connected".
        vi.spyOn(connectionManager, 'getRelayHealth').mockReturnValue({
            relay: {} as any,
            isConnected: true,
        } as any);
    });

    it('adds expiration tag to the inner rumor with value now + 60', async () => {
        const captured: any[] = [];
        vi.spyOn(messaging as any, 'createGiftWrap')
            .mockImplementation(async (rumor: any, _pk: any, _s: any, expiresAt?: any) => {
                captured.push({ rumor, expiresAt });
                return { id: 'wrapid', kind: 1059, sig: 'sig', tags: [], content: '' };
            });

        // publishWithDeadline is mocked at the top of this file.
        const before = Math.floor(Date.now() / 1000);
        await messaging.sendVoiceCallSignal(recipientNpub, '{"type":"voice-call","action":"offer","callId":"x"}');
        const after = Math.floor(Date.now() / 1000);

        expect(captured.length).toBe(1);
        const expirationTag = captured[0].rumor.tags.find((t: string[]) => t[0] === 'expiration');
        expect(expirationTag).toBeDefined();
        const expVal = parseInt(expirationTag[1], 10);
        expect(expVal).toBeGreaterThanOrEqual(before + 60);
        expect(expVal).toBeLessThanOrEqual(after + 60);
    });

    it('passes expiresAt to createGiftWrap matching the rumor expiration', async () => {
        const captured: any[] = [];
        vi.spyOn(messaging as any, 'createGiftWrap')
            .mockImplementation(async (rumor: any, _pk: any, _s: any, expiresAt?: any) => {
                captured.push({ rumor, expiresAt });
                return { id: 'wrapid', kind: 1059, sig: 'sig', tags: [], content: '' };
            });

        await messaging.sendVoiceCallSignal(recipientNpub, '{"type":"voice-call","action":"offer","callId":"x"}');

        expect(captured[0].expiresAt).toBeDefined();
        const tagVal = parseInt(
            captured[0].rumor.tags.find((t: string[]) => t[0] === 'expiration')[1],
            10
        );
        expect(captured[0].expiresAt).toBe(tagVal);
    });
});
```

- [ ] **Step 2: Run the new tests and verify they FAIL**

Run: `npx vitest run src/lib/core/MessagingService.test.ts -t "voice-call signal expiration"`
Expected: 2 tests fail. Failure mode: the rumor has no `expiration` tag, OR `createGiftWrap` is called without an `expiresAt` argument.

- [ ] **Step 3: Commit (failing test)**

```bash
git add src/lib/core/MessagingService.test.ts
git commit -m "test(voice-call): assert expiration tag on outgoing voice signal rumor (RED)"
```

---

## Task 3: Wire `expiresAt` into `sendVoiceCallSignal` (GREEN for Task 2)

**Files:**
- Modify: `src/lib/core/Messaging.ts` (function `sendVoiceCallSignal`, currently line ~1875-1927)

- [ ] **Step 1: Add the import** at the top of `Messaging.ts` (find the existing `voiceCall/constants` import or add a new line near the other `$lib/core/voiceCall/*` imports).

If the file doesn't already import from `voiceCall/constants`, add:

```ts
import { CALL_SIGNAL_EXPIRATION_SECONDS } from '$lib/core/voiceCall/constants';
```

If it already imports something else from that module, extend the existing import.

- [ ] **Step 2: Modify `sendVoiceCallSignal`** at `src/lib/core/Messaging.ts:1875`.

Replace the body from `const pubkey = await s.getPublicKey();` through `const giftWrap = await this.createGiftWrap(rumor, recipientPubkey, s);` with:

```ts
const pubkey = await s.getPublicKey();
const senderNpub = nip19.npubEncode(pubkey);
const recipientPubkey = nip19.decode(recipientNpub).data as string;

// Use cached relay lookups for voice signals
const recipientRelays = await this.getVoiceCallRelays(recipientNpub);
if (recipientRelays.length === 0) {
    throw new Error('Contact has no messaging relays configured');
}

const nowSec = Math.floor(Date.now() / 1000);
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

// Compute stable rumor ID
const rumorId = getEventHash(rumor as NostrEvent);
rumor.id = rumorId;

// Publish to already-connected relays only — don't add temporary relays
// for voice signals, as that triggers subscription replay and message floods.
const connectedRelays = recipientRelays.filter(url => {
    const health = connectionManager.getRelayHealth(url);
    return health?.isConnected && health.relay;
});

if (connectedRelays.length === 0) {
    console.warn('[VoiceCall] No connected relays for recipient, signal may not be delivered');
}

const publishRelays = connectedRelays.length > 0 ? connectedRelays : recipientRelays;

// NIP-40: gift wrap, seal, and rumor all carry the expiration so cooperating
// relays drop the gift wrap and any leaked seal/rumor are also marked expired.
const giftWrap = await this.createGiftWrap(rumor, recipientPubkey, s, expiresAt);
await publishWithDeadline({
    connectionManager,
    event: giftWrap,
    relayUrls: publishRelays,
    deadlineMs: 5000,
});
```

The only deltas are: (a) imports of the new constant; (b) computing `nowSec`/`expiresAt`; (c) reusing `nowSec` in `created_at`; (d) adding the `expiration` tag to the rumor; (e) passing `expiresAt` as the 4th argument to `createGiftWrap`.

- [ ] **Step 3: Run the Task 2 tests and verify they PASS**

Run: `npx vitest run src/lib/core/MessagingService.test.ts -t "voice-call signal expiration"`
Expected: 2 tests pass.

- [ ] **Step 4: Run typecheck**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/core/Messaging.ts
git commit -m "feat(voice-call): add NIP-40 expiration tag to voice signal rumors"
```

---

## Task 4: Test that `createGiftWrap` adds expiration to seal AND wrap when expiresAt provided

**Files:**
- Modify: `src/lib/core/MessagingService.test.ts` (extend the new describe block from Task 2 or add a new one)

This is RED — the seal-level expiration tag does not exist yet (audit found that only the wrap currently gets it).

- [ ] **Step 1: Add a new describe block** after the one from Task 2:

```ts
describe('createGiftWrap expiration propagation (NIP-17 SHOULD)', () => {
    let messaging: MessagingService;
    let mockSigner: any;
    const senderPubkey = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const recipientPubkey = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

    beforeEach(() => {
        vi.clearAllMocks();
        messaging = new MessagingService();

        mockSigner = {
            getPublicKey: vi.fn().mockResolvedValue(senderPubkey),
            encrypt: vi.fn().mockResolvedValue('A'.repeat(200)),
            // Echo back the seal as the "signed seal" so we can inspect tags.
            signEvent: vi.fn().mockImplementation(async (e: any) => ({
                ...e,
                id: 'sealid',
                sig: 'sealsig',
            })),
            decrypt: vi.fn(),
        };

        vi.mocked(get).mockReturnValue(mockSigner);
    });

    it('adds expiration tag to BOTH seal and gift wrap when expiresAt is provided', async () => {
        const expiresAt = 9999999999;
        const rumor = {
            kind: 14,
            pubkey: senderPubkey,
            created_at: 1700000000,
            content: 'x',
            tags: [['p', recipientPubkey]],
        };

        const wrap = await (messaging as any).createGiftWrap(rumor, recipientPubkey, mockSigner, expiresAt);

        // Outer wrap tag check
        const wrapExp = wrap.tags.find((t: string[]) => t[0] === 'expiration');
        expect(wrapExp).toBeDefined();
        expect(wrapExp[1]).toBe(String(expiresAt));

        // Seal tag check — the mocked signEvent received the seal partial.
        const sealCalls = mockSigner.signEvent.mock.calls;
        expect(sealCalls.length).toBe(1);
        const sealPartial = sealCalls[0][0];
        const sealExp = sealPartial.tags.find((t: string[]) => t[0] === 'expiration');
        expect(sealExp).toBeDefined();
        expect(sealExp[1]).toBe(String(expiresAt));
    });

    it('does NOT add expiration tag when expiresAt is undefined', async () => {
        const rumor = {
            kind: 14,
            pubkey: senderPubkey,
            created_at: 1700000000,
            content: 'x',
            tags: [['p', recipientPubkey]],
        };

        const wrap = await (messaging as any).createGiftWrap(rumor, recipientPubkey, mockSigner);

        expect(wrap.tags.find((t: string[]) => t[0] === 'expiration')).toBeUndefined();

        const sealPartial = mockSigner.signEvent.mock.calls[0][0];
        expect(sealPartial.tags.find((t: string[]) => t[0] === 'expiration')).toBeUndefined();
    });
});
```

- [ ] **Step 2: Run the new tests and verify they FAIL**

Run: `npx vitest run src/lib/core/MessagingService.test.ts -t "createGiftWrap expiration"`
Expected: the first test FAILS (seal does not have the expiration tag); the second test PASSES (because no expiration was passed, the absence is the current behavior).

- [ ] **Step 3: Commit (failing test)**

```bash
git add src/lib/core/MessagingService.test.ts
git commit -m "test(voice-call): assert expiration tag on seal in createGiftWrap (RED)"
```

---

## Task 5: Add seal-level expiration in `createGiftWrap` (GREEN for Task 4)

**Files:**
- Modify: `src/lib/core/Messaging.ts:1929-1995` (function `createGiftWrap`)

- [ ] **Step 1: Edit `createGiftWrap`** at `src/lib/core/Messaging.ts:1946-1952`.

Locate the seal construction:

```ts
const sealPubkey = await s.getPublicKey();
const seal: Partial<NostrEvent> = {
    kind: 13,
    pubkey: sealPubkey,
    created_at: Math.floor(Date.now() / 1000) - Math.floor(Math.random() * 172800),
    content: encryptedRumor,
    tags: []
};
```

Replace with:

```ts
const sealPubkey = await s.getPublicKey();
const sealTags: string[][] = [];
if (expiresAt !== undefined) {
    // NIP-17: include expiration on the seal as well, in case the seal leaks.
    sealTags.push(['expiration', String(expiresAt)]);
}
const seal: Partial<NostrEvent> = {
    kind: 13,
    pubkey: sealPubkey,
    created_at: Math.floor(Date.now() / 1000) - Math.floor(Math.random() * 172800),
    content: encryptedRumor,
    tags: sealTags
};
```

- [ ] **Step 2: Run the Task 4 tests and verify they PASS**

Run: `npx vitest run src/lib/core/MessagingService.test.ts -t "createGiftWrap expiration"`
Expected: both tests pass.

- [ ] **Step 3: Run the full Messaging test suite to catch regressions**

Run: `npx vitest run src/lib/core/MessagingService.test.ts`
Expected: all tests pass. Pay attention to any read-receipt tests — they pass `expirationSeconds` through `sendEnvelope` and now their seals will also carry the tag, which should be a benign change.

- [ ] **Step 4: Commit**

```bash
git add src/lib/core/Messaging.ts
git commit -m "feat(messaging): include NIP-40 expiration on seal per NIP-17 SHOULD"
```

---

## Task 6: Test receive-side drop of expired rumors in `handleGiftWrap` (RED)

**Files:**
- Modify: `src/lib/core/MessagingService.test.ts` (new describe block)

- [ ] **Step 1: Add the new describe block**:

```ts
describe('NIP-40 receive-side expiration drop', () => {
    let messaging: MessagingService;
    let mockSigner: any;
    const myPubkey = '79dff8f426826fdd7c32deb1d9e1f9c01234567890abcdef1234567890abcdef';
    const senderPubkey = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

    function makeRumorJson(opts: {
        kind: number;
        tags: string[][];
    }): string {
        return JSON.stringify({
            kind: opts.kind,
            pubkey: senderPubkey,
            content: 'x',
            created_at: 1600000000,
            tags: opts.tags,
        });
    }

    function makeSealJson(): string {
        return JSON.stringify({
            kind: 13,
            pubkey: senderPubkey,
            content: 'A'.repeat(132),
            created_at: 1600000000,
            tags: [],
            sig: 'valid-signature',
        });
    }

    function giftWrap() {
        return {
            id: 'gift-wrap-id',
            kind: 1059,
            pubkey: 'ephemeral-pubkey',
            content: 'encrypted-seal',
            created_at: 1600000000,
            tags: [['p', myPubkey]],
            sig: 'gift-wrap-sig',
        } as any;
    }

    beforeEach(() => {
        vi.clearAllMocks();
        messaging = new MessagingService();
        mockSigner = {
            getPublicKey: vi.fn().mockResolvedValue(myPubkey),
            decrypt: vi.fn(),
            encrypt: vi.fn(),
            signEvent: vi.fn(),
        };
        vi.mocked(get).mockReturnValue(mockSigner);
        mockVerifyEvent.mockReturnValue(true);
    });

    it('handleGiftWrap drops a rumor whose expiration is in the past', async () => {
        const pastExpiration = Math.floor(Date.now() / 1000) - 10;
        mockSigner.decrypt = vi.fn()
            .mockResolvedValueOnce(makeSealJson())
            .mockResolvedValueOnce(makeRumorJson({
                kind: 14,
                tags: [['p', myPubkey], ['type', 'voice-call'], ['expiration', String(pastExpiration)]]
            }));

        const processRumorSpy = vi.spyOn(messaging as any, 'processRumor').mockResolvedValue(undefined);

        await (messaging as any).handleGiftWrap(giftWrap());

        expect(processRumorSpy).not.toHaveBeenCalled();
    });

    it('handleGiftWrap dispatches a rumor whose expiration is in the future', async () => {
        const futureExpiration = Math.floor(Date.now() / 1000) + 60;
        mockSigner.decrypt = vi.fn()
            .mockResolvedValueOnce(makeSealJson())
            .mockResolvedValueOnce(makeRumorJson({
                kind: 14,
                tags: [['p', myPubkey], ['expiration', String(futureExpiration)]]
            }));

        const processRumorSpy = vi.spyOn(messaging as any, 'processRumor').mockResolvedValue(undefined);

        await (messaging as any).handleGiftWrap(giftWrap());

        expect(processRumorSpy).toHaveBeenCalledTimes(1);
    });

    it('handleGiftWrap dispatches a rumor with no expiration tag', async () => {
        mockSigner.decrypt = vi.fn()
            .mockResolvedValueOnce(makeSealJson())
            .mockResolvedValueOnce(makeRumorJson({
                kind: 14,
                tags: [['p', myPubkey]]
            }));

        const processRumorSpy = vi.spyOn(messaging as any, 'processRumor').mockResolvedValue(undefined);

        await (messaging as any).handleGiftWrap(giftWrap());

        expect(processRumorSpy).toHaveBeenCalledTimes(1);
    });

    it('handleGiftWrap dispatches a rumor with non-numeric expiration tag', async () => {
        mockSigner.decrypt = vi.fn()
            .mockResolvedValueOnce(makeSealJson())
            .mockResolvedValueOnce(makeRumorJson({
                kind: 14,
                tags: [['p', myPubkey], ['expiration', 'not-a-number']]
            }));

        const processRumorSpy = vi.spyOn(messaging as any, 'processRumor').mockResolvedValue(undefined);

        await (messaging as any).handleGiftWrap(giftWrap());

        expect(processRumorSpy).toHaveBeenCalledTimes(1);
    });

    it('processGiftWrapToMessage drops a rumor whose expiration is in the past', async () => {
        vi.mocked(get).mockImplementation((store: any) => {
            if (store === signer) return mockSigner;
            if (store === (currentUser as any)) return { npub: 'npub1me' };
            return null;
        });

        const pastExpiration = Math.floor(Date.now() / 1000) - 10;
        mockSigner.decrypt = vi.fn()
            .mockResolvedValueOnce(makeSealJson())
            .mockResolvedValueOnce(makeRumorJson({
                kind: 14,
                tags: [['p', myPubkey], ['expiration', String(pastExpiration)]]
            }));

        const result = await (messaging as any).processGiftWrapToMessage(giftWrap());

        expect(result).toBeNull();
    });

    it('processGiftWrapToMessage processes a rumor whose expiration is in the future', async () => {
        vi.mocked(get).mockImplementation((store: any) => {
            if (store === signer) return mockSigner;
            if (store === (currentUser as any)) return { npub: 'npub1me' };
            return null;
        });

        const futureExpiration = Math.floor(Date.now() / 1000) + 60;
        mockSigner.decrypt = vi.fn()
            .mockResolvedValueOnce(makeSealJson())
            .mockResolvedValueOnce(makeRumorJson({
                kind: 14,
                tags: [['p', myPubkey], ['expiration', String(futureExpiration)]]
            }));

        const result = await (messaging as any).processGiftWrapToMessage(giftWrap());

        // Result is a message-shaped object (not null) when not dropped.
        expect(result).not.toBeNull();
    });
});
```

- [ ] **Step 2: Run the new tests and verify they FAIL**

Run: `npx vitest run src/lib/core/MessagingService.test.ts -t "NIP-40 receive-side"`
Expected: the "drops" tests FAIL (today expired rumors are dispatched normally); the "dispatches" tests already PASS (current behavior).

- [ ] **Step 3: Commit (failing tests)**

```bash
git add src/lib/core/MessagingService.test.ts
git commit -m "test(messaging): assert receive-side drop of expired rumors (RED)"
```

---

## Task 7: Add expiration drop in `handleGiftWrap` and `processGiftWrapToMessage` (GREEN for Task 6)

**Files:**
- Modify: `src/lib/core/Messaging.ts`
  - `handleGiftWrap` block at line ~228 (immediately after the my-pubkey-in-p-tags check at line 245-247, before the `if (rumor.kind === 7)` branch at line 249).
  - `processGiftWrapToMessage` block at line ~278 (analogous location after pubkey checks, before kind-specific routing).

- [ ] **Step 1: Insert the expiration check in `handleGiftWrap`** between line 247 and 249 (between the p-tag check and the `rumor.kind === 7` branch):

```ts
if (!myPubkeyInPTags && rumor.pubkey !== myPubkey) {
    throw new Error('Received rumor does not include my public key in p-tags');
}

// NIP-40: drop rumors whose expiration has passed. Generic — applies to any
// rumor kind (voice-call signals, read receipts, etc.).
const expirationTag = rumor.tags?.find((t: string[]) => t[0] === 'expiration');
if (expirationTag) {
    const expiresAt = parseInt(expirationTag[1], 10);
    if (!Number.isNaN(expiresAt) && expiresAt < Math.floor(Date.now() / 1000)) {
        if (this.debug) {
            console.log('[NIP-40] Dropping expired rumor', { kind: rumor.kind, expiresAt });
        }
        return;
    }
}

if (rumor.kind === 7) {
    await this.processReactionRumor(rumor, event.id);
    return;
}
```

- [ ] **Step 2: Mirror the same insertion in `processGiftWrapToMessage`**.

Read lines 278-360 first to find the equivalent location in `processGiftWrapToMessage`. The structure mirrors `handleGiftWrap`: it decrypts the gift wrap, decrypts the seal, validates pubkey match, and then routes by kind. Insert the same NIP-40 block after the p-tag check and before the first kind-specific branch.

If `processGiftWrapToMessage` returns a value (it returns `any | null`), the expired-drop branch should `return null;` instead of `return;`.

```ts
const expirationTag = rumor.tags?.find((t: string[]) => t[0] === 'expiration');
if (expirationTag) {
    const expiresAt = parseInt(expirationTag[1], 10);
    if (!Number.isNaN(expiresAt) && expiresAt < Math.floor(Date.now() / 1000)) {
        if (this.debug) {
            console.log('[NIP-40] Dropping expired rumor (native queue)', { kind: rumor.kind, expiresAt });
        }
        return null;
    }
}
```

- [ ] **Step 3: Run the Task 6 tests and verify they PASS**

Run: `npx vitest run src/lib/core/MessagingService.test.ts -t "NIP-40 receive-side"`
Expected: all 7 tests pass.

- [ ] **Step 4: Run the full MessagingService test suite for regressions**

Run: `npx vitest run src/lib/core/MessagingService.test.ts`
Expected: all tests pass. Particular attention: existing seal-signature, pubkey-mismatch, and read-receipt tests should be unaffected.

- [ ] **Step 5: Run the entire test suite and typecheck**

Run: `npm run check && npx vitest run`
Expected: PASS for both.

- [ ] **Step 6: Commit**

```bash
git add src/lib/core/Messaging.ts
git commit -m "feat(messaging): drop received rumors past NIP-40 expiration"
```

---

## Task 8: Manual smoke test

**Files:** none (operational verification)

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Expected: server starts on its usual port.

- [ ] **Step 2: Two-tab call test (happy path)**

Open two browser tabs (or use two devices/profiles) logged in as two different npubs that have each other as contacts and have configured messaging relays.

1. From npub A, open the chat with npub B and click the call button. Confirm:
   - Outgoing-call overlay appears with ringback tone.
   - On B, the incoming-call overlay appears with ringtone.
2. On B, accept the call. Confirm:
   - Both sides transition to active.
   - Audio is bidirectional.
3. On A, hang up. Confirm:
   - Both sides transition to ended.
   - A "call ended" event appears in both conversations with the duration.

- [ ] **Step 3: Two-tab call test (decline)**

1. From A, call B.
2. On B, decline. Confirm A sees ended state with reason `rejected`.

- [ ] **Step 4: Timeout test**

1. From A, call B.
2. On B, do nothing for 60+ seconds.
3. Confirm A times out and shows `timeout` reason.
4. Confirm both sides have an outgoing/missed call event in the conversation.

- [ ] **Step 5: (Optional) Verify expiration tag on the wire**

If you have access to one of the user's relays, query it for kind 1059 events addressed to the recipient and confirm the events carry an `["expiration","<unix>"]` tag.

- [ ] **Step 6: No commit needed for smoke test** (this is operational verification only).

---

## Final Verification

- [ ] **Step 1: Full check**

Run: `npm run check`
Expected: 0 errors.

- [ ] **Step 2: Full test suite**

Run: `npx vitest run`
Expected: all tests pass.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: clean build.

- [ ] **Step 4: Validate OpenSpec**

Run: `npx openspec validate voice-calling --strict --type spec`
Expected: `Specification 'voice-calling' is valid`.

---

## Self-Review

Run after writing the plan, before handing off.

**Spec coverage check** (against `openspec/specs/voice-calling/spec.md` Requirement: Ephemeral Signaling via NIP-40):

| Scenario | Implemented by |
|---|---|
| Outgoing voice signal carries 60-second expiration on all three layers | Task 3 (rumor + wrap) + Task 5 (seal) + Tasks 2 & 4 (assertions) |
| Expired rumor silently dropped on receive | Task 7 + Task 6 assertions for `handleGiftWrap` (past) and `processGiftWrapToMessage` (past) |
| Future-expiration rumor processed normally | Task 7 + Task 6 assertion #2 |
| Rumor without expiration tag processed normally | Task 7 + Task 6 assertion #3 |
| Read receipts continue to function under generic expiration check | Task 7 (the check is generic; read-receipt expiration is 7 days so well in the future). Regression coverage via existing read-receipt tests in Task 5 step 3. |

**Placeholder scan:** No "TBD", "TODO", "fill in", or "implement later" markers. All code blocks complete. All file paths absolute or anchored.

**Type consistency check:**
- `CALL_SIGNAL_EXPIRATION_SECONDS` defined in Task 1, consumed in Task 3.
- `expiresAt` parameter on `createGiftWrap` already exists in current code (line 1929) — Task 5 only adds the seal-tag side; signature unchanged.
- `processGiftWrapToMessage` returns `any | null`; Task 7 step 2 correctly uses `return null;` instead of `return;`.

---

## Commit log shape (expected)

```
feat(voice-call): add CALL_SIGNAL_EXPIRATION_SECONDS constant (60s)
test(voice-call): assert expiration tag on outgoing voice signal rumor (RED)
feat(voice-call): add NIP-40 expiration tag to voice signal rumors
test(voice-call): assert expiration tag on seal in createGiftWrap (RED)
feat(messaging): include NIP-40 expiration on seal per NIP-17 SHOULD
test(messaging): assert receive-side drop of expired rumors (RED)
feat(messaging): drop received rumors past NIP-40 expiration
```

7 commits total, alternating RED/GREEN per the TDD discipline.
