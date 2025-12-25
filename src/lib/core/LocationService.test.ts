import { beforeEach, describe, expect, it, vi } from 'vitest';

let platform: string = 'web';

const getCurrentPositionMock = vi.fn();

vi.mock('@capacitor/core', () => ({
    Capacitor: {
        getPlatform: () => platform
    }
}));

vi.mock('./AndroidLocation', () => ({
    AndroidLocation: {
        getCurrentPosition: getCurrentPositionMock
    }
}));

describe('LocationService', () => {
    beforeEach(() => {
        platform = 'web';
        getCurrentPositionMock.mockReset();
        vi.resetModules();

        delete (globalThis as any).window;
        delete (globalThis as any).navigator;
    });

    it('throws when window is not available', async () => {
        const module = await import('./LocationService');

        await expect(module.getCurrentPosition()).rejects.toThrow('Geolocation is not available');
    });

    it('uses AndroidLocation plugin on Android', async () => {
        platform = 'android';
        (globalThis as any).window = {};

        getCurrentPositionMock.mockResolvedValue({
            latitude: 52.52,
            longitude: 13.405
        });

        const module = await import('./LocationService');
        const result = await module.getCurrentPosition();

        expect(getCurrentPositionMock).toHaveBeenCalledTimes(1);
        expect(result).toEqual({
            latitude: 52.52,
            longitude: 13.405
        });
    });

    it('uses navigator.geolocation on web', async () => {
        platform = 'web';
        (globalThis as any).window = {};

        const browserGetPosition = vi.fn((success: (pos: any) => void) => {
            success({
                coords: {
                    latitude: 1.23,
                    longitude: 4.56
                }
            });
        });

        (globalThis as any).navigator = {
            geolocation: {
                getCurrentPosition: browserGetPosition
            }
        };

        const module = await import('./LocationService');
        const result = await module.getCurrentPosition();

        expect(browserGetPosition).toHaveBeenCalledTimes(1);
        expect(result).toEqual({
            latitude: 1.23,
            longitude: 4.56
        });
    });
});
