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
import {
    beginLoginSyncFlow,
    completeLoginSyncFlow,
    setLoginSyncActiveStep,
    setSyncError,
    addRelayError,
    setCanDismiss,
    setBackgroundMode,
    resetSyncFlow,
    syncState,
    type LoginSyncStepId
} from '$lib/stores/sync';
import { showEmptyProfileModal } from '$lib/stores/modals';
import { isAndroidNative } from './NativeDialogs';
import { notificationService } from './NotificationService';
import { clearAndroidLocalSecretKey, getAndroidLocalSecretKeyHex, setAndroidLocalSecretKeyHex } from './AndroidLocalSecretKey';
import { contactSyncService } from './ContactSyncService';
import { showToast } from '$lib/stores/toast';
import { get } from 'svelte/store';

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

const SYNC_GLOBAL_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const SYNC_DISMISS_DELAY_MS = 2 * 60 * 1000; // 2 minutes

export class AuthService {
    private lastLoginNpub: string | null = null;
    private lastLoginContext: string = '';

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
        this.lastLoginNpub = npub;
        this.lastLoginContext = context;

        let dismissTimer: ReturnType<typeof setTimeout> | null = null;
        let timeoutTimer: ReturnType<typeof setTimeout> | null = null;
        let isTimedOut = false;

        const cleanup = () => {
            if (dismissTimer) {
                clearTimeout(dismissTimer);
                dismissTimer = null;
            }
            if (timeoutTimer) {
                clearTimeout(timeoutTimer);
                timeoutTimer = null;
            }
        };

