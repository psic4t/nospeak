import { get } from 'svelte/store';
import { signer, currentUser } from '$lib/stores/auth';
import { LocalSigner } from '$lib/core/signer/LocalSigner';
import { Nip07Signer } from '$lib/core/signer/Nip07Signer';
import { discoverUserRelays } from '$lib/core/connection/Discovery';
import { nip19 } from 'nostr-tools';
import { goto } from '$app/navigation';
import { connectionManager } from './connection/instance';
import { messagingService } from './Messaging';

const STORAGE_KEY = 'nospeak:nsec';
const AUTH_METHOD_KEY = 'nospeak:auth_method'; // 'local' | 'nip07'

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

    public async loginWithExtension(remember: boolean = true) {
        try {
            const s = new Nip07Signer();
            const pubkey = await s.getPublicKey();
            const npub = nip19.npubEncode(pubkey);

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
                // For NIP-07, we need to wait for extension to inject?
                // Usually it's available on load, but sometimes delayed.
                // We'll try immediately.
                if (!window.nostr) {
                    // Wait a bit? Or fail.
                    // Usually checking window.nostr in onMount is safe-ish if script injected.
                    // Let's retry once after a short delay if missing?
                    // Svelte onMount happens after DOM ready.
                }
                
                const s = new Nip07Signer();
                // This might prompt user if they haven't authorized yet, 
                // but typically getPublicKey is silent if already authorized or prompts.
                const pubkey = await s.getPublicKey(); 
                const npub = nip19.npubEncode(pubkey);

                signer.set(s);
                currentUser.set({ npub });

                discoverUserRelays(npub).catch(e => console.error('Restoration discovery failed:', e));
                
                // Fetch message history after restoration
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
