import { get } from 'svelte/store';
import { signer, currentUser } from '$lib/stores/auth';
import { connectionManager } from './connection/instance';
import { DEFAULT_DISCOVERY_RELAYS } from './connection/Discovery';
import { Relay } from 'nostr-tools';
import { profileRepo } from '$lib/db/ProfileRepository';

export interface UserMetadata {
    name?: string;
    about?: string;
    picture?: string;
    banner?: string;
    nip05?: string;
    website?: string;
    display_name?: string;
    lud16?: string;
    [key: string]: any;
}

export class ProfileService {
    public async updateProfile(metadata: UserMetadata): Promise<void> {
        const currentUserData = get(currentUser);
        const currentSigner = get(signer);

        if (!currentUserData || !currentSigner) {
            throw new Error('User not authenticated');
        }

        // 1. Update Profile Repo Cache
        // We need to preserve existing relays when updating profile metadata
        const existingProfile = await profileRepo.getProfileIgnoreTTL(currentUserData.npub);
        await profileRepo.cacheProfile(
            currentUserData.npub,
            metadata,
            existingProfile?.readRelays || [],
            existingProfile?.writeRelays || []
        );

        // 2. Create and Sign Kind 0 Event
        const event = {
            kind: 0,
            tags: [] as string[][],
            content: JSON.stringify(metadata),
            created_at: Math.floor(Date.now() / 1000),
            pubkey: (await currentSigner.getPublicKey())
        };

        const signedEvent = await currentSigner.signEvent(event);

        // 3. Publish to relays
        // Target: Blaster + Connected + Configured Read/Write
        
        // Get configured relays from profile
        const readRelays = existingProfile?.readRelays || [];
        const writeRelays = existingProfile?.writeRelays || [];

        const allRelays = new Set([
            ...DEFAULT_DISCOVERY_RELAYS,
            'wss://sendit.nosflare.com', // Blaster relay
            ...connectionManager.getAllRelayHealth().map(h => h.url),
            ...readRelays,
            ...writeRelays
        ]);

        console.log(`Publishing profile update to ${allRelays.size} relays...`);

        // We execute publish in parallel but don't wait for all to finish successfully
        // We just await the promises to ensure they are fired.
        // Actually, we should probably wait for at least one success or just fire and forget?
        // RelaySettingsService awaits them sequentially-ish (loop with await inside).
        // Let's do parallel for speed, but wait for completion.
        
        const publishPromises = Array.from(allRelays).map(async (relayUrl) => {
            try {
                // Reuse existing connection if available
                let relay = connectionManager.getRelayHealth(relayUrl)?.relay;
                let shouldClose = false;

                if (!relay) {
                    try {
                        relay = await Relay.connect(relayUrl);
                        shouldClose = true;
                    } catch (e) {
                        console.warn(`Could not connect to ${relayUrl} to publish profile`);
                        return;
                    }
                }

                await relay.publish(signedEvent);
                console.log(`Published profile to ${relayUrl}`);

                if (shouldClose) {
                    relay.close();
                }
            } catch (e) {
                console.error(`Failed to publish profile to ${relayUrl}:`, e);
            }
        });

        await Promise.all(publishPromises);
    }
}

export const profileService = new ProfileService();
