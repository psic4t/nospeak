// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
    finalizeEvent,
    generateSecretKey,
    getPublicKey,
    type NostrEvent
} from 'nostr-tools/pure';
import { nip44 } from 'nostr-tools';
import { createNipAcGiftWrap, unwrapNipAcGiftWrap } from './nipAcGiftWrap';
import {
    NIP_AC_GIFT_WRAP_KIND,
    NIP_AC_KIND_OFFER,
    NIP_AC_KIND_ANSWER,
    NIP_AC_KIND_ICE,
    NIP_AC_KIND_HANGUP,
    NIP_AC_KIND_REJECT
} from './constants';

/**
 * Build a deterministic decryptFn that uses the recipient's private key
 * to decrypt a NIP-44 v2 ciphertext authored against the wrap's
 * ephemeral pubkey. Mirrors what the production receive path does using
 * the user's signer.
 */
function makeDecryptFn(recipientPriv: Uint8Array) {
    return async (senderPubkey: string, ciphertext: string): Promise<string> => {
        const conversationKey = nip44.v2.utils.getConversationKey(
            recipientPriv,
            senderPubkey
        );
        return nip44.v2.decrypt(ciphertext, conversationKey);
    };
}

function buildSignedInner(opts: {
    senderPriv: Uint8Array;
    recipientPub: string;
    kind: number;
    content: string;
    callId: string;
    extraTags?: string[][];
}): NostrEvent {
    const tags: string[][] = [
        ['p', opts.recipientPub],
        ['call-id', opts.callId],
        ['alt', 'WebRTC ' + opts.kind]
    ];
    if (opts.extraTags) tags.push(...opts.extraTags);
    return finalizeEvent(
        {
            kind: opts.kind,
            content: opts.content,
            tags,
            created_at: Math.floor(Date.now() / 1000)
        },
        opts.senderPriv
    );
}

