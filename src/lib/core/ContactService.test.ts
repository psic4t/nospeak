import { describe, it, expect, beforeEach, vi } from 'vitest';

const { resolveProfileMock, addContactMock, publishContactsMock } = vi.hoisted(() => ({
    resolveProfileMock: vi.fn(),
    addContactMock: vi.fn(),
    publishContactsMock: vi.fn()
}));

vi.mock('$lib/core/ProfileResolver', () => ({
    profileResolver: {
        resolveProfile: resolveProfileMock
    }
}));

vi.mock('$lib/db/ContactRepository', () => ({
    contactRepo: {
        addContact: addContactMock
    }
}));

vi.mock('$lib/core/ContactSyncService', () => ({
    contactSyncService: {
        publishContacts: publishContactsMock
    }
}));

import { addContactByNpub } from './ContactService';

describe('addContactByNpub', () => {
    beforeEach(() => {
        resolveProfileMock.mockReset().mockResolvedValue(undefined);
        addContactMock.mockReset().mockResolvedValue(undefined);
        publishContactsMock.mockReset().mockResolvedValue({ attempted: 0, succeeded: 0, failed: 0 });
    });

    it('trims and adds a valid npub', async () => {
        await addContactByNpub('  npub1validkey ');

        expect(addContactMock).toHaveBeenCalledWith('npub1validkey', expect.any(Number), expect.any(Number));
        // Profile resolution and sync happen in background (fire-and-forget)
        expect(resolveProfileMock).toHaveBeenCalledWith('npub1validkey', true);
        expect(publishContactsMock).toHaveBeenCalled();
    });

    it('throws for a non-npub value', async () => {
        await expect(addContactByNpub('not-a-npub')).rejects.toThrow('Invalid npub');
        expect(resolveProfileMock).not.toHaveBeenCalled();
        expect(addContactMock).not.toHaveBeenCalled();
    });
});
