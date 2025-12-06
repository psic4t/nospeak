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

        let received = 0;
        const chunks: Uint8Array[] = [];

        while (received < MAX_CONTENT_LENGTH) {
            const { done, value } = await reader.read();
            if (done || !value) {
                break;
            }
            received += value.length;
            chunks.push(value.subarray(0, Math.min(value.length, MAX_CONTENT_LENGTH - (received - value.length))));
            if (received >= MAX_CONTENT_LENGTH) {
                break;
            }
        }

        const decoder = new TextDecoder('utf-8', { fatal: false });
        const combined = new Uint8Array(received);
        let offset = 0;
        for (const chunk of chunks) {
            combined.set(chunk, offset);
            offset += chunk.length;
        }
        const html = decoder.decode(combined);

        const title =
            extractBetween(html, /<meta[^>]+property=["']og:title["'][^>]*content=["']([^"']+)["'][^>]*>/i) ||
            extractBetween(html, /<title[^>]*>([^<]{1,200})<\/title>/i);

        const description =
            extractBetween(html, /<meta[^>]+property=["']og:description["'][^>]*content=["']([^"']+)["'][^>]*>/i) ||
            extractBetween(html, /<meta[^>]+name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i);

        const image = extractBetween(
            html,
            /<meta[^>]+property=["']og:image["'][^>]*content=["']([^"']+)["'][^>]*>/i
        );

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