describe('NIP-AC gift wrap round trip', () => {
    const senderPriv = generateSecretKey();
    const senderPub = getPublicKey(senderPriv);
    const recipientPriv = generateSecretKey();
    const recipientPub = getPublicKey(recipientPriv);
    const decryptFn = makeDecryptFn(recipientPriv);
    const callId = '550e8400-e29b-41d4-a716-446655440000';

    it('W1: Call Offer round trips with correct kind and signature', async () => {
        const inner = buildSignedInner({
            senderPriv,
            recipientPub,
            kind: NIP_AC_KIND_OFFER,
            content: 'v=0\r\no=- 4611731400430051336 2 IN IP4 127.0.0.1\r\n',
            callId,
            extraTags: [['call-type', 'voice']]
        });

        const wrap = createNipAcGiftWrap(inner, recipientPub);

        expect(wrap.kind).toBe(NIP_AC_GIFT_WRAP_KIND);
        expect(wrap.tags).toEqual([['p', recipientPub]]);
        expect(wrap.tags.find((t) => t[0] === 'expiration')).toBeUndefined();

        const unwrapped = await unwrapNipAcGiftWrap(wrap, decryptFn);
        expect(unwrapped).not.toBeNull();
        expect(unwrapped!.id).toBe(inner.id);
        expect(unwrapped!.pubkey).toBe(senderPub);
        expect(unwrapped!.kind).toBe(NIP_AC_KIND_OFFER);
        expect(unwrapped!.content).toBe(inner.content);
        expect(unwrapped!.sig).toBe(inner.sig);
    });

    it('W2: Third party cannot decrypt wrap addressed to someone else', async () => {
        const inner = buildSignedInner({
            senderPriv,
            recipientPub,
            kind: NIP_AC_KIND_OFFER,
            content: 'v=0\r\no=- 1 1 IN IP4 0.0.0.0\r\n',
            callId,
            extraTags: [['call-type', 'voice']]
        });
        const wrap = createNipAcGiftWrap(inner, recipientPub);

        // Carol (third party) tries to unwrap with her own private key.
        const carolPriv = generateSecretKey();
        const carolDecrypt = makeDecryptFn(carolPriv);
        const result = await unwrapNipAcGiftWrap(wrap, carolDecrypt);
        expect(result).toBeNull();
    });

    it('W3: Call Answer round trips with SDP content preserved', async () => {
        const sdp = 'v=0\r\no=- 4611731400430051337 2 IN IP4 127.0.0.1\r\n';
        const inner = buildSignedInner({
            senderPriv,
            recipientPub,
            kind: NIP_AC_KIND_ANSWER,
            content: sdp,
            callId
        });
        const wrap = createNipAcGiftWrap(inner, recipientPub);
        const unwrapped = await unwrapNipAcGiftWrap(wrap, decryptFn);
        expect(unwrapped!.kind).toBe(NIP_AC_KIND_ANSWER);
        expect(unwrapped!.content).toBe(sdp);
        expect(unwrapped!.tags.find((t) => t[0] === 'call-type')).toBeUndefined();
    });

    it('W4: ICE Candidate round trips with strict JSON shape preserved', async () => {
        const candidatePayload = {
            candidate:
                'candidate:842163049 1 udp 1677729535 203.0.113.1 44323 typ srflx raddr 0.0.0.0 rport 0 generation 0',
            sdpMid: '0',
            sdpMLineIndex: 0
        };
        const inner = buildSignedInner({
            senderPriv,
            recipientPub,
            kind: NIP_AC_KIND_ICE,
            content: JSON.stringify(candidatePayload),
            callId
        });
        const wrap = createNipAcGiftWrap(inner, recipientPub);
        const unwrapped = await unwrapNipAcGiftWrap(wrap, decryptFn);
        const parsed = JSON.parse(unwrapped!.content);
        expect(parsed).toEqual(candidatePayload);
    });

    it('W5: Hangup round trips empty content', async () => {
        const inner = buildSignedInner({
            senderPriv,
            recipientPub,
            kind: NIP_AC_KIND_HANGUP,
            content: '',
            callId
        });
        const wrap = createNipAcGiftWrap(inner, recipientPub);
        const unwrapped = await unwrapNipAcGiftWrap(wrap, decryptFn);
        expect(unwrapped!.kind).toBe(NIP_AC_KIND_HANGUP);
        expect(unwrapped!.content).toBe('');
    });

    it('W6: Reject round trips "busy" reason', async () => {
        const inner = buildSignedInner({
            senderPriv,
            recipientPub,
            kind: NIP_AC_KIND_REJECT,
            content: 'busy',
            callId
        });
        const wrap = createNipAcGiftWrap(inner, recipientPub);
        const unwrapped = await unwrapNipAcGiftWrap(wrap, decryptFn);
        expect(unwrapped!.kind).toBe(NIP_AC_KIND_REJECT);
        expect(unwrapped!.content).toBe('busy');
    });

    it('W12: Full P2P flow round trips through gift wraps', async () => {
        const flow = [
            { kind: NIP_AC_KIND_OFFER, content: 'sdp-offer' },
            { kind: NIP_AC_KIND_ANSWER, content: 'sdp-answer' },
            {
                kind: NIP_AC_KIND_ICE,
                content: JSON.stringify({ candidate: 'c1', sdpMid: '0', sdpMLineIndex: 0 })
            },
            { kind: NIP_AC_KIND_HANGUP, content: '' }
        ];

        for (const step of flow) {
            const inner = buildSignedInner({
                senderPriv,
                recipientPub,
                kind: step.kind,
                content: step.content,
                callId
            });
            const wrap = createNipAcGiftWrap(inner, recipientPub);
            const unwrapped = await unwrapNipAcGiftWrap(wrap, decryptFn);
            expect(unwrapped!.kind).toBe(step.kind);
            expect(unwrapped!.content).toBe(step.content);
        }
    });

    it('W13: Wrap pubkey differs from inner event pubkey', async () => {
        const inner = buildSignedInner({
            senderPriv,
            recipientPub,
            kind: NIP_AC_KIND_OFFER,
            content: 'sdp',
            callId,
            extraTags: [['call-type', 'voice']]
        });
        const wrap = createNipAcGiftWrap(inner, recipientPub);
        expect(wrap.pubkey).not.toBe(senderPub);
        expect(wrap.pubkey).not.toBe(inner.pubkey);
    });

    it('W14: Two wraps for the same content use distinct ephemeral keys', async () => {
        const inner = buildSignedInner({
            senderPriv,
            recipientPub,
            kind: NIP_AC_KIND_OFFER,
            content: 'sdp',
            callId,
            extraTags: [['call-type', 'voice']]
        });
        const wrap1 = createNipAcGiftWrap(inner, recipientPub);
        const wrap2 = createNipAcGiftWrap(inner, recipientPub);
        expect(wrap1.pubkey).not.toBe(wrap2.pubkey);
        expect(wrap1.id).not.toBe(wrap2.id);
    });

    it('W15: Inner event signature verifies after unwrap', async () => {
        const inner = buildSignedInner({
            senderPriv,
            recipientPub,
            kind: NIP_AC_KIND_OFFER,
            content: 'sdp',
            callId,
            extraTags: [['call-type', 'voice']]
        });
        const wrap = createNipAcGiftWrap(inner, recipientPub);
        const unwrapped = await unwrapNipAcGiftWrap(wrap, decryptFn);
        // unwrapNipAcGiftWrap calls verifyEvent internally and returns null on
        // failure; non-null means signature was verified against inner.pubkey.
        expect(unwrapped).not.toBeNull();
        expect(unwrapped!.pubkey).toBe(senderPub);
    });

    it('W16: SDP with CRLF, slashes, equals, and quotes survives round trip', async () => {
        const trickySdp =
            'v=0\r\no=- 1 1 IN IP4 127.0.0.1\r\ns=-\r\na=ice-ufrag:slash/and"quote=eq\r\n';
        const inner = buildSignedInner({
            senderPriv,
            recipientPub,
            kind: NIP_AC_KIND_OFFER,
            content: trickySdp,
            callId,
            extraTags: [['call-type', 'voice']]
        });
        const wrap = createNipAcGiftWrap(inner, recipientPub);
        const unwrapped = await unwrapNipAcGiftWrap(wrap, decryptFn);
        expect(unwrapped!.content).toBe(trickySdp);
    });

    it('W17: ICE candidate JSON with embedded quotes and backslashes survives', async () => {
        const payload = {
            candidate: 'candidate:1 1 udp 1 1.1.1.1 1 typ host "raddr=\\0.0.0.0"',
            sdpMid: '0',
            sdpMLineIndex: 0
        };
        const inner = buildSignedInner({
            senderPriv,
            recipientPub,
            kind: NIP_AC_KIND_ICE,
            content: JSON.stringify(payload),
            callId
        });
        const wrap = createNipAcGiftWrap(inner, recipientPub);
        const unwrapped = await unwrapNipAcGiftWrap(wrap, decryptFn);
        const parsed = JSON.parse(unwrapped!.content);
        expect(parsed).toEqual(payload);
    });

    it('rejects unwrap on tampered inner content (sig becomes invalid)', async () => {
        const inner = buildSignedInner({
            senderPriv,
            recipientPub,
            kind: NIP_AC_KIND_OFFER,
            content: 'sdp',
            callId,
            extraTags: [['call-type', 'voice']]
        });
        // Tamper with the signed event before wrapping. unwrap should
        // return null because verifyEvent will fail.
        const tampered = { ...inner, content: 'tampered' };
        const wrap = createNipAcGiftWrap(tampered as NostrEvent, recipientPub);
        const result = await unwrapNipAcGiftWrap(wrap, decryptFn);
        expect(result).toBeNull();
    });

    it('rejects unwrap when wrap kind is not 21059', async () => {
        const inner = buildSignedInner({
            senderPriv,
            recipientPub,
            kind: NIP_AC_KIND_OFFER,
            content: 'sdp',
            callId,
            extraTags: [['call-type', 'voice']]
        });
        const wrap = createNipAcGiftWrap(inner, recipientPub);
        const wrongKind = { ...wrap, kind: 1059 } as NostrEvent;
        const result = await unwrapNipAcGiftWrap(wrongKind, decryptFn);
        expect(result).toBeNull();
    });

    it('rejects unwrap when decryption returns garbage', async () => {
        const inner = buildSignedInner({
            senderPriv,
            recipientPub,
            kind: NIP_AC_KIND_OFFER,
            content: 'sdp',
            callId,
            extraTags: [['call-type', 'voice']]
        });
        const wrap = createNipAcGiftWrap(inner, recipientPub);
        const garbageDecrypt = async () => 'not-json{';
        const result = await unwrapNipAcGiftWrap(wrap, garbageDecrypt);
        expect(result).toBeNull();
    });
});
