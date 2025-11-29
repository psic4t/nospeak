import { connectionManager } from './instance';
import { profileResolver } from '../ProfileResolver';
import { profileRepo } from '$lib/db/ProfileRepository';

export const DEFAULT_DISCOVERY_RELAYS = [
    'wss://nostr.data.haus',
    'wss://relay.damus.io',
    'wss://nos.lol',
    'wss://relay.primal.net',
    'wss://purplepag.es'
];

export async function discoverUserRelays(npub: string) {
    console.log('Starting relay discovery for', npub);

    // 0. Clear all existing relays to ensure clean state
    connectionManager.clearAllRelays();

    // 1. Connect to discovery relays (Temporary)
    for (const url of DEFAULT_DISCOVERY_RELAYS) {
        connectionManager.addTemporaryRelay(url);
    }

    // Wait a bit for connections
    await new Promise(r => setTimeout(r, 1000));

    // 2. Resolve Profile (fetches Kind 0 and 10002 and caches them)
    await profileResolver.resolveProfile(npub, true);

    // 3. Connect to user relays from cache
    const profile = await profileRepo.getProfile(npub);
    if (profile) {
        // Only connect Read relays permanently for receiving messages
        if (profile.readRelays && profile.readRelays.length > 0) {
            for (const url of profile.readRelays) {
                connectionManager.addPersistentRelay(url);
            }
        }
    } else {
        console.log('No profile found after discovery');
    }

    // 4. Cleanup discovery relays - they were only needed for profile resolution
    connectionManager.cleanupTemporaryConnections();
}
