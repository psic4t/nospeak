import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@capacitor/core', () => ({
    Capacitor: {
        getPlatform: vi.fn().mockReturnValue('web'),
    },
    registerPlugin: vi.fn().mockReturnValue(null)
}));

vi.mock('./NativeDialogs', () => ({
    isAndroidNative: vi.fn().mockReturnValue(false)
}));

describe('AndroidDownloads', () => {
    beforeEach(() => {
        vi.resetModules();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('on non-Android platforms', () => {
        it('returns false when not on Android', async () => {
            const { saveToDownloads } = await import('./AndroidDownloads');
            const result = await saveToDownloads('test.html', 'ZGF0YQ==');
            expect(result).toBe(false);
        });
    });

    describe('on Android', () => {
        const mockSaveToDownloads = vi.fn();

        beforeEach(() => {
            vi.resetModules();

            vi.doMock('@capacitor/core', () => ({
                Capacitor: {
                    getPlatform: () => 'android',
                },
                registerPlugin: () => ({
                    saveToDownloads: mockSaveToDownloads
                })
            }));

            vi.doMock('./NativeDialogs', () => ({
                isAndroidNative: () => true
            }));

            (globalThis as any).window = {};

            mockSaveToDownloads.mockReset();
        });

        it('returns false when filename is empty', async () => {
            const { saveToDownloads } = await import('./AndroidDownloads');
            const result = await saveToDownloads('', 'ZGF0YQ==');
            expect(result).toBe(false);
            expect(mockSaveToDownloads).not.toHaveBeenCalled();
        });

        it('returns false when data is empty', async () => {
            const { saveToDownloads } = await import('./AndroidDownloads');
            const result = await saveToDownloads('test.html', '');
            expect(result).toBe(false);
            expect(mockSaveToDownloads).not.toHaveBeenCalled();
        });

        it('calls plugin with correct parameters', async () => {
            mockSaveToDownloads.mockResolvedValue({ success: true });

            const { saveToDownloads } = await import('./AndroidDownloads');
            const result = await saveToDownloads('test.html', 'ZGF0YQ==', 'text/html');

            expect(result).toBe(true);
            expect(mockSaveToDownloads).toHaveBeenCalledWith({
                filename: 'test.html',
                data: 'ZGF0YQ==',
                mimeType: 'text/html'
            });
        });

        it('returns false when plugin returns success: false', async () => {
            mockSaveToDownloads.mockResolvedValue({
                success: false,
                error: 'Write failed'
            });

            const { saveToDownloads } = await import('./AndroidDownloads');
            const result = await saveToDownloads('test.html', 'ZGF0YQ==');

            expect(result).toBe(false);
        });

        it('returns false when plugin throws', async () => {
            mockSaveToDownloads.mockRejectedValue(new Error('Plugin error'));

            const { saveToDownloads } = await import('./AndroidDownloads');
            const result = await saveToDownloads('test.html', 'ZGF0YQ==');

            expect(result).toBe(false);
        });
    });
});
