import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ProfileResolver } from './ProfileResolver';

/**
 * Regression tests for the bug where contacts' messagingRelays were being
 * populated from kind 10002 (NIP-65) public-note relay lists rather than
 * from kind 10050 (NIP-17) DM inbox lists. NIP-65 read/write relays often
 * differ entirely from where a user wants to *receive* DMs (e.g. a private
 * inbox like dm.nospeak.chat), so conflating the two was routing DMs to
 * the wrong relays after a fresh resolve.
 *
 * The desired behavior:
 *   - Kind 10050 → cacheProfile({ messagingRelays: [...] })
 *   - Kind 10002 → cacheProfile({ nip65Relays: [...] }), NEVER messagingRelays
 *   - Early-finalize ONLY on (kind 0 AND kind 10050); kind 10002 alone must
 *     not finalize, so we don't lose a slower-arriving kind 10050.
 *   - With only kind 0 + kind 10002, the resolver waits for the timeout and
 *     calls cacheProfile with messagingRelays: undefined.
 */

vi.mock('$lib/db/ProfileRepository', () => ({
    profileRepo: {
        getProfile: vi.fn(),
        getProfileIgnoreTTL: vi.fn(),
        cacheProfile: vi.fn()
    }
}));

vi.mock('./connection/instance', () => {
    return {
        connectionManager: {
            subscribe: vi.fn()
        }
    };
});

vi.mock('nostr-tools', () => ({
    nip19: {
        decode: vi.fn(() => ({ type: 'npub', data: 'pubkeyhex' }))
    }
}));

vi.mock('./AndroidProfileCache', () => ({
    extractKind0DisplayName: vi.fn(() => 'alice'),
    extractKind0Picture: vi.fn(() => undefined),
    cacheAndroidProfileIdentity: vi.fn(async () => undefined)
}));

vi.mock('$lib/core/runtimeConfig', () => ({
    getDiscoveryRelays: vi.fn(() => [])
}));

vi.mock('./Nip05Verifier', () => ({
    verifyNip05: vi.fn(async () => ({ status: 'unknown', checkedAt: Date.now() }))
}));

vi.mock('./BlossomServers', () => ({
    parseBlossomServerListEvent: vi.fn(() => [])
}));

type FakeEvent = { kind: number; content?: string; tags: any[][]; pubkey?: string };

/**
 * Drive a list of synthetic Nostr events into the resolver's subscription
 * callback in order. Returns a Promise that resolves once the resolver
 * itself resolves (early-finalize OR timeout).
 */
async function runResolverWith(
    events: FakeEvent[],
    options: { advanceTimers?: boolean } = {}
): Promise<void> {
    const { profileRepo } = await import('$lib/db/ProfileRepository');
    const { connectionManager } = await import('./connection/instance');

    (profileRepo.getProfile as any).mockResolvedValue(undefined);
    (profileRepo.getProfileIgnoreTTL as any).mockResolvedValue(undefined);
    (profileRepo.cacheProfile as any).mockResolvedValue(undefined);

    let captured: ((event: any) => void) | null = null;
    (connectionManager.subscribe as any).mockImplementation(
        (_filters: any, cb: (e: any) => void) => {
            captured = cb;
            // Return a cleanup function (resolver invokes this).
            return () => undefined;
        }
    );

    const resolver = new ProfileResolver();
    const promise = resolver.resolveProfile('npub1xxx', true);

    // Yield once so the resolver's Promise constructor body has run and
    // subscribe() has been invoked, capturing the callback.
    await Promise.resolve();
    await Promise.resolve();

    if (!captured) {
        throw new Error('Resolver did not call connectionManager.subscribe');
    }

    for (const e of events) {
        (captured as (event: any) => void)(e);
    }

    if (options.advanceTimers) {
        // Advance past the 3s safety timeout.
        await vi.advanceTimersByTimeAsync(3500);
    }

    await promise;
}

describe('ProfileResolver: NIP-17 vs NIP-65 separation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('writes messagingRelays from kind 10050 only, never from kind 10002', async () => {
        const { profileRepo } = await import('$lib/db/ProfileRepository');

        const kind0: FakeEvent = { kind: 0, content: '{"name":"alice"}', tags: [] };
        const kind10050: FakeEvent = {
            kind: 10050,
            tags: [
                ['relay', 'wss://dm.nospeak.chat'],
                ['relay', 'wss://nostr.data.haus/']
            ]
        };
        const kind10002: FakeEvent = {
            kind: 10002,
            tags: [
                ['r', 'wss://nos.lol/'],
                ['r', 'wss://nostr.land/'],
                ['r', 'wss://relay.mostr.pub/', 'write']
            ]
        };

        // Order matters: kind 10002 first to simulate the race that caused
        // the original bug.
        await runResolverWith([kind0, kind10002, kind10050]);

        expect(profileRepo.cacheProfile).toHaveBeenCalledTimes(1);
        const args = (profileRepo.cacheProfile as any).mock.calls[0];
        const options = args[2];

        expect(options.messagingRelays).toEqual([
            'wss://dm.nospeak.chat',
            'wss://nostr.data.haus/'
        ]);
        expect(options.nip65Relays).toEqual([
            'wss://nos.lol/',
            'wss://nostr.land/',
            'wss://relay.mostr.pub/'
        ]);
    });

    it('does not finalize early on kind 0 + kind 10002 alone (waits for 10050 or timeout)', async () => {
        vi.useFakeTimers();
        const { profileRepo } = await import('$lib/db/ProfileRepository');

        const kind0: FakeEvent = { kind: 0, content: '{}', tags: [] };
        const kind10002: FakeEvent = {
            kind: 10002,
            tags: [['r', 'wss://nos.lol/']]
        };

        // Only kind 0 + kind 10002 arrive. The 3s safety timeout must fire
        // before finalize runs.
        await runResolverWith([kind0, kind10002], { advanceTimers: true });

        expect(profileRepo.cacheProfile).toHaveBeenCalledTimes(1);
        const options = (profileRepo.cacheProfile as any).mock.calls[0][2];
        // No messagingRelays cached when only NIP-65 was seen.
        expect(options.messagingRelays).toBeUndefined();
        // But NIP-65 data is still preserved separately.
        expect(options.nip65Relays).toEqual(['wss://nos.lol/']);
    });

    it('early-finalizes on kind 0 + kind 10050 (no need to wait for 10002)', async () => {
        const { profileRepo } = await import('$lib/db/ProfileRepository');

        const kind0: FakeEvent = { kind: 0, content: '{}', tags: [] };
        const kind10050: FakeEvent = {
            kind: 10050,
            tags: [['relay', 'wss://dm.nospeak.chat']]
        };

        // No fake timers — if the resolver waited for the 3s timeout this
        // test would hang. Resolving in real-time proves early-finalize.
        await runResolverWith([kind0, kind10050]);

        expect(profileRepo.cacheProfile).toHaveBeenCalledTimes(1);
        const options = (profileRepo.cacheProfile as any).mock.calls[0][2];
        expect(options.messagingRelays).toEqual(['wss://dm.nospeak.chat']);
        expect(options.nip65Relays).toBeUndefined();
    });
});
