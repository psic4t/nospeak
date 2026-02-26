import { describe, expect, it, vi } from 'vitest';

import { ProfileResolver } from './ProfileResolver';


vi.mock('$lib/db/ProfileRepository', () => {
    return {
        profileRepo: {
            getProfile: vi.fn(),
            cacheProfile: vi.fn()
        }
    };
});

vi.mock('./connection/instance', () => {
    return {
        connectionManager: {
            subscribe: vi.fn(() => () => undefined)
        }
    };
});

vi.mock('nostr-tools', () => {
    return {
        nip19: {
            decode: vi.fn(() => ({ type: 'npub', data: 'pubkeyhex' }))
        }
    };
});

vi.mock('./AndroidProfileCache', () => {
    return {
        extractKind0DisplayName: vi.fn(() => 'alice'),
        extractKind0Picture: vi.fn(() => 'https://example.com/a.png'),
        cacheAndroidProfileIdentity: vi.fn(async () => undefined)
    };
});


describe('ProfileResolver android identity cache', () => {
    it('pushes username/avatar when profile is cached', async () => {
        const { profileRepo } = await import('$lib/db/ProfileRepository');
        const { cacheAndroidProfileIdentity } = await import('./AndroidProfileCache');
        const { connectionManager } = await import('./connection/instance');

        (profileRepo.getProfile as any).mockResolvedValue({
            npub: 'npub1cached',
            metadata: { name: 'alice', picture: 'https://example.com/a.png' },
            messagingRelays: [],
            cachedAt: Date.now(),
            expiresAt: Date.now() + 10000
        });

        const resolver = new ProfileResolver();
        await resolver.resolveProfile('npub1cached', false);

        expect(connectionManager.subscribe).not.toHaveBeenCalled();
        expect(cacheAndroidProfileIdentity).toHaveBeenCalledTimes(1);
        expect(cacheAndroidProfileIdentity).toHaveBeenCalledWith({
            pubkeyHex: 'pubkeyhex',
            username: 'alice',
            picture: 'https://example.com/a.png',
            updatedAt: expect.any(Number)
        });
    });
});
