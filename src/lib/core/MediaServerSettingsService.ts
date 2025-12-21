import { get } from 'svelte/store';
import { Relay } from 'nostr-tools';

import { profileRepo } from '$lib/db/ProfileRepository';
import { currentUser, signer } from '$lib/stores/auth';

import { DEFAULT_DISCOVERY_RELAYS } from './connection/Discovery';
import { connectionManager } from './connection/instance';
import { normalizeBlossomServerUrl } from './BlossomServers';

export interface MediaServerPublishResult {
    attempted: number;
    succeeded: number;
    failed: number;
}

export class MediaServerSettingsService {
    public async updateSettings(mediaServers: string[]): Promise<MediaServerPublishResult> {
        const currentUserData = get(currentUser);
        if (currentUserData) {
            const profile = await profileRepo.getProfileIgnoreTTL(currentUserData.npub);
            await profileRepo.cacheProfile(
                currentUserData.npub,
                profile?.metadata,
                {
                    messagingRelays: profile?.messagingRelays ?? [],
                    mediaServers
                },
                undefined
            );
        }

        return await this.publishServerList(mediaServers);
    }

    private async publishServerList(mediaServers: string[]): Promise<MediaServerPublishResult> {
        const currentSigner = get(signer);
        const currentUserData = get(currentUser);

        if (!currentSigner || !currentUserData) {
            throw new Error('User not authenticated');
        }

        const tags: string[][] = [];
        const seen = new Set<string>();

        for (const server of mediaServers) {
            const normalized = normalizeBlossomServerUrl(server);
            if (!normalized || seen.has(normalized)) continue;

            seen.add(normalized);
            tags.push(['server', normalized]);
        }

        const event = {
            kind: 10063,
            tags,
            content: '',
            created_at: Math.floor(Date.now() / 1000)
        };

        const signedEvent = await currentSigner.signEvent(event);

        const profile = await profileRepo.getProfileIgnoreTTL(currentUserData.npub);
        const messagingRelays = profile?.messagingRelays ?? [];

        const allRelays = new Set<string>([
            ...DEFAULT_DISCOVERY_RELAYS,
            'wss://sendit.nosflare.com',
            ...connectionManager.getAllRelayHealth().map((h) => h.url),
            ...messagingRelays
        ]);

        let attempted = 0;
        let succeeded = 0;

        for (const relayUrl of allRelays) {
            attempted++;
            try {
                let relay = connectionManager.getRelayHealth(relayUrl)?.relay;
                if (!relay) {
                    try {
                        relay = await Relay.connect(relayUrl);
                    } catch {
                        console.warn(`Could not connect to ${relayUrl} to publish media servers`);
                        continue;
                    }
                }

                const relayAny = relay as any;
                if (!relayAny.onauth) {
                    relayAny.onauth = async (eventTemplate: any) => {
                        return await currentSigner.signEvent(eventTemplate);
                    };
                }

                try {
                    await relay.publish(signedEvent as any);
                } catch (e) {
                    const message = (e as Error)?.message || String(e);
                    if (message.startsWith('auth-required')) {
                        connectionManager.markRelayAuthRequired?.(relayUrl);
                        if (connectionManager.getRelayHealth(relayUrl)) {
                            await connectionManager.authenticateRelay(relayUrl);
                        } else if (relayAny.auth && relayAny.onauth) {
                            await relayAny.auth(relayAny.onauth);
                        }
                        await relay.publish(signedEvent as any);
                    } else {
                        throw e;
                    }
                }

                console.log(`Published media server list to ${relayUrl}`);
                succeeded++;
            } catch (e) {
                console.error(`Failed to publish media server list to ${relayUrl}:`, e);
            }
        }

        return {
            attempted,
            succeeded,
            failed: attempted - succeeded
        };
    }
}

export const mediaServerSettingsService = new MediaServerSettingsService();
