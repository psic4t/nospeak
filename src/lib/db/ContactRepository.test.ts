import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ContactRepository } from './ContactRepository';

/**
 * Regression test: removing a contact must also clear any cached
 * messagingRelays for that contact's profile row, so a stale list (e.g.
 * one written by an older buggy resolver run that conflated NIP-65 with
 * NIP-17) cannot survive contact deletion and continue to misroute DMs
 * the next time the contact is re-added.
 */

vi.mock('./db', () => {
    const contacts = {
        put: vi.fn(async () => undefined),
        delete: vi.fn(async () => undefined),
        get: vi.fn(async () => undefined),
        update: vi.fn(async () => undefined),
        toArray: vi.fn(async () => [])
    };
    const profiles = {
        get: vi.fn(async () => undefined),
        update: vi.fn(async () => undefined)
    };
    return {
        db: { contacts, profiles }
    };
});

describe('ContactRepository.removeContact', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('clears cached messagingRelays on the corresponding profile row', async () => {
        const { db } = await import('./db');

        // Profile row exists with a stale messagingRelays list.
        (db.profiles.get as any).mockResolvedValueOnce({
            npub: 'npub1xxx',
            metadata: { name: 'alice' },
            messagingRelays: ['wss://wrong-relay.example'],
            mediaServers: [],
            cachedAt: Date.now(),
            expiresAt: Date.now() + 1000
        });

        const repo = new ContactRepository();
        await repo.removeContact('npub1xxx');

        expect(db.contacts.delete).toHaveBeenCalledWith('npub1xxx');
        expect(db.profiles.update).toHaveBeenCalledWith('npub1xxx', { messagingRelays: [] });
    });

    it('does not touch profiles table if no profile row exists', async () => {
        const { db } = await import('./db');

        (db.profiles.get as any).mockResolvedValueOnce(undefined);

        const repo = new ContactRepository();
        await repo.removeContact('npub1nonexistent');

        expect(db.contacts.delete).toHaveBeenCalledWith('npub1nonexistent');
        expect(db.profiles.update).not.toHaveBeenCalled();
    });

    it('still deletes the contact even if profile cache cleanup throws', async () => {
        const { db } = await import('./db');

        (db.profiles.get as any).mockRejectedValueOnce(new Error('boom'));
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

        const repo = new ContactRepository();
        await expect(repo.removeContact('npub1xxx')).resolves.toBeUndefined();

        expect(db.contacts.delete).toHaveBeenCalledWith('npub1xxx');
        warnSpy.mockRestore();
    });
});
