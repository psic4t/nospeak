// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Capacitor must be mockable so we can flip platform between tests.
const mockGetPlatform = vi.fn();
vi.mock('@capacitor/core', () => ({
    Capacitor: {
        getPlatform: () => mockGetPlatform()
    }
}));

// signer store stub. We expose a setter so each test can swap in a
// fake signer (or null).
const signerStore: { _value: any } = { _value: null };
vi.mock('$lib/stores/auth', () => ({
    signer: {
        subscribe: (run: (v: any) => void) => {
            run(signerStore._value);
            return () => {};
        }
    }
}));

import {
    warmAmberNipAcPermissions,
    clearAmberPermissionsWarmupFlag
} from './amberPermissionsWarmup';

const FLAG_KEY = 'nospeak:amber_nip_ac_warmed_v1';
const AUTH_METHOD_KEY = 'nospeak:auth_method';

/**
 * Install a real in-memory localStorage shim. The project's vitest
 * runner is invoked with `--localstorage-file` (which currently warns
 * about a missing path), so jsdom's localStorage is non-functional
 * by default. AuthService.test.ts uses the same pattern.
 */
function installLocalStorageShim(): void {
    const storageData: Record<string, string> = {};
    const impl: any = {
        get length() {
            return Object.keys(storageData).length;
        },
        key(index: number) {
            return Object.keys(storageData)[index] ?? null;
        },
        getItem(key: string) {
            return Object.prototype.hasOwnProperty.call(storageData, key)
                ? storageData[key]
                : null;
        },
        setItem(key: string, value: string) {
            storageData[key] = String(value);
        },
        removeItem(key: string) {
            delete storageData[key];
        },
        clear() {
            Object.keys(storageData).forEach((k) => delete storageData[k]);
        }
    };
    Object.defineProperty(globalThis, 'localStorage', {
        value: impl,
        configurable: true
    });
    if (typeof window !== 'undefined') {
        Object.defineProperty(window, 'localStorage', {
            value: impl,
            configurable: true
        });
    }
}

function setAmberAuth(): void {
    localStorage.setItem(AUTH_METHOD_KEY, 'amber');
}

function makeFakeSigner(opts: {
    pubkeyHex?: string;
    signImpl?: (event: any) => Promise<any>;
} = {}) {
    const pubkey = opts.pubkeyHex ?? 'a'.repeat(64);
    const signEvent =
        opts.signImpl ??
        vi.fn(async (event: any) => ({
            ...event,
            id: 'fake-id',
            sig: 'fake-sig'
        }));
    return {
        getPublicKey: vi.fn(async () => pubkey),
        signEvent: vi.fn(signEvent),
        encrypt: vi.fn(),
        decrypt: vi.fn()
    };
}

