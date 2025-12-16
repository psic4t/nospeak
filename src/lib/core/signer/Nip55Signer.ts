import type { Signer } from './Signer';
import type { NostrEvent } from 'nostr-tools';
import { nip19 } from 'nostr-tools';
import { AndroidNip55Signer } from '$lib/core/Nip55Bridge';

export class Nip55Signer implements Signer {
    private pubkeyHex: string | null = null;

    constructor(initialPubkeyHex?: string | null) {
        if (initialPubkeyHex && typeof initialPubkeyHex === 'string') {
            this.pubkeyHex = initialPubkeyHex;
        }
    }

    async getPublicKey(): Promise<string> {
        if (this.pubkeyHex) {
            return this.pubkeyHex;
        }

        if (!AndroidNip55Signer) {
            throw new Error('Android NIP-55 signer plugin not available');
        }

        const { pubkeyHex } = await AndroidNip55Signer.getPublicKey();
        let raw = pubkeyHex.trim();

        // Log for debugging on Android; safe because this is a public key
        console.log('[NIP-55] Received pubkey from signer:', raw, 'len=', raw.length);

        // If signer returned npub, decode it
        if (raw.startsWith('npub')) {
            try {
                const decoded = nip19.decode(raw);
                if (decoded.type === 'npub' && typeof decoded.data === 'string') {
                    raw = decoded.data;
                } else {
                    throw new Error('Unexpected npub decode type');
                }
            } catch (err) {
                console.error('[NIP-55] Failed to decode npub from signer', err);
                throw new Error('Invalid pubkey returned from Android signer (npub decode failed)');
            }
        }

        // Normalize potential hex: drop 0x prefix, lowercase, and ensure even length
        let normalized = raw.replace(/^0x/, '').toLowerCase();

        if (!/^[0-9a-f]+$/.test(normalized)) {
            console.error('[NIP-55] Non-hex characters in pubkey from signer:', raw);
            throw new Error('Invalid pubkey returned from Android signer (non-hex characters)');
        }

        if (normalized.length % 2 !== 0) {
            normalized = '0' + normalized;
        }

        if (normalized.length !== 64) {
            console.warn('[NIP-55] Pubkey hex has unexpected length after normalization:', normalized.length);
        }

        this.pubkeyHex = normalized;
        return normalized;
    }

    async signEvent(event: Partial<NostrEvent>): Promise<NostrEvent> {
        if (!AndroidNip55Signer) {
            throw new Error('Android NIP-55 signer plugin not available');
        }

        const pubkeyHex = await this.getPublicKey();
        const eventJson = JSON.stringify(event);
        const { signedEventJson } = await AndroidNip55Signer.signEvent({
            eventJson,
            currentUserPubkeyHex: pubkeyHex
        });

        const parsed = JSON.parse(signedEventJson) as NostrEvent;
        return parsed;
    }

    async encrypt(recipient: string, message: string): Promise<string> {
        if (!AndroidNip55Signer) {
            throw new Error('Android NIP-55 signer plugin not available');
        }

        const pubkeyHex = await this.getPublicKey();
        const { ciphertext } = await AndroidNip55Signer.nip44Encrypt({
            plaintext: message,
            recipientPubkeyHex: recipient,
            currentUserPubkeyHex: pubkeyHex
        });
        return ciphertext;
    }

    async decrypt(sender: string, ciphertext: string): Promise<string> {
        if (!AndroidNip55Signer) {
            throw new Error('Android NIP-55 signer plugin not available');
        }

        const pubkeyHex = await this.getPublicKey();
        const { plaintext } = await AndroidNip55Signer.nip44Decrypt({
            ciphertext,
            senderPubkeyHex: sender,
            currentUserPubkeyHex: pubkeyHex
        });
        return plaintext;
    }
}
