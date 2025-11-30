import { get } from 'svelte/store';
import { signer, currentUser } from '$lib/stores/auth';
import { LocalSigner } from '$lib/core/signer/LocalSigner';
import { Nip07Signer } from '$lib/core/signer/Nip07Signer';
import { Nip46Signer } from '$lib/core/signer/Nip46Signer';
import { discoverUserRelays } from '$lib/core/connection/Discovery';
import { nip19, generateSecretKey, getPublicKey, SimplePool } from 'nostr-tools';
import { BunkerSigner, createNostrConnectURI, type NostrConnectParams } from 'nostr-tools/nip46';
import { goto } from '$app/navigation';
import { connectionManager } from './connection/instance';
import { messagingService } from './Messaging';

// Helper for hex conversion
function bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    }
    return bytes;
}

const STORAGE_KEY = 'nospeak:nsec';
const AUTH_METHOD_KEY = 'nospeak:auth_method'; // 'local' | 'nip07' | 'nip46'
const NIP46_SECRET_KEY = 'nospeak:nip46_secret';
const NIP46_URI_KEY = 'nospeak:nip46_uri';

export class AuthService {
    public async login(nsec: string, remember: boolean = true) {
        try {
            const s = new LocalSigner(nsec);
            const pubkey = await s.getPublicKey();
            const npub = nip19.npubEncode(pubkey);
            
            signer.set(s);
            currentUser.set({ npub });

            if (remember) {
                localStorage.setItem(STORAGE_KEY, nsec);
                localStorage.setItem(AUTH_METHOD_KEY, 'local');
            }

            // Start discovery
            await discoverUserRelays(npub);
            
            // Fetch message history to fill cache gaps
            messagingService.fetchHistory().catch(console.error);
            
            goto('/chat');
        } catch (e) {
            console.error('Login failed:', e);
            throw e;
        }
    }

    public async loginWithAmber(): Promise<string> {
        try {
            const localSecret = generateSecretKey();
            const localPubkey = getPublicKey(localSecret);
            const relays = ['wss://relay.nsecbunker.com', 'wss://relay.damus.io', 'wss://nos.lol'];
            
            // Generate a random 16-byte hex secret for the connection
            const secret = bytesToHex(generateSecretKey()).substring(0, 32);

            const params: NostrConnectParams = {
                clientPubkey: localPubkey,
                relays,
                name: 'Nospeak Web',
                url: window.location.origin,
                perms: 'sign_event:1,nip04_encrypt,nip04_decrypt',
                secret,
            } as any;

            const uri = createNostrConnectURI(params);
            
            // Start listening for connection in background
            this.waitForNip46Connection(localSecret, uri).catch(console.error);
            
            return uri;
        } catch (e) {
            console.error('Amber login failed:', e);
            throw e;
        }
    }

    private async waitForNip46Connection(localSecret: Uint8Array, uri: string) {
        const pool = new SimplePool();
        const s = await BunkerSigner.fromURI(localSecret, uri, { pool });
        
        const pubkey = await s.getPublicKey();
        const npub = nip19.npubEncode(pubkey);

        signer.set(new Nip46Signer(s));
        currentUser.set({ npub });

        // Save persistence data
        localStorage.setItem(AUTH_METHOD_KEY, 'nip46');
        localStorage.setItem(NIP46_SECRET_KEY, bytesToHex(localSecret));
        localStorage.setItem(NIP46_URI_KEY, uri);

        await discoverUserRelays(npub);
        messagingService.fetchHistory().catch(console.error);
        
        goto('/chat');
    }

    public async loginWithExtension(remember: boolean = true) {
        try {
            const s = new Nip07Signer();
            const pubkey = await s.getPublicKey();
            const npub = nip19.npubEncode(pubkey);

            // Request NIP-44 permissions upfront
            await s.requestNip44Permissions();

            signer.set(s);
            currentUser.set({ npub });

            if (remember) {
                localStorage.setItem(AUTH_METHOD_KEY, 'nip07');
            }

            await discoverUserRelays(npub);
            
            // Fetch message history to fill cache gaps
            messagingService.fetchHistory().catch(console.error);
            
            goto('/chat');
        } catch (e) {
            console.error('Extension login failed:', e);
            throw e;
        }
    }

    public async restore(): Promise<boolean> {
        const method = localStorage.getItem(AUTH_METHOD_KEY);
        
        try {
            if (method === 'local') {
                const nsec = localStorage.getItem(STORAGE_KEY);
                if (!nsec) return false;
                
                const s = new LocalSigner(nsec);
                const pubkey = await s.getPublicKey();
                const npub = nip19.npubEncode(pubkey);
                
                signer.set(s);
                currentUser.set({ npub });
                
                discoverUserRelays(npub).catch(e => console.error('Restoration discovery failed:', e));
                
                // Fetch message history after restoration
                messagingService.fetchHistory().catch(e => console.error('Restoration history fetch failed:', e));
                
                return true;
            } else if (method === 'nip07') {
                if (!window.nostr) {
                    // Wait a bit? Or fail.
                }
                
                const s = new Nip07Signer();
                const pubkey = await s.getPublicKey(); 
                const npub = nip19.npubEncode(pubkey);

                await s.requestNip44Permissions();

                signer.set(s);
                currentUser.set({ npub });

                discoverUserRelays(npub).catch(e => console.error('Restoration discovery failed:', e));
                messagingService.fetchHistory().catch(e => console.error('Restoration history fetch failed:', e));
                
                return true;
            } else if (method === 'nip46') {
                const secretHex = localStorage.getItem(NIP46_SECRET_KEY);
                const uri = localStorage.getItem(NIP46_URI_KEY);
                
                if (!secretHex || !uri) return false;

                const localSecret = hexToBytes(secretHex);
                const pool = new SimplePool();
                
                const s = await BunkerSigner.fromURI(localSecret, uri, { pool });
                
                const pubkey = await s.getPublicKey();
                const npub = nip19.npubEncode(pubkey);

                signer.set(new Nip46Signer(s));
                currentUser.set({ npub });
                
                discoverUserRelays(npub).catch(e => console.error('Restoration discovery failed:', e));
                messagingService.fetchHistory().catch(e => console.error('Restoration history fetch failed:', e));

                return true;
            }
        } catch (e) {
            console.error('Restoration failed:', e);
            return false;
        }
         
        return false;
    }

    public async logout() {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(AUTH_METHOD_KEY);
        localStorage.removeItem(NIP46_SECRET_KEY);
        localStorage.removeItem(NIP46_URI_KEY);
        signer.set(null);
        currentUser.set(null);
        connectionManager.stop();
        
        // Clear NIP-07 cache to allow re-authentication
        Nip07Signer.clearCache();
        
        // Clear IndexedDB data
        const { db } = await import('$lib/db/db');
        db.clearAll().catch(error => {
            console.error('Failed to clear IndexedDB:', error);
        });
        
        // Clear any additional localStorage items
        this.clearAdditionalLocalStorage();
        
        goto('/');
    }

    private clearAdditionalLocalStorage(): void {
        // Clear any other app-specific localStorage items
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('nospeak:')) {
                keysToRemove.push(key);
            }
        }
        
        keysToRemove.forEach(key => {
            localStorage.removeItem(key);
        });
        
        if (keysToRemove.length > 0) {
            console.log(`Cleared ${keysToRemove.length} additional localStorage items`);
        }
    }
}

export const authService = new AuthService();
