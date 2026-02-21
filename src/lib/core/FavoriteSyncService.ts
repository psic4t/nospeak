import { get } from 'svelte/store';
import { signer, currentUser } from '$lib/stores/auth';
import { nip19, Relay } from 'nostr-tools';

import { getBlasterRelayUrl, getDiscoveryRelays } from '$lib/core/runtimeConfig';

import { connectionManager } from './connection/instance';
import { favoriteRepo } from '$lib/db/FavoriteRepository';

const D_TAG = 'dm-favorites';
const KIND_BOOKMARK_SET = 30003;

export interface FavoriteSyncResult {
    attempted: number;
    succeeded: number;
    failed: number;
}

/**
 * Service for syncing message favorites to/from Nostr as Kind 30003 bookmark set.
 * 
 * Event structure:
 * - kind: 30003
 * - tags: [["d", "dm-favorites"]]
 * - content: NIP-44 encrypted JSON array of [["e", "<eventId>", "<conversationId>"], ...]
 */
export class FavoriteSyncService {
    /**
     * Publish current local favorites to relays as an encrypted Kind 30003 event.
     */
    async publishFavorites(): Promise<FavoriteSyncResult> {
        const currentSigner = get(signer);
        const currentUserData = get(currentUser);
        
        if (!currentSigner || !currentUserData) {
            console.warn('[FavoriteSyncService] Cannot publish favorites: user not authenticated');
            return { attempted: 0, succeeded: 0, failed: 0 };
        }

        try {
            // Get all local favorites
            const localFavorites = await favoriteRepo.getFavorites();
            
            // Build tags array from favorites
            const tags: string[][] = [];
            for (const favorite of localFavorites) {
                tags.push(['e', favorite.eventId, favorite.conversationId]);
            }

            // Get user's own pubkey for self-encryption
            const { data: userPubkey } = nip19.decode(currentUserData.npub);

            // Encrypt the tags array using NIP-44 (self-encryption)
            const tagsJson = JSON.stringify(tags);
            const encryptedContent = await currentSigner.encrypt(userPubkey as string, tagsJson);

            // Build the Kind 30003 event
            const event = {
                kind: KIND_BOOKMARK_SET,
                tags: [['d', D_TAG]],
                content: encryptedContent,
                created_at: Math.floor(Date.now() / 1000)
            };

            const signedEvent = await currentSigner.signEvent(event);

            // Publish to all relays: discovery + blaster + connected messaging relays
            const allRelays = new Set<string>([
                ...getDiscoveryRelays(),
                getBlasterRelayUrl(),
                ...connectionManager.getAllRelayHealth().map((h) => h.url)
            ]);

            // Publish to all relays in parallel for better performance
            const publishToRelay = async (relayUrl: string): Promise<boolean> => {
                try {
                    let relay = connectionManager.getRelayHealth(relayUrl)?.relay;
                    if (!relay) {
                        try {
                            relay = await Relay.connect(relayUrl);
                        } catch (e) {
                            console.warn(`[FavoriteSyncService] Could not connect to ${relayUrl}`);
                            return false;
                        }
                    }

                    const relayAny = relay as any;
                    if (!relayAny.onauth) {
                        relayAny.onauth = async (eventTemplate: any) => {
                            return await currentSigner.signEvent(eventTemplate);
                        };
                    }

                    try {
                        await relay.publish(signedEvent);
                    } catch (e) {
                        const message = (e as Error)?.message || String(e);
                        if (message.startsWith('auth-required')) {
                            connectionManager.markRelayAuthRequired?.(relayUrl);
                            if (connectionManager.getRelayHealth(relayUrl)) {
                                await connectionManager.authenticateRelay(relayUrl);
                            } else if (relayAny.auth && relayAny.onauth) {
                                await relayAny.auth(relayAny.onauth);
                            }
                            await relay.publish(signedEvent);
                        } else {
                            throw e;
                        }
                    }

                    console.log(`[FavoriteSyncService] Published favorites to ${relayUrl}`);
                    return true;
                } catch (e) {
                    console.warn(`[FavoriteSyncService] Failed to publish favorites to ${relayUrl}:`, e);
                    return false;
                }
            };

            const relayUrls = Array.from(allRelays);
            const results = await Promise.allSettled(relayUrls.map(publishToRelay));

            const attempted = relayUrls.length;
            const succeeded = results.filter(
                (r) => r.status === 'fulfilled' && r.value === true
            ).length;

            console.log(`[FavoriteSyncService] Published favorites: ${succeeded}/${attempted} relays succeeded`);
            return { attempted, succeeded, failed: attempted - succeeded };
        } catch (e) {
            console.error('[FavoriteSyncService] Failed to publish favorites:', e);
            return { attempted: 0, succeeded: 0, failed: 0 };
        }
    }

