import { get } from 'svelte/store';
import { signer, currentUser } from '$lib/stores/auth';
import { nip19, Relay } from 'nostr-tools';

import { getBlasterRelayUrl, getDiscoveryRelays } from '$lib/core/runtimeConfig';

import { connectionManager } from './connection/instance';
import { contactRepo } from '$lib/db/ContactRepository';
import { profileResolver } from './ProfileResolver';

const D_TAG = 'dm-contacts';
const KIND_FOLLOW_SET = 30000;

export interface ContactSyncResult {
    attempted: number;
    succeeded: number;
    failed: number;
}

/**
 * Service for syncing contacts to/from Nostr as Kind 30000 encrypted follow set.
 * 
 * Event structure:
 * - kind: 30000
 * - tags: [["d", "dm-contacts"]]
 * - content: NIP-44 encrypted JSON array of [["p", "<pubkey>"], ...]
 */
export class ContactSyncService {
    /**
     * Publish current local contacts to relays as an encrypted Kind 30000 event.
     */
    async publishContacts(): Promise<ContactSyncResult> {
        const currentSigner = get(signer);
        const currentUserData = get(currentUser);
        
        if (!currentSigner || !currentUserData) {
            console.warn('[ContactSyncService] Cannot publish contacts: user not authenticated');
            return { attempted: 0, succeeded: 0, failed: 0 };
        }

        try {
            // Get all local contacts
            const localContacts = await contactRepo.getContacts();
            
            // Convert npubs to pubkeys and build tags array
            const tags: string[][] = [];
            for (const contact of localContacts) {
                try {
                    const { data: pubkey } = nip19.decode(contact.npub);
                    tags.push(['p', pubkey as string]);
                } catch (e) {
                    console.warn(`[ContactSyncService] Failed to decode npub: ${contact.npub}`, e);
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
                            console.warn(`[ContactSyncService] Could not connect to ${relayUrl}`);
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

                    console.log(`[ContactSyncService] Published contacts to ${relayUrl}`);
                    return true;
                } catch (e) {
                    console.warn(`[ContactSyncService] Failed to publish contacts to ${relayUrl}:`, e);
                    return false;
                }
            };

            const relayUrls = Array.from(allRelays);
            const results = await Promise.allSettled(relayUrls.map(publishToRelay));

            const attempted = relayUrls.length;
            const succeeded = results.filter(
                (r) => r.status === 'fulfilled' && r.value === true
            ).length;

            console.log(`[ContactSyncService] Published contacts: ${succeeded}/${attempted} relays succeeded`);
            return { attempted, succeeded, failed: attempted - succeeded };
        } catch (e) {
            console.error('[ContactSyncService] Failed to publish contacts:', e);
            return { attempted: 0, succeeded: 0, failed: 0 };
        }
    }

    /**
     * Fetch Kind 30000 dm-contacts from relays and replace local DB with relay state.
     * The relay event is authoritative — local contacts not present on the relay are removed.
     */
    async fetchAndSyncContacts(): Promise<void> {
        const currentSigner = get(signer);
        const currentUserData = get(currentUser);

        if (!currentSigner || !currentUserData) {
            console.warn('[ContactSyncService] Cannot fetch contacts: user not authenticated');
            return;
        }

        try {
            const { data: userPubkey } = nip19.decode(currentUserData.npub);

            // Fetch Kind 30000 with d=dm-contacts from connected relays
            const filter = {
                kinds: [KIND_FOLLOW_SET],
                authors: [userPubkey as string],
                '#d': [D_TAG],
                limit: 1
            };

            const event = await this.fetchLatestEvent(filter);
            if (!event) {
                console.log('[ContactSyncService] No dm-contacts event found on relays');
                return;
            }

            if (!event.content) {
                console.log('[ContactSyncService] dm-contacts event has empty content');
                return;
            }

            // Decrypt the content
            let decryptedContent: string;
            try {
                decryptedContent = await currentSigner.decrypt(userPubkey as string, event.content);
            } catch (e) {
                console.error('[ContactSyncService] Failed to decrypt contacts:', e);
                return;
            }

            // Parse the tags array
            let remoteTags: string[][];
            try {
                remoteTags = JSON.parse(decryptedContent);
            } catch (e) {
                console.error('[ContactSyncService] Failed to parse decrypted contacts:', e);
                return;
            }

            // Extract pubkeys from p tags
            const remotePubkeys = remoteTags
                .filter(tag => tag[0] === 'p' && tag[1])
                .map(tag => tag[1]);

            console.log(`[ContactSyncService] Found ${remotePubkeys.length} contacts on relay`);

            // Get local contacts for full sync
            const localContacts = await contactRepo.getContacts();
            const localNpubs = new Set(localContacts.map(c => c.npub));

            // Build set of remote npubs for comparison
            const remoteNpubs = new Set<string>();
            for (const pubkey of remotePubkeys) {
                try {
                    remoteNpubs.add(nip19.npubEncode(pubkey));
                } catch (e) {
                    // Already warned during parsing, skip
                }
            }

            // Add any remote contacts not in local
            let added = 0;
            const newContactNpubs: string[] = [];
            for (const npub of remoteNpubs) {
                if (!localNpubs.has(npub)) {
                    // Add with lastReadAt=now so they don't appear as unread
                    const now = Date.now();
                    await contactRepo.addContact(npub, now, now);
                    newContactNpubs.push(npub);
                    added++;
                    console.log(`[ContactSyncService] Added contact from relay: ${npub.substring(0, 12)}...`);
                }
            }

            // Remove local contacts not present on relay
            let removed = 0;
            for (const local of localContacts) {
                if (!remoteNpubs.has(local.npub)) {
                    await contactRepo.removeContact(local.npub);
                    removed++;
                    console.log(`[ContactSyncService] Removed local contact not on relay: ${local.npub.substring(0, 12)}...`);
                }
            }

            console.log(`[ContactSyncService] Sync complete: ${added} added, ${removed} removed`);

            // Batch resolve profiles for newly added contacts
            if (newContactNpubs.length > 0) {
                console.log(`[ContactSyncService] Resolving profiles for ${newContactNpubs.length} new contacts...`);
                try {
                    await profileResolver.resolveProfilesBatch(newContactNpubs);
                } catch (e) {
                    console.warn('[ContactSyncService] Batch profile resolution failed:', e);
                    // Non-fatal - contacts are added, profiles can be resolved later
                }
            }
        } catch (e) {
            console.error('[ContactSyncService] Failed to fetch and merge contacts:', e);
        }
    }

    /**
     * Fetch the latest event matching a filter from connected relays.
     * Uses fetchEvents which resolves on EOSE from all relays (with 5s safety timeout).
     */
    private async fetchLatestEvent(filter: any): Promise<any | null> {
        const events = await connectionManager.fetchEvents([filter], 5000);
        if (events.length === 0) return null;
        return events.reduce((latest, e) =>
            e.created_at > latest.created_at ? e : latest
        );
    }
}

export const contactSyncService = new ContactSyncService();
