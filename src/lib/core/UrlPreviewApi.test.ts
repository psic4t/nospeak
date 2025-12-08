import { describe, it, expect, beforeEach } from 'vitest';
import { getUrlPreviewApiUrl } from './UrlPreviewApi';

describe('getUrlPreviewApiUrl', () => {
    const originalCapacitor =
        typeof window !== 'undefined' ? (window as unknown as { Capacitor?: unknown }).Capacitor : undefined;

    beforeEach(() => {
        if (typeof window !== 'undefined') {
            (window as unknown as { Capacitor?: unknown }).Capacitor = originalCapacitor;
        }
    });

    it('uses relative API path in standard web browser', () => {
        if (typeof window === 'undefined') {
            // In non-browser environments this test is not applicable
            return;
        }

        (window as unknown as { Capacitor?: unknown }).Capacitor = undefined;

        const url = 'https://example.com/article';
        const apiUrl = getUrlPreviewApiUrl(url);

        expect(apiUrl).toBe(`/api/url-preview?url=${encodeURIComponent(url)}`);
    });

    it('uses remote server base URL in Android Capacitor shell', () => {
        if (typeof window === 'undefined') {
            // In non-browser environments this test is not applicable
            return;
        }

        (window as unknown as { Capacitor?: { getPlatform?: () => string } }).Capacitor = {
            getPlatform: () => 'android'
        };

        const url = 'https://example.com/article';
        const apiUrl = getUrlPreviewApiUrl(url);

        expect(apiUrl.startsWith('https://nospeak.chat/api/url-preview?url=')).toBe(true);
    });
});
