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
                headers: {
                    get(name: string) {
                        return name.toLowerCase() === 'content-type' ? 'text/html; charset=utf-8' : null;
                    }
                },
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
                headers: {
                    get(name: string) {
                        return name.toLowerCase() === 'content-type' ? 'text/html; charset=utf-8' : null;
                    }
                },
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

    it('decodes HTML entities in title and description', async () => {
        const html = `<!doctype html><html><head><title>Golem.de: IT-News f&uuml;r Profis</title><meta name="description" content="S&uuml;&szlig; &amp; sch&ouml;n."></head><body></body></html>`;

        const fakeFetch = vi.fn(async () => {
            const encoder = new TextEncoder();
            const data = encoder.encode(html);
            return {
                ok: true,
                headers: {
                    get(name: string) {
                        return name.toLowerCase() === 'content-type' ? 'text/html; charset=utf-8' : null;
                    }
                },
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

        const result = await fetchUrlPreviewMetadata('https://www.golem.de/news/example', fakeFetch as unknown as typeof fetch);

        expect(result).not.toBeNull();
        expect(result?.title).toBe('Golem.de: IT-News für Profis');
        expect(result?.description).toBe('Süß & schön.');
    });

    it('uses expanded metadata sources and resolves relative image URLs', async () => {
        const html = `<!doctype html><html><head>
<meta name="twitter:title" content="Twitter Title">
<meta name="twitter:description" content="Twitter Description.">
<meta property="og:image" content="/images/preview.jpg">
</head><body></body></html>`;

        const fakeFetch = vi.fn(async () => {
            const encoder = new TextEncoder();
            const data = encoder.encode(html);
            return {
                ok: true,
                headers: {
                    get(name: string) {
                        return name.toLowerCase() === 'content-type' ? 'text/html; charset=utf-8' : null;
                    }
                },
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

        const url = 'https://example.com/article/123';
        const result = await fetchUrlPreviewMetadata(url, fakeFetch as unknown as typeof fetch);

        expect(result).not.toBeNull();
        expect(result?.title).toBe('Twitter Title');
        expect(result?.description).toBe('Twitter Description.');
        expect(result?.image).toBe('https://example.com/images/preview.jpg');
    });

    it('returns minimal metadata for generic consent or cookie-wall pages when only a title exists', async () => {
        const html = '<html><head><title>Example Site &amp; Consent</title></head><body>Consent page</body></html>';

        const fakeFetch = vi.fn(async () => {
            const encoder = new TextEncoder();
            const data = encoder.encode(html);
            return {
                ok: true,
                headers: {
                    get(name: string) {
                        return name.toLowerCase() === 'content-type' ? 'text/html; charset=utf-8' : null;
                    }
                },
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

        const result = await fetchUrlPreviewMetadata('https://example.com/consent', fakeFetch as unknown as typeof fetch);

        expect(result).not.toBeNull();
        expect(result?.title).toBe('Example Site & Consent');
        expect(result?.description).toBeUndefined();
    });
});
