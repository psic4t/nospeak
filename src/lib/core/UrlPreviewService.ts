export interface UrlPreviewMetadata {
    url: string;
    title?: string;
    description?: string;
    image?: string;
}

const MAX_CONTENT_LENGTH = 64 * 1024; // 64KB is enough for metadata tags
const REQUEST_TIMEOUT_MS = 5000;

function extractBetween(html: string, regex: RegExp): string | undefined {
    const match = html.match(regex);
    if (!match || !match[1]) {
        return undefined;
    }
    const value = match[1].trim();
    return value.length > 0 ? value : undefined;
}

/**
 * Extract content from a <meta> tag by attribute name/value, handling:
 * - Bidirectional attribute order (property before content, or content before property)
 * - Correct quote matching (double-quoted values can contain single quotes and vice versa)
 */
function extractMetaContent(html: string, attr: string, value: string): string | undefined {
    // Match <meta> tags that contain the specified attribute=value pair
    const tagRegex = new RegExp(`<meta\\s[^>]*${attr}=["']${value}["'][^>]*>`, 'gi');
    let match;
    while ((match = tagRegex.exec(html)) !== null) {
        const tag = match[0];
        // Extract content value, respecting the specific quote character used
        const contentMatch = tag.match(/\bcontent="([^"]*)"|content='([^']*)'/i);
        if (contentMatch) {
            const val = (contentMatch[1] ?? contentMatch[2] ?? '').trim();
            if (val) return val;
        }
    }
    return undefined;
}

/**
 * Extract href from a <link> tag by rel value, handling bidirectional attribute order.
 */
function extractLinkHref(html: string, relValue: string): string | undefined {
    const tagRegex = new RegExp(`<link\\s[^>]*rel=["']${relValue}["'][^>]*>`, 'gi');
    let match;
    while ((match = tagRegex.exec(html)) !== null) {
        const tag = match[0];
        const hrefMatch = tag.match(/\bhref="([^"]*)"|href='([^']*)'/i);
        if (hrefMatch) {
            const val = (hrefMatch[1] ?? hrefMatch[2] ?? '').trim();
            if (val) return val;
        }
    }
    return undefined;
}

function getCharsetFromContentType(contentType: string | null): string {
    if (!contentType) {
        return 'utf-8';
    }

    const lower = contentType.toLowerCase();
    const match = lower.match(/charset\s*=\s*([^;]+)/);

    if (!match || !match[1]) {
        return 'utf-8';
    }

    const charset = match[1].trim();

    if (!charset) {
        return 'utf-8';
    }

    if (charset === 'utf8') {
        return 'utf-8';
    }

    return charset;
}

function decodeHtmlEntities(input: string): string {
    if (!input) {
        return input;
    }

    const named: Record<string, string> = {
        amp: '&',
        lt: '<',
        gt: '>',
        quot: '"',
        apos: '\'',
        nbsp: '\u00a0',
        auml: 'ä',
        ouml: 'ö',
        uuml: 'ü',
        Auml: 'Ä',
        Ouml: 'Ö',
        Uuml: 'Ü',
        szlig: 'ß'
    };

    let result = input;

    // Numeric decimal entities
    result = result.replace(/&#(\d+);/g, (match, num) => {
        const code = Number(num);
        if (!Number.isFinite(code)) {
            return match;
        }
        try {
            return String.fromCodePoint(code);
        } catch {
            return match;
        }
    });

    // Numeric hex entities
    result = result.replace(/&#x([0-9a-f]+);/gi, (match, hex) => {
        const code = parseInt(hex, 16);
        if (!Number.isFinite(code)) {
            return match;
        }
        try {
            return String.fromCodePoint(code);
        } catch {
            return match;
        }
    });

    // Common named entities (including German umlauts)
    result = result.replace(/&([a-zA-Z]+);/g, (match, name) => {
        if (Object.prototype.hasOwnProperty.call(named, name)) {
            return named[name];
        }
        return match;
    });

    return result;
}

function absolutizeUrl(maybeRelative: string, baseUrl: string): string {
    try {
        return new URL(maybeRelative, baseUrl).toString();
    } catch {
        return maybeRelative;
    }
}

export async function fetchUrlPreviewMetadata(url: string, fetchImpl: typeof fetch = fetch): Promise<UrlPreviewMetadata | null> {
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        return null;
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return null;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
        const response = await fetchImpl(url, {
            method: 'GET',
            signal: controller.signal,
            headers: {
                Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
            }
        });

        if (!response.ok) {
            return null;
        }

        const reader = response.body?.getReader();
        if (!reader) {
            return null;
        }

        const contentType = 'headers' in response && response.headers ? response.headers.get('content-type') : null;
        const charset = getCharsetFromContentType(contentType);

        const chunks: Uint8Array[] = [];
        let totalLength = 0;

        while (totalLength < MAX_CONTENT_LENGTH) {
            const { done, value } = await reader.read();
            if (done || !value) {
                break;
            }

            let chunk = value as Uint8Array;
            if (totalLength + chunk.length > MAX_CONTENT_LENGTH) {
                chunk = chunk.subarray(0, MAX_CONTENT_LENGTH - totalLength);
            }

            chunks.push(chunk);
            totalLength += chunk.length;

            if (totalLength >= MAX_CONTENT_LENGTH) {
                break;
            }
        }

        if (totalLength === 0) {
            return null;
        }

        const combined = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
            combined.set(chunk, offset);
            offset += chunk.length;
        }

        let decoder: TextDecoder;
        try {
            decoder = new TextDecoder(charset, { fatal: false });
        } catch {
            decoder = new TextDecoder('utf-8', { fatal: false });
        }

        const html = decoder.decode(combined);

        const rawTitle =
            extractMetaContent(html, 'property', 'og:title') ||
            extractMetaContent(html, 'name', 'twitter:title') ||
            extractMetaContent(html, 'name', 'title') ||
            extractBetween(html, /<title[^>]*>([^<]{1,200})<\/title>/i);

        const rawDescription =
            extractMetaContent(html, 'property', 'og:description') ||
            extractMetaContent(html, 'name', 'twitter:description') ||
            extractMetaContent(html, 'name', 'description');

        const rawImage =
            extractMetaContent(html, 'property', 'og:image:secure_url') ||
            extractMetaContent(html, 'property', 'og:image') ||
            extractMetaContent(html, 'name', 'twitter:image:src') ||
            extractMetaContent(html, 'name', 'twitter:image') ||
            extractLinkHref(html, 'image_src');

        const title = rawTitle ? decodeHtmlEntities(rawTitle) : undefined;
        const description = rawDescription ? decodeHtmlEntities(rawDescription) : undefined;

        let image: string | undefined;
        if (rawImage) {
            const decodedImage = decodeHtmlEntities(rawImage);
            image = absolutizeUrl(decodedImage, url);
        }

        if (!title && !description) {
            return null;
        }

        return {
            url,
            title,
            description,
            image
        };
    } catch {
        return null;
    } finally {
        clearTimeout(timeout);
    }
}
