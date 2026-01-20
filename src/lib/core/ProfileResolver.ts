import { connectionManager } from './connection/instance';
import { profileRepo } from '$lib/db/ProfileRepository';
import { nip19 } from 'nostr-tools';
import { verifyNip05 } from './Nip05Verifier';
import { cacheAndroidProfileIdentity, extractKind0Picture, extractKind0Username } from './AndroidProfileCache';
import { parseBlossomServerListEvent } from './BlossomServers';
import { getDiscoveryRelays } from '$lib/core/runtimeConfig';

export class ProfileResolver {
    
    public async resolveProfile(npub: string, forceRefresh: boolean = false): Promise<void> {
        // 1. Try cache
        const cached = await profileRepo.getProfile(npub);
        if (cached && !forceRefresh) {
            try {
                const decoded = nip19.decode(npub);
                const pubkey = typeof decoded.data === 'string' ? decoded.data : null;
                const username = extractKind0Username(cached.metadata);
                if (pubkey && username) {
                    await cacheAndroidProfileIdentity({
                        pubkeyHex: pubkey,
                        username,
                        picture: extractKind0Picture(cached.metadata) ?? undefined,
                        updatedAt: Date.now()
                    });
                }
            } catch (e) {
                console.warn('Failed to cache Android profile identity from cached profile:', e);
            }

            console.log(`Using cached profile for ${npub}`);
            return;
        }

        // 2. Fetch from network
        const { data } = nip19.decode(npub);
        const pubkey = data as string;

        console.log(`Fetching profile for ${npub}...`);

        const filters = [
            {
                kinds: [0, 10050, 10002, 10063],
                authors: [pubkey],
                limit: 10 // Get multiple to ensure we catch both kinds if they exist
            }
        ];
 
        const buildNip05Info = async (currentMetadata: any): Promise<{
            status: 'valid' | 'invalid' | 'unknown';
            lastChecked: number;
            pubkey?: string;
            error?: string;
        } | undefined> => {
            if (!currentMetadata || !currentMetadata.nip05) {
                return undefined;
            }

            const existing = await profileRepo.getProfileIgnoreTTL(npub);
            const now = Date.now();
            const NIP05_TTL_MS = 24 * 60 * 60 * 1000;

            const sameNip05 = existing?.metadata?.nip05 === currentMetadata.nip05;
            const lastChecked = existing?.nip05LastChecked ?? 0;
            const fresh = sameNip05 && lastChecked > 0 && (now - lastChecked) < NIP05_TTL_MS;

            if (fresh && existing?.nip05Status) {
                return {
                    status: existing.nip05Status,
                    lastChecked,
                    pubkey: existing.nip05Pubkey,
                    error: existing.nip05Error
                };
            }

            const result = await verifyNip05(currentMetadata.nip05, pubkey);
            return {
                status: result.status,
                lastChecked: result.checkedAt,
                pubkey: result.matchedPubkey,
                error: result.error
            };
        };

        return new Promise<void>((resolve) => {
            let metadata: any = null;
            let messagingRelays: string[] = [];
            let mediaServers: string[] = [];
            let foundProfile = false;
            let foundMessagingRelays = false;
            let foundMediaServers = false;
            let foundNip65Relays = false;
 
            const finalize = async () => {
                const nip05Info = await buildNip05Info(metadata);
                await profileRepo.cacheProfile(
                    npub,
                    metadata,
                    {
                        messagingRelays: (foundMessagingRelays || foundNip65Relays) ? messagingRelays : undefined,
                        mediaServers: foundMediaServers ? mediaServers : undefined
                    },
                    nip05Info
                );

                const username = extractKind0Username(metadata);
                if (username) {
                    await cacheAndroidProfileIdentity({
                        pubkeyHex: pubkey,
                        username,
                        picture: extractKind0Picture(metadata) ?? undefined,
                        updatedAt: Date.now()
                    });
                }

                resolve();
            };

            // Simple timeout
            const timeout = setTimeout(() => {
                cleanup();
                finalize();
            }, 3000);

            const cleanup = connectionManager.subscribe(filters, (event) => {
                if (event.kind === 0 && !foundProfile) {
                    try {
                        metadata = JSON.parse(event.content);
                        foundProfile = true;
                    } catch (e) {
                        console.error('Failed to parse profile metadata', e);
                    }
                } else if (event.kind === 10050 && !foundMessagingRelays) {
                    const parsed = this.parseMessagingRelayList(event);
                    messagingRelays = parsed;
                    foundMessagingRelays = true;
                } else if (event.kind === 10063 && !foundMediaServers) {
                    mediaServers = parseBlossomServerListEvent(event);
                    foundMediaServers = true;
                } else if (event.kind === 10002 && !foundNip65Relays && !foundMessagingRelays) {
                    const parsed = this.parseNIP65RelayList(event);
                    messagingRelays = Array.from(new Set([...(parsed.read || []), ...(parsed.write || [])]));
                    foundNip65Relays = true;
                }
 
                if (foundProfile && (foundMessagingRelays || foundNip65Relays)) {
                    clearTimeout(timeout);
                    cleanup();
                    void finalize();
                }
            }, {
                extraRelays: getDiscoveryRelays()
            });
        });
    }

    private parseMessagingRelayList(event: any): string[] {
        const urls: string[] = [];
        const seen = new Set<string>();
 
        for (const tag of event.tags) {
            if (tag.length < 2 || tag[0] !== 'relay') continue;
 
            const url = tag[1];
            if (!url || seen.has(url)) continue;
 
            seen.add(url);
            urls.push(url);
        }
 
        return urls;
    }
 
    private parseNIP65RelayList(event: any): { read: string[], write: string[] } {
        const read: string[] = [];
        const write: string[] = [];
        const seenRead = new Set<string>();
        const seenWrite = new Set<string>();
 
        for (const tag of event.tags) {
            if (tag.length < 2 || tag[0] !== 'r') continue;
            
            const url = tag[1];
            if (!url) continue;

            const marker = tag.length >= 3 ? tag[2] : '';

            if (marker === 'read') {
                if (!seenRead.has(url)) {
                    read.push(url);
                    seenRead.add(url);
                }
            } else if (marker === 'write') {
                if (!seenWrite.has(url)) {
                    write.push(url);
                    seenWrite.add(url);
                }
            } else {
                // Both
                if (!seenRead.has(url)) {
                    read.push(url);
                    seenRead.add(url);
                }
                if (!seenWrite.has(url)) {
                    write.push(url);
                    seenWrite.add(url);
                }
            }
        }

        return { read, write };
    }
}

export const profileResolver = new ProfileResolver();
