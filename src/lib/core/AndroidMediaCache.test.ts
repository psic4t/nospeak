import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Capacitor before importing the module
vi.mock('@capacitor/core', () => ({
    Capacitor: {
        getPlatform: vi.fn().mockReturnValue('web'),
    },
    registerPlugin: vi.fn().mockReturnValue(null)
}));

describe('AndroidMediaCache', () => {
    beforeEach(() => {
        vi.resetModules();
        // Reset localStorage mock
        (globalThis as any).localStorage = {
            getItem: vi.fn().mockReturnValue(null),
            setItem: vi.fn()
        };
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('isMediaCacheEnabled', () => {
        it('returns false when not on Android', async () => {
            const { isMediaCacheEnabled } = await import('./AndroidMediaCache');
            expect(isMediaCacheEnabled()).toBe(false);
        });

        it('returns false when setting is not present', async () => {
            const { Capacitor } = await import('@capacitor/core');
            vi.mocked(Capacitor.getPlatform).mockReturnValue('android');
            
            (globalThis as any).localStorage = {
                getItem: vi.fn().mockReturnValue(null)
            };

            const { isMediaCacheEnabled } = await import('./AndroidMediaCache');
            // Still returns false because Capacitor plugin is null on web
            expect(isMediaCacheEnabled()).toBe(false);
        });
    });

    describe('saveToMediaCache', () => {
        it('returns failure when not on Android', async () => {
            const { saveToMediaCache } = await import('./AndroidMediaCache');
            const blob = new Blob(['test'], { type: 'image/jpeg' });
            const result = await saveToMediaCache('abc123', 'image/jpeg', blob);
            expect(result).toEqual({ success: false });
        });

        it('returns failure when sha256 is empty', async () => {
            const { saveToMediaCache } = await import('./AndroidMediaCache');
            const blob = new Blob(['test'], { type: 'image/jpeg' });
            const result = await saveToMediaCache('', 'image/jpeg', blob);
            expect(result).toEqual({ success: false });
        });
    });
});

describe('AndroidMediaCache on Android', () => {
    const mockSaveToCache = vi.fn();

    beforeEach(() => {
        vi.resetModules();
        
        // Mock as Android platform with plugin available
        vi.doMock('@capacitor/core', () => ({
            Capacitor: {
                getPlatform: () => 'android',
            },
            registerPlugin: () => ({
                saveToCache: mockSaveToCache
            })
        }));

        // Mock localStorage with media cache enabled
        (globalThis as any).localStorage = {
            getItem: vi.fn().mockReturnValue(JSON.stringify({ mediaCacheEnabled: true })),
            setItem: vi.fn()
        };

        // Mock window for isAndroidNative check
        (globalThis as any).window = {};

        mockSaveToCache.mockReset();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('saveToMediaCache calls native plugin when available', async () => {
        mockSaveToCache.mockResolvedValue({ success: true });

        const { saveToMediaCache } = await import('./AndroidMediaCache');
        const blob = new Blob(['test data'], { type: 'image/jpeg' });
        const result = await saveToMediaCache('abc123def456', 'image/jpeg', blob, 'photo.jpg');

        expect(mockSaveToCache).toHaveBeenCalledWith({
            sha256: 'abc123def456',
            mimeType: 'image/jpeg',
            base64Data: expect.any(String),
            filename: 'photo.jpg'
        });
        expect(result).toEqual({ success: true });
    });

    it('saveToMediaCache handles native plugin failure', async () => {
        mockSaveToCache.mockResolvedValue({ success: false });

        const { saveToMediaCache } = await import('./AndroidMediaCache');
        const blob = new Blob(['test data'], { type: 'image/jpeg' });
        const result = await saveToMediaCache('abc123def456', 'image/jpeg', blob);

        expect(result).toEqual({ success: false });
    });
});
