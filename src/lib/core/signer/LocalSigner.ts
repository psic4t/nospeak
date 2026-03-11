import type { Signer } from './Signer';
import { finalizeEvent, nip04, nip19, nip44, getPublicKey, type NostrEvent } from 'nostr-tools';

export class LocalSigner implements Signer {
    private privateKey: Uint8Array;
    private publicKey: string;

    constructor(nsec: string) {
        const { type, data } = nip19.decode(nsec);
        if (type !== 'nsec') throw new Error('Invalid nsec');
        this.privateKey = data as Uint8Array;
        this.publicKey = getPublicKey(this.privateKey);
    }

    async getPublicKey(): Promise<string> {
        return this.publicKey;
    }

    async signEvent(event: Partial<NostrEvent>): Promise<NostrEvent> {
        return finalizeEvent(event as any, this.privateKey);
    }

    async encrypt(recipient: string, message: string): Promise<string> {
        // Use NIP-44 v2
        const conversationKey = nip44.v2.utils.getConversationKey(this.privateKey, recipient);
        return nip44.v2.encrypt(message, conversationKey);
    }

    async decrypt(sender: string, ciphertext: string): Promise<string> {
        // Try NIP-44
        try {
             const conversationKey = nip44.v2.utils.getConversationKey(this.privateKey, sender);
             return nip44.v2.decrypt(ciphertext, conversationKey);
        } catch (e) {
            // Fallback to NIP-04 if NIP-44 fails (e.g. wrong format)
            try {
                return await nip04.decrypt(this.privateKey, sender, ciphertext);
            } catch (e2) {
                throw new Error(`Decryption failed. NIP-44: ${(e as Error).message}; NIP-04 fallback: ${(e2 as Error).message}`);
            }
        }
    }
}
