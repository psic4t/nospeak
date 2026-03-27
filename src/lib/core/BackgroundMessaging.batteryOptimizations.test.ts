import { describe, expect, it, vi, beforeEach } from 'vitest';

const pluginMock = {
    getBatteryOptimizationStatus: vi.fn(),
    requestIgnoreBatteryOptimizations: vi.fn(),
    openAppBatterySettings: vi.fn(),
    start: vi.fn(),
    update: vi.fn(),
    stop: vi.fn(),
    drainQueuedEvents: vi.fn().mockResolvedValue({ events: '[]' })
};

vi.mock('@capacitor/core', () => ({
    Capacitor: {
        getPlatform: () => 'android'
    },
    registerPlugin: () => pluginMock
}));

vi.mock('./NativeDialogs', () => ({
    isAndroidNative: () => true
}));

vi.mock('./connection/instance', () => ({
    connectionManager: {
        setBackgroundModeEnabled: vi.fn()
    }
}));

vi.mock('./Messaging', () => ({
    messagingService: {
        processGiftWrapFromNativeQueue: vi.fn()
    }
}));

describe('BackgroundMessaging battery optimization prompt', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();

        const store: Record<string, string> = {};
        const storageImpl: Storage = {
            get length() {
                return Object.keys(store).length;
            },
            clear() {
                Object.keys(store).forEach((key) => delete store[key]);
            },
            getItem(key: string) {
                return Object.prototype.hasOwnProperty.call(store, key)
                    ? store[key]
                    : null;
            },
            key(index: number) {
                return Object.keys(store)[index] ?? null;
            },
            removeItem(key: string) {
                delete store[key];
            },
            setItem(key: string, value: string) {
                store[key] = String(value);
            }
        };

        Object.defineProperty(globalThis, 'localStorage', {
            value: storageImpl,
            configurable: true
        });

        Object.defineProperty(globalThis, 'window', {
            value: { localStorage: storageImpl },
            configurable: true
        });
    });

    it('requests ignore battery optimizations once per enable attempt', async () => {
        pluginMock.getBatteryOptimizationStatus.mockResolvedValue({
            isIgnoringBatteryOptimizations: false
        });
        pluginMock.requestIgnoreBatteryOptimizations.mockResolvedValue({ started: true });

        const module = await import('./BackgroundMessaging');

        await module.maybeRequestAndroidIgnoreBatteryOptimizationsForBackgroundMessaging();
        await module.maybeRequestAndroidIgnoreBatteryOptimizationsForBackgroundMessaging();

        expect(pluginMock.requestIgnoreBatteryOptimizations).toHaveBeenCalledTimes(1);
        expect(localStorage.getItem('nospeak_battery_optimizations_prompted')).toBe('1');
    });

    it('does not request when already ignoring battery optimizations', async () => {
        pluginMock.getBatteryOptimizationStatus.mockResolvedValue({
            isIgnoringBatteryOptimizations: true
        });

        const module = await import('./BackgroundMessaging');
        await module.maybeRequestAndroidIgnoreBatteryOptimizationsForBackgroundMessaging();

        expect(pluginMock.requestIgnoreBatteryOptimizations).not.toHaveBeenCalled();
        expect(localStorage.getItem('nospeak_battery_optimizations_prompted')).toBeNull();
    });

    it('clears the prompt sentinel when background messaging is disabled', async () => {
        localStorage.setItem('nospeak_battery_optimizations_prompted', '1');

        const module = await import('./BackgroundMessaging');
        await module.disableAndroidBackgroundMessaging();

        expect(localStorage.getItem('nospeak_battery_optimizations_prompted')).toBeNull();
    });
});
