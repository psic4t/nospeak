import type { Signer } from './Signer';
import type { NostrEvent } from 'nostr-tools';

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
        
        console.log('[NIP-07] getPublicKey() called, operation count:', ++Nip07Signer.operationCount);
        
        // Return cached value if available
        if (Nip07Signer.cachedPublicKey) {
            console.log('[NIP-07] getPublicKey() using cached value');
            return Nip07Signer.cachedPublicKey;
        }
        
        // If promise is in progress, return it to avoid multiple calls
        if (Nip07Signer.publicKeyPromise) {
            console.log('[NIP-07] getPublicKey() using in-progress promise');
            return Nip07Signer.publicKeyPromise;
        }
        
        console.log('[NIP-07] getPublicKey() making new call to extension');
        // Create and cache the promise
        Nip07Signer.publicKeyPromise = this.queueOperation(async () => {
            return window.nostr!.getPublicKey();
        });
        
        try {
            const pubkey = await Nip07Signer.publicKeyPromise;
            Nip07Signer.cachedPublicKey = pubkey;
            console.log('[NIP-07] getPublicKey() completed, cached:', pubkey);
            return pubkey;
        } finally {
            // Clear the promise after completion
            Nip07Signer.publicKeyPromise = null;
        }
    }

    async signEvent(event: Partial<NostrEvent>): Promise<NostrEvent> {
        this.checkExtension();
        console.log('[NIP-07] signEvent() called for kind:', event.kind, 'operation count:', ++Nip07Signer.operationCount);
        return this.queueOperation(async () => {
            return window.nostr!.signEvent(event);
        });
    }

    async encrypt(recipient: string, message: string): Promise<string> {
        this.checkExtension();
        if (!window.nostr!.nip44) {
            throw new Error('Extension does not support NIP-44');
        }
        
        console.log('[NIP-07] encrypt() called for recipient:', recipient.substring(0, 8) + '...', 'message length:', message.length, 'operation count:', ++Nip07Signer.operationCount);
        
        // Create cache key from recipient and message
        const cacheKey = `${recipient}:${message}`;
        
        // Return cached promise if in progress
        if (Nip07Signer.encryptionCache.has(cacheKey)) {
            console.log('[NIP-07] encrypt() using cached promise');
            return Nip07Signer.encryptionCache.get(cacheKey)!;
        }
        
        console.log('[NIP-07] encrypt() making new call to extension');
        // Create and cache encryption promise
        const encryptPromise = this.queueOperation(async () => {
            return window.nostr!.nip44!.encrypt(recipient, message);
        });
        Nip07Signer.encryptionCache.set(cacheKey, encryptPromise);
        
        try {
            const result = await encryptPromise;
            console.log('[NIP-07] encrypt() completed');
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
        if (!window.nostr!.nip44) {
            throw new Error('Extension does not support NIP-44');
        }
        
        console.log('[NIP-07] decrypt() called for sender:', sender.substring(0, 8) + '...', 'ciphertext length:', ciphertext.length, 'operation count:', ++Nip07Signer.operationCount);
        
        // Create cache key from sender and ciphertext
        const cacheKey = `${sender}:${ciphertext}`;
        
        // Return cached promise if in progress
        if (Nip07Signer.decryptionCache.has(cacheKey)) {
            console.log('[NIP-07] decrypt() using cached promise');
            return Nip07Signer.decryptionCache.get(cacheKey)!;
        }
        
        console.log('[NIP-07] decrypt() making new call to extension');
        // Create and cache decryption promise
        const decryptPromise = this.queueOperation(async () => {
            return window.nostr!.nip44!.decrypt(sender, ciphertext);
        });
        Nip07Signer.decryptionCache.set(cacheKey, decryptPromise);
        
        try {
            const result = await decryptPromise;
            console.log('[NIP-07] decrypt() completed');
            return result;
        } finally {
            // Remove from cache after completion to allow memory cleanup
            setTimeout(() => {
                Nip07Signer.decryptionCache.delete(cacheKey);
            }, 1000); // Reduced from 5000ms
        }
    }

    private async queueOperation<T>(operation: () => Promise<T>): Promise<T> {
        // Add operation to queue to serialize them
        Nip07Signer.operationQueue = Nip07Signer.operationQueue.then(async () => {
            // Add delay between operations to give user time to accept prompts
            const now = Date.now();
            const timeSinceLastOp = now - Nip07Signer.lastOperationTime;
            
            if (timeSinceLastOp < 200) { // 200ms between operations (reduced from 1s)
                const delay = 200 - timeSinceLastOp;
                console.log(`[NIP-07] Delaying operation for ${delay}ms to prevent overwhelming user`);
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
}