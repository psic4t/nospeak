import { beforeEach, describe, expect, it, vi } from 'vitest';
import { writable } from 'svelte/store';

const getProfileIgnoreTTLSpy = vi.fn();
const updateSettingsSpy = vi.fn();

vi.mock('$lib/stores/auth', async () => {
    return {
        currentUser: writable({ npub: 'npub-test' })
    };
});

vi.mock('$lib/db/ProfileRepository', async () => {
    return {
        profileRepo: {
            getProfileIgnoreTTL: getProfileIgnoreTTLSpy
        }
    };
});

vi.mock('./MediaServerSettingsService', async () => {
    return {
        mediaServerSettingsService: {
            updateSettings: updateSettingsSpy
        }
    };
});

async function loadModule() {
    return await import('./DefaultBlossomServers');
}

describe('ensureDefaultBlossomServersForCurrentUser', () => {
    beforeEach(() => {
        getProfileIgnoreTTLSpy.mockReset();
        updateSettingsSpy.mockReset();
    });

    it('returns existing servers without setting defaults', async () => {
        getProfileIgnoreTTLSpy.mockResolvedValueOnce({ mediaServers: ['https://cdn.example.com'] });

        const module = await loadModule();
        const result = await module.ensureDefaultBlossomServersForCurrentUser();

        expect(result).toEqual({
            servers: ['https://cdn.example.com'],
            didSetDefaults: false
        });
        expect(updateSettingsSpy).not.toHaveBeenCalled();
    });

    it('sets defaults when no servers configured', async () => {
        const module = await loadModule();

        getProfileIgnoreTTLSpy
            .mockResolvedValueOnce({ mediaServers: [] })
            .mockResolvedValueOnce({ mediaServers: [...module.DEFAULT_BLOSSOM_SERVERS] });

        const result = await module.ensureDefaultBlossomServersForCurrentUser();

        expect(updateSettingsSpy).toHaveBeenCalledWith([...module.DEFAULT_BLOSSOM_SERVERS]);
        expect(result).toEqual({
            servers: [...module.DEFAULT_BLOSSOM_SERVERS],
            didSetDefaults: true
        });
    });
});
