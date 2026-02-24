import { describe, it, expect, vi } from 'vitest';
import { fetchUrlPreviewMetadata } from './UrlPreviewService';

/** Create a mock fetch that returns the given HTML as a streaming response. */
function mockFetchHtml(html: string) {
    return vi.fn(async () => {
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
}

describe('fetchUrlPreviewMetadata', () => {
    it('returns null for non-http urls', async () => {
        const result = await fetchUrlPreviewMetadata('ftp://example.com');
        expect(result).toBeNull();
    });

    it('parses basic title and description from HTML', async () => {
        const html = `<!doctype html><html><head><title>Example Title</title><meta name="description" content="Example description."></head><body></body></html>`;
        const fakeFetch = mockFetchHtml(html);

        const result = await fetchUrlPreviewMetadata('https://example.com', fakeFetch as unknown as typeof fetch);

        expect(result).not.toBeNull();
        expect(result?.title).toBe('Example Title');
        expect(result?.description).toBe('Example description.');
    });

    it('returns null when no meaningful metadata is found', async () => {
        const html = '<html><head></head><body>No metadata here</body></html>';
        const fakeFetch = mockFetchHtml(html);

        const result = await fetchUrlPreviewMetadata('https://example.com', fakeFetch as unknown as typeof fetch);
        expect(result).toBeNull();
    });

    it('decodes HTML entities in title and description', async () => {
        const html = `<!doctype html><html><head><title>Golem.de: IT-News f&uuml;r Profis</title><meta name="description" content="S&uuml;&szlig; &amp; sch&ouml;n."></head><body></body></html>`;
        const fakeFetch = mockFetchHtml(html);

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
        const fakeFetch = mockFetchHtml(html);

        const url = 'https://example.com/article/123';
        const result = await fetchUrlPreviewMetadata(url, fakeFetch as unknown as typeof fetch);

        expect(result).not.toBeNull();
        expect(result?.title).toBe('Twitter Title');
        expect(result?.description).toBe('Twitter Description.');
        expect(result?.image).toBe('https://example.com/images/preview.jpg');
    });

    it('returns minimal metadata for generic consent or cookie-wall pages when only a title exists', async () => {
        const html = '<html><head><title>Example Site &amp; Consent</title></head><body>Consent page</body></html>';
        const fakeFetch = mockFetchHtml(html);

        const result = await fetchUrlPreviewMetadata('https://example.com/consent', fakeFetch as unknown as typeof fetch);

        expect(result).not.toBeNull();
        expect(result?.title).toBe('Example Site & Consent');
        expect(result?.description).toBeUndefined();
    });

    it('sends User-Agent header in fetch request', async () => {
        const html = '<html><head><title>Test</title></head><body></body></html>';
        const fakeFetch = mockFetchHtml(html);

        await fetchUrlPreviewMetadata('https://example.com', fakeFetch as unknown as typeof fetch);

        expect(fakeFetch).toHaveBeenCalledOnce();
        const callArgs = fakeFetch.mock.calls[0] as unknown as [string, RequestInit];
        const headers = callArgs[1]?.headers as Record<string, string>;
        expect(headers['User-Agent']).toContain('nospeak');
    });

    it('parses meta tags with content attribute before property (reversed order)', async () => {
        const html = `<html><head>
<meta content="Forum Thread Title" property="og:title">
<meta content="A discussion about watches" property="og:description">
<meta content="https://example.com/thumb.jpg" property="og:image">
</head><body></body></html>`;
        const fakeFetch = mockFetchHtml(html);

        const result = await fetchUrlPreviewMetadata('https://forum.example.com/thread/1', fakeFetch as unknown as typeof fetch);

        expect(result).not.toBeNull();
        expect(result?.title).toBe('Forum Thread Title');
        expect(result?.description).toBe('A discussion about watches');
        expect(result?.image).toBe('https://example.com/thumb.jpg');
    });

    it('handles single quotes containing apostrophes in double-quoted content', async () => {
        const html = `<html><head>
<meta property="og:title" content="It's a beautiful day">
<meta property="og:description" content="Don't miss the sun's rays">
</head><body></body></html>`;
        const fakeFetch = mockFetchHtml(html);

        const result = await fetchUrlPreviewMetadata('https://example.com/article', fakeFetch as unknown as typeof fetch);

        expect(result).not.toBeNull();
        expect(result?.title).toBe("It's a beautiful day");
        expect(result?.description).toBe("Don't miss the sun's rays");
    });

    it('handles double quotes in single-quoted content', async () => {
        const html = `<html><head>
<meta property='og:title' content='She said "hello"'>
<meta property='og:description' content='A "great" article'>
</head><body></body></html>`;
        const fakeFetch = mockFetchHtml(html);

        const result = await fetchUrlPreviewMetadata('https://example.com/article', fakeFetch as unknown as typeof fetch);

        expect(result).not.toBeNull();
        expect(result?.title).toBe('She said "hello"');
        expect(result?.description).toBe('A "great" article');
    });

    it('parses reversed-order meta tags with name attribute (twitter/description)', async () => {
        const html = `<html><head>
<meta content="Reversed Twitter Title" name="twitter:title">
<meta content="Reversed description" name="description">
</head><body></body></html>`;
        const fakeFetch = mockFetchHtml(html);

        const result = await fetchUrlPreviewMetadata('https://example.com', fakeFetch as unknown as typeof fetch);

        expect(result).not.toBeNull();
        expect(result?.title).toBe('Reversed Twitter Title');
        expect(result?.description).toBe('Reversed description');
    });

    it('parses link rel="image_src" with href before rel', async () => {
        const html = `<html><head>
<title>Image Source Test</title>
<link href="/assets/preview.png" rel="image_src">
</head><body></body></html>`;
        const fakeFetch = mockFetchHtml(html);

        const result = await fetchUrlPreviewMetadata('https://example.com/page', fakeFetch as unknown as typeof fetch);

        expect(result).not.toBeNull();
        expect(result?.image).toBe('https://example.com/assets/preview.png');
    });
});
