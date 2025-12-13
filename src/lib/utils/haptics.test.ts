import { describe, it, expect, vi, beforeEach } from 'vitest';

const { impactMock } = vi.hoisted(() => ({
    impactMock: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('@capacitor/haptics', () => ({
    Haptics: {
        impact: impactMock
    },
    ImpactStyle: {
        Light: 'light'
    }
}));

import { softVibrate } from './haptics';

describe('softVibrate', () => {
    const originalWindow = globalThis.window;

    beforeEach(() => {
        impactMock.mockClear();

        if (originalWindow) {
            globalThis.window = originalWindow;
        }

        if (typeof window !== 'undefined') {
            (window as unknown as { Capacitor?: unknown }).Capacitor = undefined;
        }
    });

    it('no-ops when not in Android Capacitor shell', () => {
        if (typeof window === 'undefined') {
            return;
        }

        (window as unknown as { Capacitor?: unknown }).Capacitor = undefined;

        expect(() => softVibrate()).not.toThrow();
        expect(impactMock).not.toHaveBeenCalled();
    });

    it('invokes Capacitor Haptics impact in Android Capacitor shell', () => {
        if (typeof window === 'undefined') {
            return;
        }

        (window as unknown as { Capacitor?: { getPlatform?: () => string } }).Capacitor = {
            getPlatform: () => 'android'
        };

        expect(() => softVibrate()).not.toThrow();
        expect(impactMock).toHaveBeenCalledWith({ style: 'light' });
    });
});
