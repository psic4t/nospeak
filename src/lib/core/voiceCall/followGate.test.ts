// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nip19 } from 'nostr-tools';
import { followGate } from './followGate';

vi.mock('$lib/db/ContactRepository', () => ({
    contactRepo: {
        getContacts: vi.fn()
    }
}));

import { contactRepo } from '$lib/db/ContactRepository';

const HEX_FOLLOWED = 'f'.repeat(64);
const HEX_NOT_FOLLOWED = '1'.repeat(64);
const NPUB_FOLLOWED = nip19.npubEncode(HEX_FOLLOWED);

describe('NIP-AC follow gate', () => {
    beforeEach(() => {
        followGate._resetForTests();
        vi.mocked(contactRepo.getContacts).mockReset();
    });

    afterEach(() => {
        followGate._resetForTests();
    });

    it('returns false for any pubkey before the cache loads', () => {
        expect(followGate.isLoaded()).toBe(false);
        expect(followGate.isFollowed(HEX_FOLLOWED)).toBe(false);
    });

    it('after ensureLoaded, returns true for followed pubkey', async () => {
        vi.mocked(contactRepo.getContacts).mockResolvedValue([
            { npub: NPUB_FOLLOWED, createdAt: 0 }
        ]);
        await followGate.ensureLoaded();
        expect(followGate.isLoaded()).toBe(true);
        expect(followGate.isFollowed(HEX_FOLLOWED)).toBe(true);
    });

    it('after ensureLoaded, returns false for non-followed pubkey', async () => {
        vi.mocked(contactRepo.getContacts).mockResolvedValue([
            { npub: NPUB_FOLLOWED, createdAt: 0 }
        ]);
        await followGate.ensureLoaded();
        expect(followGate.isFollowed(HEX_NOT_FOLLOWED)).toBe(false);
    });

    it('coalesces concurrent ensureLoaded calls into a single DB read', async () => {
        let resolveFn: (v: any[]) => void = () => {};
        vi.mocked(contactRepo.getContacts).mockReturnValue(
            new Promise<any[]>((resolve) => {
                resolveFn = resolve;
            })
        );
        const a = followGate.ensureLoaded();
        const b = followGate.ensureLoaded();
        const c = followGate.ensureLoaded();

        // The repo getContacts call should have happened exactly once
        // even though we triggered three loads.
        expect(contactRepo.getContacts).toHaveBeenCalledTimes(1);
        resolveFn([{ npub: NPUB_FOLLOWED, createdAt: 0 }]);
        await Promise.all([a, b, c]);
        expect(followGate.isLoaded()).toBe(true);
    });

    it('refreshContactCache picks up newly added followers', async () => {
        vi.mocked(contactRepo.getContacts).mockResolvedValueOnce([]);
        await followGate.ensureLoaded();
        expect(followGate.isFollowed(HEX_FOLLOWED)).toBe(false);

        vi.mocked(contactRepo.getContacts).mockResolvedValueOnce([
            { npub: NPUB_FOLLOWED, createdAt: 0 }
        ]);
        await followGate.refreshContactCache();
        expect(followGate.isFollowed(HEX_FOLLOWED)).toBe(true);
    });

    it('handles malformed npub entries gracefully', async () => {
        vi.mocked(contactRepo.getContacts).mockResolvedValue([
            { npub: 'not-a-valid-npub', createdAt: 0 },
            { npub: NPUB_FOLLOWED, createdAt: 0 }
        ]);
        await followGate.ensureLoaded();
        expect(followGate.isLoaded()).toBe(true);
        expect(followGate.isFollowed(HEX_FOLLOWED)).toBe(true);
    });

    it('leaves cache unloaded if DB read throws', async () => {
        vi.mocked(contactRepo.getContacts).mockRejectedValue(new Error('db boom'));
        await followGate.ensureLoaded();
        expect(followGate.isLoaded()).toBe(false);
    });
});