describe('warmAmberNipAcPermissions', () => {
    beforeEach(() => {
        installLocalStorageShim();
        localStorage.clear();
        signerStore._value = null;
        mockGetPlatform.mockReset();
        mockGetPlatform.mockReturnValue('android');
    });

    afterEach(() => {
        localStorage.clear();
    });

    it('no-ops on non-android platforms', async () => {
        mockGetPlatform.mockReturnValue('web');
        const fake = makeFakeSigner();
        signerStore._value = fake;
        setAmberAuth();

        await warmAmberNipAcPermissions();

        expect(fake.signEvent).not.toHaveBeenCalled();
        expect(localStorage.getItem(FLAG_KEY)).toBeNull();
    });

    it('no-ops when auth method is not amber', async () => {
        const fake = makeFakeSigner();
        signerStore._value = fake;
        localStorage.setItem(AUTH_METHOD_KEY, 'nsec');

        await warmAmberNipAcPermissions();

        expect(fake.signEvent).not.toHaveBeenCalled();
        expect(localStorage.getItem(FLAG_KEY)).toBeNull();
    });

    it('no-ops when the warmed flag is already set', async () => {
        const fake = makeFakeSigner();
        signerStore._value = fake;
        setAmberAuth();
        localStorage.setItem(FLAG_KEY, '1');

        await warmAmberNipAcPermissions();

        expect(fake.signEvent).not.toHaveBeenCalled();
        // flag should remain set
        expect(localStorage.getItem(FLAG_KEY)).toBe('1');
    });

    it('no-ops when no signer is attached', async () => {
        signerStore._value = null;
        setAmberAuth();

        await warmAmberNipAcPermissions();

        expect(localStorage.getItem(FLAG_KEY)).toBeNull();
    });

    it('signs dummy events for kinds 25050 and 25054 in order', async () => {
        const fake = makeFakeSigner();
        signerStore._value = fake;
        setAmberAuth();

        await warmAmberNipAcPermissions();

        expect(fake.signEvent).toHaveBeenCalledTimes(2);
        const firstCallEvent = (fake.signEvent.mock.calls[0] as any[])[0];
        const secondCallEvent = (fake.signEvent.mock.calls[1] as any[])[0];
        expect(firstCallEvent.kind).toBe(25050);
        expect(secondCallEvent.kind).toBe(25054);
    });

    it('Offer dummy carries the call-type=voice tag; Reject does not', async () => {
        const fake = makeFakeSigner();
        signerStore._value = fake;
        setAmberAuth();

        await warmAmberNipAcPermissions();

        const offerTags = ((fake.signEvent.mock.calls[0] as any[])[0]).tags as string[][];
        const rejectTags = ((fake.signEvent.mock.calls[1] as any[])[0]).tags as string[][];

        expect(offerTags.find((t) => t[0] === 'call-type')).toEqual([
            'call-type',
            'voice'
        ]);
        expect(rejectTags.find((t) => t[0] === 'call-type')).toBeUndefined();
        // Both must carry call-id and alt for clarity in the Amber prompt.
        expect(offerTags.find((t) => t[0] === 'call-id')).toBeDefined();
        expect(rejectTags.find((t) => t[0] === 'call-id')).toBeDefined();
        expect(offerTags.find((t) => t[0] === 'alt')).toBeDefined();
        expect(rejectTags.find((t) => t[0] === 'alt')).toBeDefined();
    });

    it('sets the warmed flag after a successful warmup', async () => {
        const fake = makeFakeSigner();
        signerStore._value = fake;
        setAmberAuth();

        await warmAmberNipAcPermissions();

        expect(localStorage.getItem(FLAG_KEY)).toBe('1');
    });

    it('continues past per-kind sign rejections and still sets the flag', async () => {
        let calls = 0;
        const fake = makeFakeSigner({
            signImpl: async () => {
                calls++;
                throw new Error(`amber rejected (call ${calls})`);
            }
        });
        signerStore._value = fake;
        setAmberAuth();

        await warmAmberNipAcPermissions();

        // Both attempts ran despite each throwing.
        expect(fake.signEvent).toHaveBeenCalledTimes(2);
        // Flag still set so we don't re-prompt at every launch.
        expect(localStorage.getItem(FLAG_KEY)).toBe('1');
    });

    it('continues past partial failure (first kind throws, second succeeds)', async () => {
        let i = 0;
        const fake = makeFakeSigner({
            signImpl: async (event: any) => {
                i++;
                if (i === 1) throw new Error('first attempt rejected');
                return { ...event, id: 'fake-id', sig: 'fake-sig' };
            }
        });
        signerStore._value = fake;
        setAmberAuth();

        await warmAmberNipAcPermissions();

        expect(fake.signEvent).toHaveBeenCalledTimes(2);
        expect(localStorage.getItem(FLAG_KEY)).toBe('1');
    });

    it('returns silently if getPublicKey throws', async () => {
        const fake = {
            getPublicKey: vi.fn(async () => {
                throw new Error('signer offline');
            }),
            signEvent: vi.fn(),
            encrypt: vi.fn(),
            decrypt: vi.fn()
        };
        signerStore._value = fake;
        setAmberAuth();

        await warmAmberNipAcPermissions();

        expect(fake.signEvent).not.toHaveBeenCalled();
        // Flag NOT set: caller hasn't actually had a chance to grant
        // anything, so let the next launch retry.
        expect(localStorage.getItem(FLAG_KEY)).toBeNull();
    });
});

describe('clearAmberPermissionsWarmupFlag', () => {
    beforeEach(() => {
        installLocalStorageShim();
        localStorage.clear();
    });

    afterEach(() => {
        localStorage.clear();
    });

    it('removes the warmed flag', () => {
        localStorage.setItem(FLAG_KEY, '1');
        clearAmberPermissionsWarmupFlag();
        expect(localStorage.getItem(FLAG_KEY)).toBeNull();
    });

    it('is idempotent when flag is absent', () => {
        clearAmberPermissionsWarmupFlag();
        expect(localStorage.getItem(FLAG_KEY)).toBeNull();
    });
});
