import { db, type Profile } from './db';

export class ProfileRepository {
    private ttl: number = 24 * 60 * 60 * 1000; // 24 hours

    public async getProfile(npub: string): Promise<Profile | undefined> {
        const profile = await db.profiles.get(npub);
        if (profile) {
            if (Date.now() > profile.expiresAt) {
                // Expired, but return it while we might fetch new one?
                // Or let caller handle expiry. 
                // Return undefined to signal "need refresh"
                // But offline mode needs it.
                // We'll return it, but maybe add a flag?
                // For now, strict TTL logic usually means "it's stale".
                // But let's return it and let logic decide.
                // Actually, logic usually checks cache miss.
                // If I return undefined, it triggers fetch.
                return undefined; 
            }
            return profile;
        }
        return undefined;
    }

    public async getProfileIgnoreTTL(npub: string): Promise<Profile | undefined> {
        return await db.profiles.get(npub);
    }

    public async cacheProfile(
        npub: string,
        metadata: any,
        options: {
            messagingRelays?: string[];
            mediaServers?: string[];
        },
        nip05Info?: {
            status: 'valid' | 'invalid' | 'unknown';
            lastChecked: number;
            pubkey?: string;
            error?: string;
        }
    ) {
        const now = Date.now();
        const existing = await db.profiles.get(npub);

        const messagingRelays = options.messagingRelays ?? existing?.messagingRelays ?? [];
        const mediaServers = options.mediaServers ?? (existing as any)?.mediaServers ?? [];

        const profile: Profile = {
            npub,
            metadata: metadata ?? existing?.metadata,
            messagingRelays,
            mediaServers,
            cachedAt: now,
            expiresAt: now + this.ttl
        };

        if (nip05Info) {
            profile.nip05Status = nip05Info.status;
            profile.nip05LastChecked = nip05Info.lastChecked;
            profile.nip05Pubkey = nip05Info.pubkey;
            profile.nip05Error = nip05Info.error;
        } else if (existing) {
            const oldNip05 = existing.metadata?.nip05 ?? null;
            const newNip05 = profile.metadata?.nip05 ?? null;

            if (oldNip05 === newNip05) {
                profile.nip05Status = existing.nip05Status;
                profile.nip05LastChecked = existing.nip05LastChecked;
                profile.nip05Pubkey = existing.nip05Pubkey;
                profile.nip05Error = existing.nip05Error;
            }
        }
        
        await db.profiles.put(profile);
    }
}

export const profileRepo = new ProfileRepository();
