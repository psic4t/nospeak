import { describe, it, expect, vi } from 'vitest';
import { fetchUrlPreviewMetadata } from './UrlPreviewService';

describe('fetchUrlPreviewMetadata', () => {
    it('returns null for non-http urls', async () => {
        const result = await fetchUrlPreviewMetadata('ftp://example.com');
        expect(result).toBeNull();
    });

    it('parses basic title and description from HTML', async () => {
        const html = `<!doctype html><html><head><title>Example Title</title><meta name="description" content="Example description."></head><body></body></html>`;

        const fakeFetch = vi.fn(async () => {
            const encoder = new TextEncoder();
            const data = encoder.encode(html);
            return {
                ok: true,
                body: {
                    getReader() {
                        let done = false;
                        return {
                            async read() {
                                if (done) return { done: true, value: undefined };
                                done = true;
                                return { done: false, value: data };
                            }
                        };
                    }
                }
            } as unknown as Response;
        });

        const result = await fetchUrlPreviewMetadata('https://example.com', fakeFetch as unknown as typeof fetch);

        expect(result).not.toBeNull();
        expect(result?.title).toBe('Example Title');
        expect(result?.description).toBe('Example description.');
    });

    it('returns null when no meaningful metadata is found', async () => {
        const html = '<html><head></head><body>No metadata here</body></html>';

        const fakeFetch = vi.fn(async () => {
            const encoder = new TextEncoder();
            const data = encoder.encode(html);
            return {
                ok: true,
                body: {
                    getReader() {
                        let done = false;
                        return {
                            async read() {
                                if (done) return { done: true, value: undefined };
                                done = true;
                                return { done: false, value: data };
                            }
                        };
                    }
                }
            } as unknown as Response;
        });

        const result = await fetchUrlPreviewMetadata('https://example.com', fakeFetch as unknown as typeof fetch);
        expect(result).toBeNull();
    });
});
