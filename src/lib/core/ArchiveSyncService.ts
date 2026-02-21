import { get } from 'svelte/store';
import { signer, currentUser } from '$lib/stores/auth';
import { nip19, Relay } from 'nostr-tools';

import { getBlasterRelayUrl, getDiscoveryRelays } from '$lib/core/runtimeConfig';

import { connectionManager } from './connection/instance';
import { archiveRepo } from '$lib/db/ArchiveRepository';

const D_TAG = 'dm-archive';
const KIND_FOLLOW_SET = 30000;

export interface ArchiveSyncResult {
    attempted: number;
    succeeded: number;
    failed: number;
}

/**
 * Service for syncing archived chats to/from Nostr as Kind 30000 encrypted list.
 * 
 * Event structure:
 * - kind: 30000
 * - tags: [["d", "dm-archive"]]
 * - content: NIP-44 encrypted JSON array of [["e", "<conversationId>"], ...]
 */
export class ArchiveSyncService {
    /**
     * Publish current local archives to relays as an encrypted Kind 30000 event.
     */
    async publishArchives(): Promise<ArchiveSyncResult> {
        const currentSigner = get(signer);
        const currentUserData = get(currentUser);
        
        if (!currentSigner || !currentUserData) {
            console.warn('[ArchiveSyncService] Cannot publish archives: user not authenticated');
            return { attempted: 0, succeeded: 0, failed: 0 };
        }

        try {
            // Get all local archives
            const localArchives = await archiveRepo.getArchives();
            
            // Build tags array from archives
            // 1-on-1 DM archives have npub as conversationId → use "p" tag with hex pubkey
            // Group archives have a hash as conversationId → use "e" tag as-is
            const tags: string[][] = [];
            for (const archive of localArchives) {
                if (archive.conversationId.startsWith('npub1')) {
                    try {
                        const { data: pubkey } = nip19.decode(archive.conversationId);
                        tags.push(['p', pubkey as string]);
                    } catch (e) {
                        console.warn(`[ArchiveSyncService] Failed to decode npub: ${archive.conversationId}`, e);
                    }
                } else {
                    tags.push(['e', archive.conversationId]);
                }
            }

            // Get user's own pubkey for self-encryption
            const { data: userPubkey } = nip19.decode(currentUserData.npub);

            // Encrypt the tags array using NIP-44 (self-encryption)
            const tagsJson = JSON.stringify(tags);
            const encryptedContent = await currentSigner.encrypt(userPubkey as string, tagsJson);

            // Build the Kind 30000 event
            const event = {
                kind: KIND_FOLLOW_SET,
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
                            console.warn(`[ArchiveSyncService] Could not connect to ${relayUrl}`);
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

                    console.log(`[ArchiveSyncService] Published archives to ${relayUrl}`);
                    return true;
                } catch (e) {
                    console.warn(`[ArchiveSyncService] Failed to publish archives to ${relayUrl}:`, e);
                    return false;
                }
            };

            const relayUrls = Array.from(allRelays);
            const results = await Promise.allSettled(relayUrls.map(publishToRelay));

            const attempted = relayUrls.length;
            const succeeded = results.filter(
                (r) => r.status === 'fulfilled' && r.value === true
            ).length;

            console.log(`[ArchiveSyncService] Published archives: ${succeeded}/${attempted} relays succeeded`);
            return { attempted, succeeded, failed: attempted - succeeded };
        } catch (e) {
            console.error('[ArchiveSyncService] Failed to publish archives:', e);
            return { attempted: 0, succeeded: 0, failed: 0 };
        }
    }

    /**
     * Fetch Kind 30000 dm-archive from relays and replace local DB with relay state.
     * The relay event is authoritative — local archives not present on the relay are removed.
     */
    async fetchAndSyncArchives(): Promise<void> {
        const currentSigner = get(signer);
        const currentUserData = get(currentUser);

        if (!currentSigner || !currentUserData) {
            console.warn('[ArchiveSyncService] Cannot fetch archives: user not authenticated');
            return;
        }

        try {
            const { data: userPubkey } = nip19.decode(currentUserData.npub);

            // Fetch Kind 30000 with d=dm-archive from connected relays
            const filter = {
                kinds: [KIND_FOLLOW_SET],
                authors: [userPubkey as string],
                '#d': [D_TAG],
                limit: 1
            };

            const event = await this.fetchLatestEvent(filter);
            if (!event) {
                console.log('[ArchiveSyncService] No dm-archive event found on relays');
                return;
            }

            if (!event.content) {
                console.log('[ArchiveSyncService] dm-archive event has empty content');
                return;
            }

            // Decrypt the content
            let decryptedContent: string;
            try {
                decryptedContent = await currentSigner.decrypt(userPubkey as string, event.content);
            } catch (e) {
                console.error('[ArchiveSyncService] Failed to decrypt archives:', e);
                return;
            }

            // Parse the tags array
            let remoteTags: string[][];
            try {
                remoteTags = JSON.parse(decryptedContent);
            } catch (e) {
                console.error('[ArchiveSyncService] Failed to parse decrypted archives:', e);
                return;
            }

            // Extract conversationIds:
            // - "p" tags contain hex pubkeys (1-on-1 DMs) → convert to npub
            // - "e" tags contain group hashes (or legacy npub strings from older versions)
            const remoteArchives: string[] = [];
            for (const tag of remoteTags) {
                if (tag[0] === 'p' && tag[1]) {
                    try {
                        const npub = nip19.npubEncode(tag[1]);
                        remoteArchives.push(npub);
                    } catch (e) {
                        console.warn(`[ArchiveSyncService] Failed to encode pubkey to npub: ${tag[1]}`, e);
                    }
                } else if (tag[0] === 'e' && tag[1]) {
                    // Group archive hash, or legacy npub stored in "e" tag (backward compat)
                    remoteArchives.push(tag[1]);
                }
            }

            console.log(`[ArchiveSyncService] Found ${remoteArchives.length} archives on relay`);

            // Get local archives for full sync
            const localConversationIds = await archiveRepo.getArchivedConversationIds();
            const remoteConversationIds = new Set(remoteArchives);

            // Add any remote archives not in local
            let added = 0;
            for (const conversationId of remoteArchives) {
                if (!localConversationIds.has(conversationId)) {
                    await archiveRepo.addArchive(conversationId);
                    added++;
                    console.log(`[ArchiveSyncService] Added archive from relay: ${conversationId.substring(0, 12)}...`);
                }
            }

            // Remove any local archives not present on relay
            let removed = 0;
            for (const localId of localConversationIds) {
                if (!remoteConversationIds.has(localId)) {
                    await archiveRepo.removeArchive(localId);
                    removed++;
                    console.log(`[ArchiveSyncService] Removed local archive not on relay: ${localId.substring(0, 12)}...`);
                }
            }

            console.log(`[ArchiveSyncService] Sync complete: ${added} added, ${removed} removed`);
        } catch (e) {
            console.error('[ArchiveSyncService] Failed to fetch and merge archives:', e);
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

export const archiveSyncService = new ArchiveSyncService();
