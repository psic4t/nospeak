import { describe, it, expect, vi, beforeEach } from 'vitest';

const { showMock, hideMock, addListenerMock } = vi.hoisted(() => ({
    showMock: vi.fn().mockResolvedValue(undefined),
    hideMock: vi.fn().mockResolvedValue(undefined),
    addListenerMock: vi.fn().mockResolvedValue({ remove: vi.fn() })
}));

vi.mock('$lib/core/AndroidBottomSheet', () => ({
    AndroidBottomSheet: {
        show: showMock,
        hide: hideMock,
        addListener: addListenerMock
    }
}));

import {
    showNativeBottomSheet,
    hideNativeBottomSheet,
    isNativeBottomSheetAvailable
} from './nativeBottomSheet';

describe('nativeBottomSheet', () => {
    const originalWindow = globalThis.window;

    beforeEach(() => {
        showMock.mockClear();
        hideMock.mockClear();
        addListenerMock.mockClear();

        if (originalWindow) {
            globalThis.window = originalWindow;
        }

        if (typeof window !== 'undefined') {
            (window as unknown as { Capacitor?: unknown }).Capacitor = undefined;
        }
    });

    describe('showNativeBottomSheet', () => {
        it('returns false when not in Android Capacitor shell', async () => {
            if (typeof window === 'undefined') {
                return;
            }

            const onDismiss = vi.fn();
            const result = await showNativeBottomSheet('settings', onDismiss);

            expect(result).toBe(false);
            expect(showMock).not.toHaveBeenCalled();
        });

        it('calls show plugin method in Android Capacitor shell', async () => {
            if (typeof window === 'undefined') {
                return;
            }

            (window as unknown as { Capacitor?: { getPlatform?: () => string } }).Capacitor = {
                getPlatform: () => 'android'
            };

            const onDismiss = vi.fn();
            const result = await showNativeBottomSheet('settings', onDismiss);

            expect(result).toBe(true);
            expect(showMock).toHaveBeenCalledWith({ id: 'settings' });
        });

        it('swallows errors from show calls', async () => {
            if (typeof window === 'undefined') {
                return;
            }

            (window as unknown as { Capacitor?: { getPlatform?: () => string } }).Capacitor = {
                getPlatform: () => 'android'
            };

            showMock.mockRejectedValueOnce(new Error('show failed'));

            const onDismiss = vi.fn();
            const result = await showNativeBottomSheet('settings', onDismiss);

            expect(result).toBe(false);
        });
    });

    describe('hideNativeBottomSheet', () => {
        it('no-ops when not in Android Capacitor shell', async () => {
            if (typeof window === 'undefined') {
                return;
            }

            await expect(hideNativeBottomSheet()).resolves.toBeUndefined();
            expect(hideMock).not.toHaveBeenCalled();
        });

        it('calls hide plugin method in Android Capacitor shell', async () => {
            if (typeof window === 'undefined') {
                return;
            }

            (window as unknown as { Capacitor?: { getPlatform?: () => string } }).Capacitor = {
                getPlatform: () => 'android'
            };

            await hideNativeBottomSheet();

            expect(hideMock).toHaveBeenCalled();
        });

        it('swallows errors from hide calls', async () => {
            if (typeof window === 'undefined') {
                return;
            }

            (window as unknown as { Capacitor?: { getPlatform?: () => string } }).Capacitor = {
                getPlatform: () => 'android'
            };

            hideMock.mockRejectedValueOnce(new Error('hide failed'));

            await expect(hideNativeBottomSheet()).resolves.toBeUndefined();
        });
    });

    describe('isNativeBottomSheetAvailable', () => {
        it('returns false when not in Android Capacitor shell', () => {
            if (typeof window === 'undefined') {
                return;
            }

            expect(isNativeBottomSheetAvailable()).toBe(false);
        });

        it('returns true in Android Capacitor shell with plugin available', () => {
            if (typeof window === 'undefined') {
                return;
            }

            (window as unknown as { Capacitor?: { getPlatform?: () => string } }).Capacitor = {
                getPlatform: () => 'android'
            };

            expect(isNativeBottomSheetAvailable()).toBe(true);
        });
    });
});
