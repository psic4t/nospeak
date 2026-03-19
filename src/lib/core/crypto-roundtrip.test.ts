/**
 * Integration test for crypto operations with @noble/* v2 and nostr-tools.
 * Tests real crypto roundtrips without mocking — verifies that the upgraded
 * dependencies actually work end-to-end.
 */
import { describe, it, expect } from 'vitest';
import {
    generateSecretKey,
    getPublicKey,
    finalizeEvent,
    verifyEvent,
    nip19,
    nip44,
    nip04
} from 'nostr-tools';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';

describe('crypto roundtrip (@noble v2 integration)', () => {
    describe('key generation and encoding', () => {
        it('generates a valid secret key as Uint8Array', () => {
            const sk = generateSecretKey();
            expect(sk).toBeInstanceOf(Uint8Array);
            expect(sk.length).toBe(32);
        });

        it('derives a valid hex pubkey from secret key', () => {
            const sk = generateSecretKey();
            const pk = getPublicKey(sk);
            expect(typeof pk).toBe('string');
            expect(pk).toMatch(/^[0-9a-f]{64}$/);
        });

        it('nip19 nsec encode/decode roundtrip', () => {
            const sk = generateSecretKey();
            const nsec = nip19.nsecEncode(sk);
            expect(nsec.startsWith('nsec1')).toBe(true);

            const decoded = nip19.decode(nsec);
            expect(decoded.type).toBe('nsec');
            expect(decoded.data).toBeInstanceOf(Uint8Array);
            expect(bytesToHex(decoded.data as Uint8Array)).toBe(bytesToHex(sk));
        });

        it('nip19 npub encode/decode roundtrip', () => {
            const sk = generateSecretKey();
            const pk = getPublicKey(sk);
            const npub = nip19.npubEncode(pk);
            expect(npub.startsWith('npub1')).toBe(true);

            const decoded = nip19.decode(npub);
            expect(decoded.type).toBe('npub');
            expect(decoded.data).toBe(pk);
        });
    });

    describe('event signing and verification', () => {
        it('signs and verifies an event', () => {
            const sk = generateSecretKey();
            const event = finalizeEvent(
                {
                    kind: 1,
                    created_at: Math.floor(Date.now() / 1000),
                    tags: [],
                    content: 'Hello from noble v2!'
                },
                sk
            );

            expect(event.id).toMatch(/^[0-9a-f]{64}$/);
            expect(event.sig).toMatch(/^[0-9a-f]{128}$/);
            expect(event.pubkey).toBe(getPublicKey(sk));
            expect(verifyEvent(event)).toBe(true);
        });

        it('rejects an event with a wrong signature', () => {
            const sk1 = generateSecretKey();
            const sk2 = generateSecretKey();
            const event = finalizeEvent(
                {
                    kind: 1,
                    created_at: Math.floor(Date.now() / 1000),
                    tags: [],
                    content: 'Original'
                },
                sk1
            );

            // Simulate receiving a tampered event via JSON (no cached verifiedSymbol)
            const tampered = JSON.parse(JSON.stringify(event));
            tampered.pubkey = getPublicKey(sk2);
            expect(verifyEvent(tampered)).toBe(false);
        });
    });

    describe('NIP-44 v2 encryption', () => {
        it('encrypt and decrypt roundtrip', () => {
            const sk1 = generateSecretKey();
            const sk2 = generateSecretKey();
            const pk2 = getPublicKey(sk2);
            const pk1 = getPublicKey(sk1);

            const conversationKey = nip44.v2.utils.getConversationKey(sk1, pk2);
            expect(conversationKey).toBeInstanceOf(Uint8Array);
            expect(conversationKey.length).toBe(32);

            const plaintext = 'Hello, this is a NIP-44 encrypted message!';
            const ciphertext = nip44.v2.encrypt(plaintext, conversationKey);
            expect(typeof ciphertext).toBe('string');
            expect(ciphertext.length).toBeGreaterThan(0);

            // Decrypt with the same conversation key
            const decrypted = nip44.v2.decrypt(ciphertext, conversationKey);
            expect(decrypted).toBe(plaintext);

            // Recipient can also derive the same conversation key
            const recipientConvKey = nip44.v2.utils.getConversationKey(sk2, pk1);
            const decryptedByRecipient = nip44.v2.decrypt(ciphertext, recipientConvKey);
            expect(decryptedByRecipient).toBe(plaintext);
        });

        it('encrypts unicode content correctly', () => {
            const sk1 = generateSecretKey();
            const sk2 = generateSecretKey();
            const pk2 = getPublicKey(sk2);

            const conversationKey = nip44.v2.utils.getConversationKey(sk1, pk2);
            const plaintext = 'Umlauts: aeoeue. Emoji: \u{1F600}\u{1F389}. CJK: \u4F60\u597D';
            const ciphertext = nip44.v2.encrypt(plaintext, conversationKey);
            const decrypted = nip44.v2.decrypt(ciphertext, conversationKey);
            expect(decrypted).toBe(plaintext);
        });

        it('produces different ciphertexts for the same plaintext (random nonce)', () => {
            const sk1 = generateSecretKey();
            const sk2 = generateSecretKey();
            const pk2 = getPublicKey(sk2);

            const conversationKey = nip44.v2.utils.getConversationKey(sk1, pk2);
            const plaintext = 'Same message twice';
            const ct1 = nip44.v2.encrypt(plaintext, conversationKey);
            const ct2 = nip44.v2.encrypt(plaintext, conversationKey);
            expect(ct1).not.toBe(ct2);
        });
    });

    describe('NIP-04 legacy encryption', () => {
        it('encrypt and decrypt roundtrip', async () => {
            const sk1 = generateSecretKey();
            const sk2 = generateSecretKey();
            const pk2 = getPublicKey(sk2);
            const pk1 = getPublicKey(sk1);

            const plaintext = 'Legacy NIP-04 message';
            const ciphertext = await nip04.encrypt(sk1, pk2, plaintext);
            expect(typeof ciphertext).toBe('string');

            const decrypted = await nip04.decrypt(sk2, pk1, ciphertext);
            expect(decrypted).toBe(plaintext);
        });
    });

    describe('@noble/hashes v2 direct usage', () => {
        it('sha256 with utf8ToBytes produces correct hash', () => {
            const input = 'hello world';
            const hash = sha256(utf8ToBytes(input));
            expect(hash).toBeInstanceOf(Uint8Array);
            expect(hash.length).toBe(32);
            // Known SHA-256 of "hello world"
            expect(bytesToHex(hash)).toBe(
                'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9'
            );
        });

        it('bytesToHex produces lowercase hex', () => {
            const bytes = new Uint8Array([0, 1, 255, 128]);
            expect(bytesToHex(bytes)).toBe('0001ff80');
        });
    });
});
