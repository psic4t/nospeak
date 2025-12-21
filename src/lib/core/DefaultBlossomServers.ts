import { get } from 'svelte/store';

import { profileRepo } from '$lib/db/ProfileRepository';
import { currentUser } from '$lib/stores/auth';

import { mediaServerSettingsService } from './MediaServerSettingsService';

export const DEFAULT_BLOSSOM_SERVERS = [
    'https://blossom.primal.net',
    'https://24242.io'
] as const;

export async function ensureDefaultBlossomServersForCurrentUser(): Promise<{
    servers: string[];
    didSetDefaults: boolean;
}> {
    const user = get(currentUser);
    if (!user?.npub) {
        throw new Error('Not authenticated');
    }

    const profile = await profileRepo.getProfileIgnoreTTL(user.npub);
    const servers = profile?.mediaServers ?? [];

    if (servers.length > 0) {
        return { servers, didSetDefaults: false };
    }

    await mediaServerSettingsService.updateSettings([...DEFAULT_BLOSSOM_SERVERS]);

    const refreshed = await profileRepo.getProfileIgnoreTTL(user.npub);
    return {
        servers: refreshed?.mediaServers ?? [...DEFAULT_BLOSSOM_SERVERS],
        didSetDefaults: true
    };
}