        try {
            const existingProfile = await profileRepo.getProfileIgnoreTTL(npub);
            const hasCachedRelays = !!existingProfile && (
                existingProfile.messagingRelays && existingProfile.messagingRelays.length > 0
            );

            const totalMessages = await messageRepo.countMessages('ALL');
            const isFirstSync = totalMessages === 0;

            beginLoginSyncFlow(isFirstSync);

            // Set up dismiss timer (2 minutes)
            dismissTimer = setTimeout(() => {
                setCanDismiss(true);
            }, SYNC_DISMISS_DELAY_MS);

            // Set up global timeout (5 minutes)
            const timeoutPromise = new Promise<never>((_, reject) => {
                timeoutTimer = setTimeout(() => {
                    isTimedOut = true;
                    reject(new Error('SYNC_TIMEOUT'));
                }, SYNC_GLOBAL_TIMEOUT_MS);
            });

            // Run the actual sync flow
            const syncPromise = this.runLoginHistoryFlowInternal(npub, context, hasCachedRelays);

            await Promise.race([syncPromise, timeoutPromise]);

        } catch (error) {
            const state = get(syncState);
            const errorMessage = isTimedOut
                ? 'Sync timed out after 5 minutes'
                : (error instanceof Error ? error.message : 'Sync failed');

            console.error(`${context} login history flow failed:`, error);

            // Only show error UI if not in background mode
            if (!state.isBackgroundMode) {
                setSyncError(errorMessage);
            }
            return; // Don't complete flow if there's an error - let user retry or skip
        } finally {
            cleanup();

            const state = get(syncState);

            // If we're in background mode, show toast and complete
            if (state.isBackgroundMode) {
                showToast('Sync completed', 'success');
                completeLoginSyncFlow();
                this.startPostSyncServices();
            } else if (!state.hasError) {
                // Normal completion
                completeLoginSyncFlow();
                this.startPostSyncServices();
            }
            // If hasError, we leave the modal open for retry/skip
        }
    }

    private async runLoginHistoryFlowInternal(
        npub: string,
        context: string,
        hasCachedRelays: boolean
    ): Promise<void> {
        const trackRelayError = (url: string, error: unknown, step: LoginSyncStepId) => {
            const errorMsg = error instanceof Error ? error.message : String(error);
            addRelayError(url, errorMsg, step);
            console.error(`${context} relay error on ${url} during ${step}:`, error);
        };

        if (!hasCachedRelays) {
            // 1. Connect to discovery relays
            setLoginSyncActiveStep('connect-discovery-relays');
            connectionManager.clearAllRelays();
            for (const url of getDiscoveryRelays()) {
                try {
                    connectionManager.addTemporaryRelay(url);
                } catch (error) {
                    trackRelayError(url, error, 'connect-discovery-relays');
                }
            }
            await new Promise(resolve => setTimeout(resolve, 1000));

            // 2. Fetch and cache the user's messaging relays
            setLoginSyncActiveStep('fetch-messaging-relays');
            try {
                await profileResolver.resolveProfile(npub, true);
            } catch (error) {
                console.error(`${context} failed to fetch messaging relays:`, error);
                // Continue anyway - we might have partial data
            }
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
            try {
                connectionManager.addPersistentRelay(url);
            } catch (error) {
                trackRelayError(url, error, 'connect-read-relays');
            }
        }

        // 4. Fetch and merge contacts from Kind 30000 event
        // Note: Must happen BEFORE history fetch so we have the full contact list
        // before auto-adding contacts from messages (prevents overwriting saved contacts)
        setLoginSyncActiveStep('fetch-contacts');
        try {
            await contactSyncService.fetchAndMergeContacts();
        } catch (error) {
            console.error(`${context} contact sync failed:`, error);
            // Non-fatal - continue with flow
        }

        // 5. Fetch and cache history items from relays
        // Note: Discovery relays stay connected so autoAddContact can resolve profiles
        // Defer contact publishing during history fetch to batch all changes at the end
        setLoginSyncActiveStep('fetch-history');
        messagingService.setDeferContactPublish(true);
        try {
            await messagingService.fetchHistory();
        } catch (error) {
            console.error(`${context} history fetch failed:`, error);
            // Track as generic relay error
            addRelayError('relays', error instanceof Error ? error.message : 'History fetch failed', 'fetch-history');
        } finally {
            messagingService.setDeferContactPublish(false);
        }

        // Publish contacts once after history sync (captures any new contacts from messages)
        try {
            await contactSyncService.publishContacts();
        } catch (error) {
            console.error(`${context} contact publish after history failed:`, error);
        }

        // 6. Fetch and cache user profile
        setLoginSyncActiveStep('fetch-user-profile');
        try {
            await profileResolver.resolveProfile(npub, false);
        } catch (error) {
            console.error(`${context} user profile refresh failed:`, error);
        }

        // Cleanup discovery relays, keep user's persistent messaging relays
        connectionManager.cleanupTemporaryConnections();

        // Notify UI that profiles have been updated
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('nospeak:profiles-updated'));
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
    }

    private startPostSyncServices(): void {
        // Start app-global message subscriptions once login history flow completes
        messagingService.startSubscriptionsForCurrentUser().catch(e => {
            console.error('Failed to start app-global message subscriptions after login flow:', e);
        });

        // Sync Android background messaging with the saved preference once startup flow completes
        syncAndroidBackgroundMessagingFromPreference().catch(e => {
            console.error('Failed to sync Android background messaging preference after login flow:', e);
        });
    }

    public async retrySyncFlow(): Promise<void> {
        if (!this.lastLoginNpub) {
            console.error('Cannot retry sync: no previous login npub');
            return;
        }

        resetSyncFlow();
        await this.runLoginHistoryFlow(this.lastLoginNpub, this.lastLoginContext || 'Retry');
    }

    public skipSyncAndContinue(): void {
        const state = get(syncState);

        // Mark as background mode - sync continues but modal closes
        setBackgroundMode();

        // If there was an error, we need to complete the flow
        if (state.hasError) {
            completeLoginSyncFlow();
        }

        // Start post-sync services anyway
        this.startPostSyncServices();

        // Show toast when done (if sync is still running, it will show when it completes)
        if (state.hasError) {
            showToast('Sync skipped', 'info');
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

                    // Fire-and-forget: local contacts are already in IndexedDB,
                    // autoAddContact will handle any new contacts from messages
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
