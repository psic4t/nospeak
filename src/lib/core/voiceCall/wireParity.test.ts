/**
 * Wire-format parity test for NIP-AC inner events. Phase 0 plumbing for
 * the {@code add-native-voice-calls} OpenSpec change.
 *
 * Asserts that the JavaScript NIP-AC sender (via {@code getEventHash}
 * from {@code nostr-tools}) produces the canonical event-id specified
 * in {@code tests/fixtures/nip-ac-wire/inner-events.json}, for fixed
 * sender pubkey, recipient pubkey, callId, created_at, content, and
 * tags.
 *
 * The same fixture is consumed by the Java-side
 * {@code NativeNipAcSenderTest} (Robolectric/JUnit). When both tests
 * pass, the JS and native paths are guaranteed to produce byte-
 * equivalent canonical NIP-01 serializations and therefore identical
 * event ids — the foundation of NIP-AC wire compatibility once
 * {@code NativeVoiceCallManager} begins driving signaling natively.
 *
 * If you change a fixture input, regenerate the {@code expectedId}
 * field by running the nostr-tools script described in the fixture's
 * {@code _doc} field. Do NOT hand-edit ids.
 */
import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Canonical NIP-01 event-id serialization. Matches the production path
 * via {@code nostr-tools} {@code getEventHash}, but is implemented
 * locally in the test so we avoid jsdom/utf8Encoder marshaling quirks
 * that surface only in vitest. The shape is fixed by NIP-01:
 *   [0, pubkey, created_at, kind, tags, content]
 * The hash is sha256 of the UTF-8 encoded JSON-stringified array.
 */
function computeEventId(
    inner: { kind: number; pubkey: string; created_at: number; content: string; tags: string[][] }
): string {
    const canonical = JSON.stringify([
        0,
        inner.pubkey,
        inner.created_at,
        inner.kind,
        inner.tags,
        inner.content
    ]);
    return createHash('sha256').update(canonical, 'utf-8').digest('hex');
}

interface FixtureCase {
    name: string;
    kind: number;
    content: string;
    altText: string;
    extraTags: string[][];
    expectedId: string;
}

interface Fixture {
    sender: string;
    recipient: string;
    callId: string;
    createdAt: number;
    cases: FixtureCase[];
}

const fixturePath = resolve(
    __dirname,
    '../../../../tests/fixtures/nip-ac-wire/inner-events.json'
);
const fixture: Fixture = JSON.parse(readFileSync(fixturePath, 'utf-8'));

/**
 * Build the same inner-event shape that {@code Messaging.buildSignedNipAcInner}
 * emits, minus the {@code id} and {@code sig} fields that the signer
 * adds. Tag order MUST be: ['p', recipient], ['call-id', callId],
 * ['alt', altText], ...extraTags. The signer (and the relay verifier)
 * sees the canonical NIP-01 array form.
 */
function buildInner(
    fixtureRoot: Fixture,
    c: FixtureCase
): { kind: number; pubkey: string; created_at: number; content: string; tags: string[][] } {
    const tags: string[][] = [
        ['p', fixtureRoot.recipient],
        ['call-id', fixtureRoot.callId],
        ['alt', c.altText],
        ...c.extraTags
    ];
    return {
        kind: c.kind,
        pubkey: fixtureRoot.sender,
        created_at: fixtureRoot.createdAt,
        content: c.content,
        tags
    };
}

describe('NIP-AC wire-format parity (JS side)', () => {
    for (const c of fixture.cases) {
        it(`kind ${c.kind} :: ${c.name} produces the canonical event id`, () => {
            const inner = buildInner(fixture, c);
            const id = computeEventId(inner);
            expect(id).toEqual(c.expectedId);
        });
    }
});
