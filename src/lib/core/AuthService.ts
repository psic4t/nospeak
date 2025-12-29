import { signer, currentUser } from '$lib/stores/auth';
import { LocalSigner } from '$lib/core/signer/LocalSigner';
import { Nip07Signer } from '$lib/core/signer/Nip07Signer';
import { Nip55Signer } from '$lib/core/signer/Nip55Signer';
import { discoverUserRelays } from '$lib/core/connection/Discovery';
import { getDiscoveryRelays } from '$lib/core/runtimeConfig';
import { nip19, generateSecretKey, getPublicKey } from 'nostr-tools';
import { goto } from '$app/navigation';
import { connectionManager } from './connection/instance';
import { messagingService } from './Messaging';
import { profileRepo } from '$lib/db/ProfileRepository';
 import { syncAndroidBackgroundMessagingFromPreference, disableAndroidBackgroundMessaging } from './BackgroundMessaging';
 import { contactRepo } from '$lib/db/ContactRepository';
import { profileResolver } from './ProfileResolver';
import { messageRepo } from '$lib/db/MessageRepository';
import { beginLoginSyncFlow, completeLoginSyncFlow, setLoginSyncActiveStep } from '$lib/stores/sync';
import { showEmptyProfileModal } from '$lib/stores/modals';
import { isAndroidNative } from './NativeDialogs';
import { notificationService } from './NotificationService';
import { clearAndroidLocalSecretKey, getAndroidLocalSecretKeyHex, setAndroidLocalSecretKeyHex } from './AndroidLocalSecretKey';

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
const AUTH_METHOD_KEY = 'nospeak:auth_method'; // 'local' | 'nip07' | 'amber'
const NIP46_SECRET_KEY = 'nospeak:nip46_secret';
const NIP46_URI_KEY = 'nospeak:nip46_uri';
const NIP46_BUNKER_PUBKEY_KEY = 'nospeak:nip46_bunker_pubkey';
const NIP46_BUNKER_RELAYS_KEY = 'nospeak:nip46_bunker_relays';

const SETTINGS_KEY = 'nospeak-settings';
const NOTIFICATION_PERMISSION_PROMPTED_KEY = 'nospeak_notifications_permission_prompted';

export class AuthService {
    public generateKeypair(): { npub: string; nsec: string } {
        const secret = generateSecretKey();
        const nsec = nip19.nsecEncode(secret);
        const pubkey = getPublicKey(secret);
        const npub = nip19.npubEncode(pubkey);

        return { npub, nsec };
    }

    private async promptNotificationPermissionOnce(): Promise<void> {
        if (typeof window === 'undefined' || !window.localStorage) {
            return;
        }

        if (window.localStorage.getItem(NOTIFICATION_PERMISSION_PROMPTED_KEY)) {
            return;
        }

        let notificationsEnabled = true;

        try {
            const raw = window.localStorage.getItem(SETTINGS_KEY);
            if (raw) {
                const parsed = JSON.parse(raw) as { notificationsEnabled?: boolean };
                notificationsEnabled = parsed.notificationsEnabled !== false;
            }
        } catch (e) {
            console.warn('Failed to read notification preference for permission prompt:', e);
        }

        if (!notificationsEnabled) {
            return;
        }

        try {
            window.localStorage.setItem(NOTIFICATION_PERMISSION_PROMPTED_KEY, '1');
        } catch (e) {
            console.warn('Failed to persist notification prompt sentinel:', e);
        }

        try {
            await notificationService.requestPermission();
        } catch (e) {
            console.warn('Notification permission request failed:', e);
        }
    }

    public async login(nsec: string) {
        try {
            await this.promptNotificationPermissionOnce();

            const s = new LocalSigner(nsec);
            const pubkey = await s.getPublicKey();
            const npub = nip19.npubEncode(pubkey);

            signer.set(s);
            currentUser.set({ npub });

            localStorage.setItem(AUTH_METHOD_KEY, 'local');

            if (isAndroidNative()) {
                try {
                    const decoded = nip19.decode(nsec);
                    if (decoded.type !== 'nsec' || !(decoded.data instanceof Uint8Array)) {
                        throw new Error('Invalid nsec');
                    }

                    const secretKeyHex = bytesToHex(decoded.data);
                    await setAndroidLocalSecretKeyHex(secretKeyHex);

                    // Ensure the local secret is not duplicated in web storage on Android.
                    localStorage.removeItem(STORAGE_KEY);
                } catch (e) {
                    console.error('Failed to persist Android local secret key:', e);
                    throw e;
                }
            } else {
                localStorage.setItem(STORAGE_KEY, nsec);
            }

            // Navigate to chat and start ordered login history flow in background
            goto('/chat');
            this.runLoginHistoryFlow(npub, 'Login').catch(console.error);
        } catch (e) {
            console.error('Login failed:', e);
            throw e;
        }
    }

    public async loginWithAmber(): Promise<void> {
        try {
            await this.promptNotificationPermissionOnce();

            const s = new Nip55Signer();
            const pubkeyHex = await s.getPublicKey();
            const npub = nip19.npubEncode(pubkeyHex);

            signer.set(s);
            currentUser.set({ npub });

            localStorage.setItem(AUTH_METHOD_KEY, 'amber');
            localStorage.setItem('nospeak:amber_pubkey_hex', pubkeyHex);

            goto('/chat');
            this.runLoginHistoryFlow(npub, 'Amber login').catch(console.error);
        } catch (e) {
            console.error('Amber login failed:', e);
            throw e;
        }
    }

