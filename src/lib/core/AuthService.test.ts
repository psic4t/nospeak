import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AuthService } from './AuthService';

vi.mock('$app/navigation', () => ({
    goto: vi.fn()
}));

vi.mock('$lib/stores/auth', () => {
    return {
        signer: { set: vi.fn() },
        currentUser: { set: vi.fn() }
    };
});

vi.mock('./connection/instance', () => ({
    connectionManager: {
        stop: vi.fn(),
        addPersistentRelay: vi.fn(),
        addTemporaryRelay: vi.fn(),
        fetchEvents: vi.fn(),
        subscribe: vi.fn(),
        getConnectedRelays: vi.fn(),
        cleanupTemporaryConnections: vi.fn()
    },
    retryQueue: {
        enqueue: vi.fn()
    }
}));

vi.mock('$lib/db/db', () => ({
    db: {
        clearAll: vi.fn().mockResolvedValue(undefined)
    }
}));

vi.mock('$lib/db/ProfileRepository', () => ({
    profileRepo: {
        getProfileIgnoreTTL: vi.fn(),
        getProfile: vi.fn(),
        updateProfile: vi.fn()
    }
}));

vi.mock('./Messaging', () => ({
    messagingService: {
        fetchHistory: vi.fn().mockResolvedValue({ totalFetched: 0, processed: 0 })
    }
}));

vi.mock('$lib/core/signer/LocalSigner', () => ({
    LocalSigner: vi.fn()
}));

vi.mock('$lib/core/signer/Nip07Signer', () => ({
    Nip07Signer: {
        clearCache: vi.fn()
    }
}));

vi.mock('$lib/core/signer/Nip46Signer', () => ({
    Nip46Signer: vi.fn()
}));

vi.mock('nostr-tools', () => ({
    nip19: {
        npubEncode: vi.fn()
    },
    generateSecretKey: vi.fn(),
    getPublicKey: vi.fn(),
    SimplePool: vi.fn()
}));

vi.mock('nostr-tools/nip46', () => ({
    BunkerSigner: {
        fromURI: vi.fn().mockResolvedValue({
            connect: vi.fn(),
            getPublicKey: vi.fn(),
            bp: { pubkey: 'test', relays: [] }
        }),
        fromBunker: vi.fn().mockReturnValue({
            getPublicKey: vi.fn()
        })
    },
    createNostrConnectURI: vi.fn()
}));


describe('AuthService.logout localStorage cleanup', () => {
    let authService: AuthService;

    beforeEach(async () => {
        vi.clearAllMocks();

        const storageData: Record<string, string> = {};
        const storageImpl: any = {
            get length() {
                return Object.keys(storageData).length;
            },
            key(index: number) {
                const keys = Object.keys(storageData);
                return keys[index] ?? null;
            },
            getItem(key: string) {
                return Object.prototype.hasOwnProperty.call(storageData, key) ? storageData[key] : null;
            },
            setItem(key: string, value: string) {
                storageData[key] = String(value);
            },
            removeItem(key: string) {
                delete storageData[key];
            },
            clear() {
                Object.keys(storageData).forEach((key) => delete storageData[key]);
            }
        };

        Object.defineProperty(globalThis, 'localStorage', {
            value: storageImpl,
            configurable: true
        });

        if (typeof window !== 'undefined') {
            Object.defineProperty(window, 'localStorage', {
                value: storageImpl,
                configurable: true
            });
        }

        // Seed auth-related and settings-related keys
        localStorage.setItem('nospeak:nsec', 'test-nsec');
        localStorage.setItem('nospeak:auth_method', 'local');
        localStorage.setItem('nospeak:nip46_secret', 'secret');
        localStorage.setItem('nospeak:nip46_uri', 'uri');
        localStorage.setItem('nospeak-settings', JSON.stringify({ notificationsEnabled: true }));
        localStorage.setItem('nospeak-theme', 'mocha');
        localStorage.setItem('nospeak-theme-mode', 'dark');
        localStorage.setItem('nospeak:custom', 'value');
        localStorage.setItem('nospeak-custom-dash', 'value');

        // Unrelated key that should not be touched
        localStorage.setItem('unrelated-key', 'keep');

        const module = await import('./AuthService');
        authService = new module.AuthService();
    });

    it('clears all nospeak auth and settings keys but preserves unrelated keys', async () => {
        await authService.logout();

        expect(localStorage.getItem('nospeak:nsec')).toBeNull();
        expect(localStorage.getItem('nospeak:auth_method')).toBeNull();
        expect(localStorage.getItem('nospeak:nip46_secret')).toBeNull();
        expect(localStorage.getItem('nospeak:nip46_uri')).toBeNull();
        expect(localStorage.getItem('nospeak-settings')).toBeNull();
        expect(localStorage.getItem('nospeak-theme')).toBeNull();
        expect(localStorage.getItem('nospeak-theme-mode')).toBeNull();
        expect(localStorage.getItem('nospeak:custom')).toBeNull();
        expect(localStorage.getItem('nospeak-custom-dash')).toBeNull();

        expect(localStorage.getItem('unrelated-key')).toBe('keep');
    });
});
