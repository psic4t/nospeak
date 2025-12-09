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
                Accept: 'text/html,application/xhtml+xml'
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
            extractBetween(html, /<meta[^>]+property=["']og:title["'][^>]*content=["']([^"']+)["'][^>]*>/i) ||
            extractBetween(html, /<meta[^>]+name=["']twitter:title["'][^>]*content=["']([^"']+)["'][^>]*>/i) ||
            extractBetween(html, /<meta[^>]+name=["']title["'][^>]*content=["']([^"']+)["'][^>]*>/i) ||
            extractBetween(html, /<title[^>]*>([^<]{1,200})<\/title>/i);

        const rawDescription =
            extractBetween(html, /<meta[^>]+property=["']og:description["'][^>]*content=["']([^"']+)["'][^>]*>/i) ||
            extractBetween(html, /<meta[^>]+name=["']twitter:description["'][^>]*content=["']([^"']+)["'][^>]*>/i) ||
            extractBetween(html, /<meta[^>]+name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i);

        const rawImage =
            extractBetween(html, /<meta[^>]+property=["']og:image:secure_url["'][^>]*content=["']([^"']+)["'][^>]*>/i) ||
            extractBetween(html, /<meta[^>]+property=["']og:image["'][^>]*content=["']([^"']+)["'][^>]*>/i) ||
            extractBetween(html, /<meta[^>]+name=["']twitter:image:src["'][^>]*content=["']([^"']+)["'][^>]*>/i) ||
            extractBetween(html, /<meta[^>]+name=["']twitter:image["'][^>]*content=["']([^"']+)["'][^>]*>/i) ||
            extractBetween(html, /<link[^>]+rel=["']image_src["'][^>]*href=["']([^"']+)["'][^>]*>/i);

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
