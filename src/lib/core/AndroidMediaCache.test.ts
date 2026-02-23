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

    describe('fetchDecryptAndSaveToGallery', () => {
        it('returns failure when not on Android', async () => {
            const { fetchDecryptAndSaveToGallery } = await import('./AndroidMediaCache');
            const result = await fetchDecryptAndSaveToGallery(
                ['https://example.com/file'], 'aabb', '1122', 'abc123', 'video/mp4'
            );
            expect(result).toEqual({ success: false });
        });

        it('returns failure when sha256 is empty', async () => {
            const { fetchDecryptAndSaveToGallery } = await import('./AndroidMediaCache');
            const result = await fetchDecryptAndSaveToGallery(
                ['https://example.com/file'], 'aabb', '1122', '', 'video/mp4'
            );
            expect(result).toEqual({ success: false });
        });
    });
});

describe('AndroidMediaCache on Android', () => {
    const mockFetchDecryptAndSave = vi.fn();

    beforeEach(() => {
        vi.resetModules();
        
        // Mock as Android platform with plugin available
        vi.doMock('@capacitor/core', () => ({
            Capacitor: {
                getPlatform: () => 'android',
            },
            registerPlugin: () => ({
                fetchDecryptAndSave: mockFetchDecryptAndSave
            })
        }));

        // Mock localStorage with media cache enabled
        (globalThis as any).localStorage = {
            getItem: vi.fn().mockReturnValue(JSON.stringify({ mediaCacheEnabled: true })),
            setItem: vi.fn()
        };

        // Mock window for isAndroidNative check
        (globalThis as any).window = {};

        mockFetchDecryptAndSave.mockReset();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('fetchDecryptAndSaveToGallery calls native plugin', async () => {
        mockFetchDecryptAndSave.mockResolvedValue({ success: true });

        const { fetchDecryptAndSaveToGallery } = await import('./AndroidMediaCache');
        const result = await fetchDecryptAndSaveToGallery(
            ['https://blossom.example.com/abc123def456.mp4'],
            'aabbccdd', '11223344', 'abc123def456', 'video/mp4', 'video.mp4'
        );

        expect(mockFetchDecryptAndSave).toHaveBeenCalledWith({
            urls: ['https://blossom.example.com/abc123def456.mp4'],
            key: 'aabbccdd',
            nonce: '11223344',
            sha256: 'abc123def456',
            mimeType: 'video/mp4',
            filename: 'video.mp4'
        });
        expect(result).toEqual({ success: true });
    });
});
