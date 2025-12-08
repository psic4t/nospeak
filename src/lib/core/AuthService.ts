import { signer, currentUser } from '$lib/stores/auth';
import { LocalSigner } from '$lib/core/signer/LocalSigner';
import { Nip07Signer } from '$lib/core/signer/Nip07Signer';
import { Nip46Signer } from '$lib/core/signer/Nip46Signer';
import { DEFAULT_DISCOVERY_RELAYS, discoverUserRelays } from '$lib/core/connection/Discovery';
import { nip19, generateSecretKey, getPublicKey, SimplePool } from 'nostr-tools';
import { BunkerSigner, createNostrConnectURI, type NostrConnectParams } from 'nostr-tools/nip46';
import { goto } from '$app/navigation';
import { connectionManager } from './connection/instance';
import { messagingService } from './Messaging';
import { profileRepo } from '$lib/db/ProfileRepository';
import { syncAndroidBackgroundMessagingFromPreference, disableAndroidBackgroundMessaging } from './BackgroundMessaging';
import { contactRepo } from '$lib/db/ContactRepository';
import { profileResolver } from './ProfileResolver';
import { messageRepo } from '$lib/db/MessageRepository';
import { beginLoginSyncFlow, completeLoginSyncFlow, setLoginSyncActiveStep } from '$lib/stores/sync';

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
const NIP46_BUNKER_PUBKEY_KEY = 'nospeak:nip46_bunker_pubkey';
const NIP46_BUNKER_RELAYS_KEY = 'nospeak:nip46_bunker_relays';

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

            // Navigate to chat and start ordered login history flow in background
            goto('/chat');
            this.runLoginHistoryFlow(npub, 'Login').catch(console.error);
        } catch (e) {
            console.error('Login failed:', e);
            throw e;
        }
    }

    public async loginWithAmber(): Promise<string> {
        try {
            const localSecret = generateSecretKey();
            const localPubkey = getPublicKey(localSecret);
            const relays = ['wss://relay.nsec.app', 'wss://nostr.data.haus', 'wss://nos.lol'];
            
            // Generate a random 16-byte hex secret for the connection
            const secret = bytesToHex(generateSecretKey()).substring(0, 32);

            const params: NostrConnectParams = {
                clientPubkey: localPubkey,
                relays,
                name: 'nospeak',
                url: window.location.origin,
                perms: ['sign_event:1', 'sign_event:0', 'sign_event:13', 'sign_event:10002', 'nip44_encrypt', 'nip44_decrypt'],
                secret,
            };

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
        const s = await BunkerSigner.fromURI(localSecret, uri, {
            pool,
            onauth: (url: string) => {
                try {
                    window.open(url, '_blank');
                } catch (e) {
                    console.warn('Failed to open NIP-46 auth URL', e, url);
                }
            }
        });
        
        try {
            await s.connect();
        } catch (e) {
            console.warn('NIP-46 connect() failed:', e);
        }
        
        const pubkey = await s.getPublicKey();
        const npub = nip19.npubEncode(pubkey);

        signer.set(new Nip46Signer(s));
        currentUser.set({ npub });

        // Save persistence data
        localStorage.setItem(AUTH_METHOD_KEY, 'nip46');
        localStorage.setItem(NIP46_SECRET_KEY, bytesToHex(localSecret));
        localStorage.setItem(NIP46_URI_KEY, uri);
        localStorage.setItem(NIP46_BUNKER_PUBKEY_KEY, s.bp.pubkey);
        localStorage.setItem(NIP46_BUNKER_RELAYS_KEY, s.bp.relays.join(','));

        // Navigate to chat and start ordered login history flow in background
        goto('/chat');
        this.runLoginHistoryFlow(npub, 'NIP-46 login').catch(console.error);
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

            // Navigate to chat and start ordered login history flow in background
            goto('/chat');
            this.runLoginHistoryFlow(npub, 'Extension login').catch(console.error);
        } catch (e) {
            console.error('Extension login failed:', e);
            throw e;
        }
    }

    private async runLoginHistoryFlow(npub: string, context: string): Promise<void> {
        try {
            const existingProfile = await profileRepo.getProfileIgnoreTTL(npub);
            const hasCachedRelays = !!existingProfile && (
                (existingProfile.readRelays && existingProfile.readRelays.length > 0) ||
                (existingProfile.writeRelays && existingProfile.writeRelays.length > 0)
            );

            const totalMessages = await messageRepo.countMessages('ALL');
            const isFirstSync = totalMessages === 0;

            beginLoginSyncFlow(isFirstSync);

            if (!hasCachedRelays) {
                // 1. Connect to discovery relays
                setLoginSyncActiveStep('connect-discovery-relays');
                connectionManager.clearAllRelays();
                for (const url of DEFAULT_DISCOVERY_RELAYS) {
                    connectionManager.addTemporaryRelay(url);
                }
                await new Promise(resolve => setTimeout(resolve, 1000));

                // 2. Fetch and cache the user's messaging relays
                setLoginSyncActiveStep('fetch-messaging-relays');
                await profileResolver.resolveProfile(npub, true);
            } else {
                // Treat discovery and relay fetching as effectively complete
                setLoginSyncActiveStep('connect-discovery-relays');
                setLoginSyncActiveStep('fetch-messaging-relays');
            }

            const profile = await profileRepo.getProfileIgnoreTTL(npub);
            const readRelays = profile?.readRelays || [];

            // 3. Connect to user's read relays
            setLoginSyncActiveStep('connect-read-relays');
            for (const url of readRelays) {
                connectionManager.addPersistentRelay(url);
            }

            // Cleanup discovery relays used during this flow
            connectionManager.cleanupTemporaryConnections();

            // 4. Fetch and cache history items from relays
            setLoginSyncActiveStep('fetch-history');
            await messagingService.fetchHistory();

            // 5. Fetch and cache profile and relay infos for created contacts
            setLoginSyncActiveStep('fetch-contact-profiles');
            const contacts = await contactRepo.getContacts();
            for (const contact of contacts) {
                try {
                    await profileResolver.resolveProfile(contact.npub, false);
                } catch (error) {
                    console.error(`${context} contact profile refresh failed for ${contact.npub}:`, error);
                }
            }

            // 6. Fetch and cache user profile
            setLoginSyncActiveStep('fetch-user-profile');
            try {
                await profileResolver.resolveProfile(npub, false);
            } catch (error) {
                console.error(`${context} user profile refresh failed:`, error);
            }
        } catch (error) {
             console.error(`${context} login history flow failed:`, error);
         } finally {
             completeLoginSyncFlow();
 
             // Start app-global message subscriptions once login history flow completes
             messagingService.startSubscriptionsForCurrentUser().catch(e => {
                 console.error('Failed to start app-global message subscriptions after login flow:', e);
             });
 
             // Sync Android background messaging with the saved preference once startup flow completes
             syncAndroidBackgroundMessagingFromPreference().catch(e => {
                 console.error('Failed to sync Android background messaging preference after login flow:', e);
             });
         }
     }


    public async restore(): Promise<boolean> {
        const method = localStorage.getItem(AUTH_METHOD_KEY);

        const ensureRelaysAndHistory = async (npub: string, historyContext: string) => {
            try {
                const profile = await profileRepo.getProfileIgnoreTTL(npub);
                const hasCachedRelays = !!profile && (
                    (profile.readRelays && profile.readRelays.length > 0) ||
                    (profile.writeRelays && profile.writeRelays.length > 0)
                );

                if (hasCachedRelays) {
                    if (profile && profile.readRelays && profile.readRelays.length > 0) {
                        for (const url of profile.readRelays) {
                            connectionManager.addPersistentRelay(url);
                        }
                    }

                    messagingService
                        .fetchHistory()
                        .catch(e => console.error(`${historyContext} history fetch failed:`, e));
                } else {
                    await discoverUserRelays(npub, true);
                    messagingService
                        .fetchHistory()
                        .catch(e => console.error(`${historyContext} history fetch failed:`, e));
                }
            } catch (e) {
                console.error(`${historyContext} relay initialization failed:`, e);
            }
        };

        try {
            if (method === 'local') {
                const nsec = localStorage.getItem(STORAGE_KEY);
                if (!nsec) return false;
 
                const s = new LocalSigner(nsec);
                const pubkey = await s.getPublicKey();
                const npub = nip19.npubEncode(pubkey);
 
                signer.set(s);
                currentUser.set({ npub });
 
                await ensureRelaysAndHistory(npub, 'Restoration');
 
                await messagingService.startSubscriptionsForCurrentUser().catch(e => {
                    console.error('Failed to start app-global message subscriptions after local restore:', e);
                });
 
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
 
                await ensureRelaysAndHistory(npub, 'Restoration');
 
                await messagingService.startSubscriptionsForCurrentUser().catch(e => {
                    console.error('Failed to start app-global message subscriptions after nip07 restore:', e);
                });
 
                return true;
            } else if (method === 'nip46') {
                const secretHex = localStorage.getItem(NIP46_SECRET_KEY);
                const bunkerPubkey = localStorage.getItem(NIP46_BUNKER_PUBKEY_KEY);
                const bunkerRelaysCsv = localStorage.getItem(NIP46_BUNKER_RELAYS_KEY);
 
                if (!secretHex || !bunkerPubkey || !bunkerRelaysCsv) return false;
 
                const localSecret = hexToBytes(secretHex);
                const relays = bunkerRelaysCsv.split(',').map(r => r.trim()).filter(Boolean);
                if (relays.length === 0) return false;
                const pool = new SimplePool();
 
                const s = BunkerSigner.fromBunker(
                    localSecret,
                    { pubkey: bunkerPubkey, relays, secret: null },
                    {
                        pool,
                        onauth: (url: string) => {
                            try {
                                window.open(url, '_blank');
                            } catch (e) {
                                console.warn('Failed to open NIP-46 auth URL', e, url);
                            }
                        }
                    }
                );
 
                const pubkey = await s.getPublicKey();
                const npub = nip19.npubEncode(pubkey);
 
                signer.set(new Nip46Signer(s));
                currentUser.set({ npub });
 
                await ensureRelaysAndHistory(npub, 'Restoration');
 
                await messagingService.startSubscriptionsForCurrentUser().catch(e => {
                    console.error('Failed to start app-global message subscriptions after nip46 restore:', e);
                });
 
                return true;
            }

        } catch (e) {
            console.error('Restoration failed:', e);
            return false;
        }

        return false;
    }

    public async logout() {
        // Ensure Android background messaging is stopped before tearing down connections
        await disableAndroidBackgroundMessaging().catch(e => {
             console.error('Failed to disable Android background messaging on logout:', e);
         });
 
         // Stop app-global message subscriptions before tearing down connections
         messagingService.stopSubscriptions();
 
         localStorage.removeItem(STORAGE_KEY);

        localStorage.removeItem(AUTH_METHOD_KEY);
        localStorage.removeItem(NIP46_SECRET_KEY);
        localStorage.removeItem(NIP46_URI_KEY);
        localStorage.removeItem('nospeak-settings');
        localStorage.removeItem('nospeak-theme');
        localStorage.removeItem('nospeak-theme-mode');
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
            if (key && (key.startsWith('nospeak:') || key.startsWith('nospeak-'))) {
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