    public async loginWithExtension() {
        try {
            await this.promptNotificationPermissionOnce();

            const s = new Nip07Signer();
            const pubkey = await s.getPublicKey();
            const npub = nip19.npubEncode(pubkey);

            // Request NIP-44 permissions upfront
            await s.requestNip44Permissions();

            signer.set(s);
            currentUser.set({ npub });

            localStorage.setItem(AUTH_METHOD_KEY, 'nip07');

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
                existingProfile.messagingRelays && existingProfile.messagingRelays.length > 0
            );

            const totalMessages = await messageRepo.countMessages('ALL');
            const isFirstSync = totalMessages === 0;

            beginLoginSyncFlow(isFirstSync);

            if (!hasCachedRelays) {
                // 1. Connect to discovery relays
                setLoginSyncActiveStep('connect-discovery-relays');
                connectionManager.clearAllRelays();
                for (const url of getDiscoveryRelays()) {
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
            const messagingRelays = profile?.messagingRelays || [];
 
            // 3. Connect to user's messaging relays
            setLoginSyncActiveStep('connect-read-relays');
            for (const url of messagingRelays) {
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

            try {
                const finalProfile = await profileRepo.getProfileIgnoreTTL(npub);
                const hasRelays = !!finalProfile && Array.isArray(finalProfile.messagingRelays) && finalProfile.messagingRelays.length > 0;
 
                const metadata = finalProfile?.metadata || {};
                const hasUsername = !!(metadata.name || metadata.display_name || metadata.nip05);
 
                if (!hasRelays && !hasUsername) {
                    showEmptyProfileModal.set(true);
                }
            } catch (profileError) {
                console.error(`${context} empty profile check failed:`, profileError);
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
                    profile.messagingRelays && profile.messagingRelays.length > 0
                );
 
                if (hasCachedRelays) {
                    if (profile && profile.messagingRelays && profile.messagingRelays.length > 0) {
                        for (const url of profile.messagingRelays) {
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
                let nsec: string | null = null;

                if (isAndroidNative()) {
                    const secretKeyHex = await getAndroidLocalSecretKeyHex();
                    if (!secretKeyHex) {
                        // No migration: require explicit re-login.
                        localStorage.removeItem(AUTH_METHOD_KEY);
                        localStorage.removeItem(STORAGE_KEY);
                        return false;
                    }

                    try {
                        nsec = nip19.nsecEncode(hexToBytes(secretKeyHex));
                    } catch (e) {
                        localStorage.removeItem(AUTH_METHOD_KEY);
                        return false;
                    }
                } else {
                    nsec = localStorage.getItem(STORAGE_KEY);
                    if (!nsec) return false;
                }

                const s = new LocalSigner(nsec);
                const pubkey = await s.getPublicKey();
                const npub = nip19.npubEncode(pubkey);

                signer.set(s);
                currentUser.set({ npub });

                await ensureRelaysAndHistory(npub, 'Restoration');

                await messagingService.startSubscriptionsForCurrentUser().catch(e => {
                    console.error('Failed to start app-global message subscriptions after local restore:', e);
                });

                await syncAndroidBackgroundMessagingFromPreference().catch(e => {
                    console.error('Failed to sync Android background messaging preference after local restore:', e);
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
 
                 await syncAndroidBackgroundMessagingFromPreference().catch(e => {
                       console.error('Failed to sync Android background messaging preference after nip07 restore:', e);
                   });

                   return true;
            } else if (method === 'amber') {
                const cachedHex = localStorage.getItem('nospeak:amber_pubkey_hex');
 
                if (!cachedHex) {
                    // Amber session without cached pubkey; force clean login instead of
                    // triggering a new get_public_key flow during restore.
                    localStorage.removeItem(AUTH_METHOD_KEY);
                    return false;
                }
 
                const s = new Nip55Signer(cachedHex);
                const pubkeyHex = cachedHex;
                const npub = nip19.npubEncode(pubkeyHex);
 
                signer.set(s);
                currentUser.set({ npub });
 
                await ensureRelaysAndHistory(npub, 'Restoration');
 
                 await messagingService.startSubscriptionsForCurrentUser().catch(e => {
                     console.error('Failed to start app-global message subscriptions after amber restore:', e);
                 });
 
                 await syncAndroidBackgroundMessagingFromPreference().catch(e => {
                       console.error('Failed to sync Android background messaging preference after amber restore:', e);
                   });

                   return true;
            } else if (method === 'nip46') {
                // Legacy NIP-46 sessions are no longer supported; clear persisted keys and require re-login.
                localStorage.removeItem(NIP46_SECRET_KEY);
                localStorage.removeItem(NIP46_URI_KEY);
                localStorage.removeItem(NIP46_BUNKER_PUBKEY_KEY);
                localStorage.removeItem(NIP46_BUNKER_RELAYS_KEY);
                localStorage.removeItem(AUTH_METHOD_KEY);
                return false;
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

         await clearAndroidLocalSecretKey().catch((e: unknown) => {
             console.error('Failed to clear Android local secret key on logout:', e);
         });

         localStorage.removeItem(STORAGE_KEY);

        localStorage.removeItem(AUTH_METHOD_KEY);
        localStorage.removeItem(NIP46_SECRET_KEY);
        localStorage.removeItem(NIP46_URI_KEY);
        localStorage.removeItem('nospeak:amber_pubkey_hex');
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
