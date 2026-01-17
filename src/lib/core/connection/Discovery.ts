import { profileRepo } from '$lib/db/ProfileRepository';
import { getDiscoveryRelays } from '$lib/core/runtimeConfig';

import { connectionManager } from './instance';
import { profileResolver } from '../ProfileResolver';

export async function discoverUserRelays(npub: string, isCurrentUser: boolean = false) {
    console.log(`Starting relay discovery for ${npub} (isCurrentUser: ${isCurrentUser})`);

    // 0. Only clear all existing relays if this is the current user initializing
    if (isCurrentUser) {
        connectionManager.clearAllRelays();
    }

    // 1. Connect to discovery relays (Temporary)
    for (const url of getDiscoveryRelays()) {
        connectionManager.addTemporaryRelay(url);
    }

    // Wait for at least one discovery relay to connect (max 5 seconds)
    const maxWait = 5000;
    const checkInterval = 100;
    let waited = 0;
    while (connectionManager.getConnectedRelays().length === 0 && waited < maxWait) {
        await new Promise(r => setTimeout(r, checkInterval));
        waited += checkInterval;
    }

    // 2. Resolve Profile (fetches Kind 0 and 10002 and caches them)
    await profileResolver.resolveProfile(npub, true);

    // 3. Connect to user relays from cache
    const profile = await profileRepo.getProfile(npub);
    if (profile) {
        // Only connect messaging relays permanently if it is the current user
        if (profile.messagingRelays && profile.messagingRelays.length > 0) {
            for (const url of profile.messagingRelays) {
                if (isCurrentUser) {
                    connectionManager.addPersistentRelay(url);
                } else {
                    // For contacts, we rely on ProfileResolver to have fetched what we need.
                    // If we need to connect to their relays, we should do it explicitly elsewhere
                    // or use addTemporaryRelay here if the intention was to spy on them.
                    // But given the bug report, we should NOT make them persistent.
                }
            }
        }
    } else {
        console.log('No profile found after discovery');
    }

    // 4. Cleanup discovery relays - they were only needed for profile resolution
    connectionManager.cleanupTemporaryConnections();
}
