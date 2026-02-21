import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';
import {
    hashPin,
    verifyPin,
    enablePin,
    disablePin,
    unlockWithPin,
    lockApp,
    initPinState,
    clearPinData,
    isPinLocked,
    isPinEnabled
} from './pin';

// Set up a proper localStorage mock with clear()
function createLocalStorageMock() {
    const data: Record<string, string> = {};
    return {
        getItem: (key: string) => data[key] ?? null,
        setItem: (key: string, value: string) => { data[key] = String(value); },
        removeItem: (key: string) => { delete data[key]; },
        clear: () => { Object.keys(data).forEach(k => delete data[k]); },
        get length() { return Object.keys(data).length; },
        key: (index: number) => Object.keys(data)[index] ?? null
    };
}

beforeEach(() => {
    const storageMock = createLocalStorageMock();

    Object.defineProperty(globalThis, 'localStorage', {
        value: storageMock,
        configurable: true
    });

    if (typeof window !== 'undefined') {
        Object.defineProperty(window, 'localStorage', {
            value: storageMock,
            configurable: true
        });
    }

    isPinLocked.set(false);
    isPinEnabled.set(false);
});

describe('hashPin', () => {
    it('returns a 64-character hex string', async () => {
        const hash = await hashPin('1234');
        expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('returns same hash for same input', async () => {
        const hash1 = await hashPin('1234');
        const hash2 = await hashPin('1234');
        expect(hash1).toBe(hash2);
    });

    it('returns different hash for different input', async () => {
        const hash1 = await hashPin('1234');
        const hash2 = await hashPin('5678');
        expect(hash1).not.toBe(hash2);
    });
});

describe('enablePin', () => {
    it('stores hash in localStorage and sets pinEnabled in settings', async () => {
        await enablePin('1234');

        expect(localStorage.getItem('nospeak:pin_hash')).toBeTruthy();
        const settings = JSON.parse(localStorage.getItem('nospeak-settings') || '{}');
        expect(settings.pinEnabled).toBe(true);
        expect(get(isPinEnabled)).toBe(true);
    });

    it('preserves existing settings when enabling', async () => {
        localStorage.setItem('nospeak-settings', JSON.stringify({ notificationsEnabled: true }));
        await enablePin('1234');

        const settings = JSON.parse(localStorage.getItem('nospeak-settings') || '{}');
        expect(settings.notificationsEnabled).toBe(true);
        expect(settings.pinEnabled).toBe(true);
    });
});

describe('verifyPin', () => {
    it('returns true for correct PIN', async () => {
        await enablePin('1234');
        const result = await verifyPin('1234');
        expect(result).toBe(true);
    });

    it('returns false for wrong PIN', async () => {
        await enablePin('1234');
        const result = await verifyPin('5678');
        expect(result).toBe(false);
    });

    it('returns false when no PIN is stored', async () => {
        const result = await verifyPin('1234');
        expect(result).toBe(false);
    });
});

describe('disablePin', () => {
    it('removes hash and sets pinEnabled to false', async () => {
        await enablePin('1234');
        disablePin();

        expect(localStorage.getItem('nospeak:pin_hash')).toBeNull();
        const settings = JSON.parse(localStorage.getItem('nospeak-settings') || '{}');
        expect(settings.pinEnabled).toBe(false);
        expect(get(isPinEnabled)).toBe(false);
        expect(get(isPinLocked)).toBe(false);
    });
});

describe('unlockWithPin', () => {
    it('unlocks with correct PIN', async () => {
        await enablePin('1234');
        isPinLocked.set(true);

        const result = await unlockWithPin('1234');
        expect(result).toBe(true);
        expect(get(isPinLocked)).toBe(false);
    });

    it('stays locked with wrong PIN', async () => {
        await enablePin('1234');
        isPinLocked.set(true);

        const result = await unlockWithPin('9999');
        expect(result).toBe(false);
        expect(get(isPinLocked)).toBe(true);
    });
});

describe('lockApp', () => {
    it('locks when PIN is enabled', () => {
        isPinEnabled.set(true);
        lockApp();
        expect(get(isPinLocked)).toBe(true);
    });

    it('does not lock when PIN is disabled', () => {
        isPinEnabled.set(false);
        lockApp();
        expect(get(isPinLocked)).toBe(false);
    });
});

describe('initPinState', () => {
    it('locks app when PIN is enabled and hash exists', async () => {
        await enablePin('1234');
        // Reset stores to simulate fresh app load
        isPinEnabled.set(false);
        isPinLocked.set(false);

        const shouldLock = initPinState();
        expect(shouldLock).toBe(true);
        expect(get(isPinEnabled)).toBe(true);
        expect(get(isPinLocked)).toBe(true);
    });

    it('does not lock when PIN is not enabled', () => {
        const shouldLock = initPinState();
        expect(shouldLock).toBe(false);
        expect(get(isPinEnabled)).toBe(false);
        expect(get(isPinLocked)).toBe(false);
    });

    it('does not lock when pinEnabled but hash is missing', () => {
        localStorage.setItem('nospeak-settings', JSON.stringify({ pinEnabled: true }));
        // No hash stored

        const shouldLock = initPinState();
        expect(shouldLock).toBe(false);
        expect(get(isPinEnabled)).toBe(false);
    });
});

describe('clearPinData', () => {
    it('removes all PIN data', async () => {
        await enablePin('1234');
        isPinLocked.set(true);

        clearPinData();

        expect(localStorage.getItem('nospeak:pin_hash')).toBeNull();
        expect(get(isPinEnabled)).toBe(false);
        expect(get(isPinLocked)).toBe(false);
    });
});