    /**
     * Fetch Kind 30003 dm-favorites from relays and replace local DB with relay state.
     * The relay event is authoritative — local favorites not present on the relay are removed.
     */
    async fetchAndSyncFavorites(): Promise<void> {
        const currentSigner = get(signer);
        const currentUserData = get(currentUser);

        if (!currentSigner || !currentUserData) {
            console.warn('[FavoriteSyncService] Cannot fetch favorites: user not authenticated');
            return;
        }

        try {
            const { data: userPubkey } = nip19.decode(currentUserData.npub);

            // Fetch Kind 30003 with d=dm-favorites from connected relays
            const filter = {
                kinds: [KIND_BOOKMARK_SET],
                authors: [userPubkey as string],
                '#d': [D_TAG],
                limit: 1
            };

            const event = await this.fetchLatestEvent(filter);
            if (!event) {
                console.log('[FavoriteSyncService] No dm-favorites event found on relays');
                return;
            }

            if (!event.content) {
                console.log('[FavoriteSyncService] dm-favorites event has empty content');
                return;
            }

            // Decrypt the content
            let decryptedContent: string;
            try {
                decryptedContent = await currentSigner.decrypt(userPubkey as string, event.content);
            } catch (e) {
                console.error('[FavoriteSyncService] Failed to decrypt favorites:', e);
                return;
            }

            // Parse the tags array
            let remoteTags: string[][];
            try {
                remoteTags = JSON.parse(decryptedContent);
            } catch (e) {
                console.error('[FavoriteSyncService] Failed to parse decrypted favorites:', e);
                return;
            }

            // Extract eventIds and conversationIds from e tags
            const remoteFavorites = remoteTags
                .filter(tag => tag[0] === 'e' && tag[1])
                .map(tag => ({ eventId: tag[1], conversationId: tag[2] || '' }));

            console.log(`[FavoriteSyncService] Found ${remoteFavorites.length} favorites on relay`);

            // Get local favorites for full sync
            const localEventIds = await favoriteRepo.getFavoriteEventIds();
            const remoteEventIds = new Set(remoteFavorites.map(f => f.eventId));

            // Add any remote favorites not in local
            let added = 0;
            for (const remote of remoteFavorites) {
                if (!localEventIds.has(remote.eventId)) {
                    await favoriteRepo.addFavorite(remote.eventId, remote.conversationId);
                    added++;
                    console.log(`[FavoriteSyncService] Added favorite from relay: ${remote.eventId.substring(0, 12)}...`);
                }
            }

            // Remove any local favorites not present on relay
            let removed = 0;
            for (const localId of localEventIds) {
                if (!remoteEventIds.has(localId)) {
                    await favoriteRepo.removeFavorite(localId);
                    removed++;
                    console.log(`[FavoriteSyncService] Removed local favorite not on relay: ${localId.substring(0, 12)}...`);
                }
            }

            console.log(`[FavoriteSyncService] Sync complete: ${added} added, ${removed} removed`);
        } catch (e) {
            console.error('[FavoriteSyncService] Failed to fetch and merge favorites:', e);
        }
    }

    /**
     * Fetch the latest event matching a filter from connected relays.
     */
    private async fetchLatestEvent(filter: any): Promise<any | null> {
        return new Promise((resolve) => {
            let latestEvent: any = null;
            let latestCreatedAt = 0;

            const timeout = setTimeout(() => {
                cleanup();
                resolve(latestEvent);
            }, 5000);

            const cleanup = connectionManager.subscribe([filter], (event) => {
                if (event.created_at > latestCreatedAt) {
                    latestCreatedAt = event.created_at;
                    latestEvent = event;
                }
            });

            // Also resolve early if we get an EOSE-like completion
            // For now just rely on the timeout
        });
    }
}

export const favoriteSyncService = new FavoriteSyncService();
