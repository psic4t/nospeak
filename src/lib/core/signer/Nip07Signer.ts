import type { Signer } from './Signer';
import type { NostrEvent } from 'nostr-tools';
import { get } from 'svelte/store';
import { signerMismatch } from '$lib/stores/signerMismatch';

declare global {
    interface Window {
        nostr?: {
            getPublicKey(): Promise<string>;
            signEvent(event: any): Promise<NostrEvent>;
            nip04?: {
                encrypt(pubkey: string, plaintext: string): Promise<string>;
                decrypt(pubkey: string, ciphertext: string): Promise<string>;
            };
            nip44?: {
                encrypt(pubkey: string, plaintext: string): Promise<string>;
                decrypt(pubkey: string, ciphertext: string): Promise<string>;
            };
        };
    }
}

export class Nip07Signer implements Signer {
    // Static cache to work across all instances
    private static cachedPublicKey: string | null = null;
    private static publicKeyPromise: Promise<string> | null = null;
    
    // Cache for encryption operations to avoid repeated prompts
    private static encryptionCache = new Map<string, Promise<string>>();
    private static decryptionCache = new Map<string, Promise<string>>();
    
    // Rate limiting to prevent overwhelming user
    private static operationQueue: Promise<any> = Promise.resolve();
    private static operationCount = 0;
    private static lastOperationTime = 0;

    async getPublicKey(): Promise<string> {
        this.checkExtension();
        
        ++Nip07Signer.operationCount;
        
        // Return cached value if available
        if (Nip07Signer.cachedPublicKey) {
            return Nip07Signer.cachedPublicKey;
        }
        
        // If promise is in progress, return it to avoid multiple calls
        if (Nip07Signer.publicKeyPromise) {
            return Nip07Signer.publicKeyPromise;
        }
        
        // Create and cache the promise
        Nip07Signer.publicKeyPromise = this.queueOperation(async () => {
            return window.nostr!.getPublicKey();
        });
        
        try {
            const pubkey = await Nip07Signer.publicKeyPromise;
            Nip07Signer.cachedPublicKey = pubkey;
            return pubkey;
        } finally {
            // Clear the promise after completion
            Nip07Signer.publicKeyPromise = null;
        }
    }

    async signEvent(event: Partial<NostrEvent>): Promise<NostrEvent> {
        this.checkExtension();
        this.checkMismatch();
        return this.queueOperation(async () => {
            return window.nostr!.signEvent(event);
        });
    }

    async encrypt(recipient: string, message: string): Promise<string> {
        this.checkExtension();
        this.checkMismatch();
        if (!window.nostr!.nip44) {
            throw new Error('Extension does not support NIP-44');
        }
        
        // Create cache key from recipient and message
        const cacheKey = `${recipient}:${message}`;
        
        // Return cached promise if in progress
        if (Nip07Signer.encryptionCache.has(cacheKey)) {
            return Nip07Signer.encryptionCache.get(cacheKey)!;
        }
        
        // Create and cache encryption promise
        const encryptPromise = this.queueOperation(async () => {
            return window.nostr!.nip44!.encrypt(recipient, message);
        }, 0); // Minimize delay for encryption
        Nip07Signer.encryptionCache.set(cacheKey, encryptPromise);
        
        try {
            const result = await encryptPromise;
            return result;
        } finally {
            // Remove from cache after completion to allow memory cleanup
            setTimeout(() => {
                Nip07Signer.encryptionCache.delete(cacheKey);
            }, 1000); // Reduced from 5000ms
        }
    }

    async decrypt(sender: string, ciphertext: string): Promise<string> {
        this.checkExtension();
        this.checkMismatch();
        if (!window.nostr!.nip44) {
            throw new Error('Extension does not support NIP-44');
        }
        
        // Create cache key from sender and ciphertext
        const cacheKey = `${sender}:${ciphertext}`;
        
        // Return cached promise if in progress
        if (Nip07Signer.decryptionCache.has(cacheKey)) {
            return Nip07Signer.decryptionCache.get(cacheKey)!;
        }
        
        // Create and cache decryption promise
        const decryptPromise = this.queueOperation(async () => {
            return window.nostr!.nip44!.decrypt(sender, ciphertext);
        }, 0); // Minimize delay for decryption to speed up history fetching
        Nip07Signer.decryptionCache.set(cacheKey, decryptPromise);
        
        try {
            const result = await decryptPromise;
            return result;
        } finally {
            // Remove from cache after completion to allow memory cleanup
            setTimeout(() => {
                Nip07Signer.decryptionCache.delete(cacheKey);
            }, 1000); // Reduced from 5000ms
        }
    }


    async requestNip44Permissions(): Promise<void> {
        try {
            const pubkey = await this.getPublicKey();
            // Encrypt to self to trigger encryption permission
            const ciphertext = await this.encrypt(pubkey, 'NIP-44 Permission Check');
            // Decrypt immediately to trigger decryption permission
            await this.decrypt(pubkey, ciphertext);
        } catch (e) {
            console.warn('[NIP-07] Failed to acquire NIP-44 permissions:', e);
            // We don't throw here to allow flow to continue even if rejected
        }
    }

    private async queueOperation<T>(operation: () => Promise<T>, minDelay: number = 200): Promise<T> {
        // Add operation to queue to serialize them
        Nip07Signer.operationQueue = Nip07Signer.operationQueue.then(async () => {
            // Add delay between operations to give user time to accept prompts
            const now = Date.now();
            const timeSinceLastOp = now - Nip07Signer.lastOperationTime;
            
            if (timeSinceLastOp < minDelay) {
                const delay = minDelay - timeSinceLastOp;
                    await new Promise(resolve => setTimeout(resolve, delay));
            }
            
            Nip07Signer.lastOperationTime = Date.now();
            return operation();
        });
        
        return Nip07Signer.operationQueue;
    }

    private checkExtension() {
        if (!window.nostr) {
            throw new Error('Nostr extension not found');
        }
    }

    /**
     * Check if there's a signer account mismatch. If so, throw an error
     * to prevent any signing operations with the wrong account.
     */
    private checkMismatch() {
        const mismatchState = get(signerMismatch);
        if (mismatchState?.detected) {
            throw new Error('Signer account mismatch - operation blocked. Please switch to the correct account in your signer extension and reload.');
        }
    }

    // Static method to clear cache (useful for logout)
    public static clearCache(): void {
        Nip07Signer.cachedPublicKey = null;
        Nip07Signer.publicKeyPromise = null;
        Nip07Signer.encryptionCache.clear();
        Nip07Signer.decryptionCache.clear();
        Nip07Signer.operationQueue = Promise.resolve();
        Nip07Signer.operationCount = 0;
        Nip07Signer.lastOperationTime = 0;
    }

    /**
     * Get the current signer's public key directly from the extension,
     * bypassing the cache. Used for verifying the active account matches
     * the logged-in user.
     */
    public static async getCurrentSignerPubkeyUncached(): Promise<string> {
        if (!window.nostr) {
            throw new Error('Nostr extension not found');
        }
        return window.nostr.getPublicKey();
    }
}
