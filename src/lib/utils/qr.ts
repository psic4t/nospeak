import jsQR from 'jsqr';
import { nip19 } from 'nostr-tools';

export interface QrContactResult {
    npub: string;
    relays?: string[];
}

export function decodeQrFromImageData(imageData: ImageData): string | null {
    const { data, width, height } = imageData;

    if (!width || !height) {
        return null;
    }

    const result = jsQR(data, width, height);
    return result ? result.data || null : null;
}

/**
 * Parse a QR payload into a contact result.
 *
 * Accepts `npub1…` and `nprofile1…` payloads, with or without a `nostr:` prefix.
 * For nprofile, relay hints are extracted and returned alongside the npub.
 */
export function parseNostrContactFromQrPayload(raw: string): QrContactResult | null {
    let text = raw.trim();

    if (!text) {
        return null;
    }

    if (text.toLowerCase().startsWith('nostr:')) {
        text = text.slice('nostr:'.length);
    }

    if (text.startsWith('npub1')) {
        return { npub: text };
    }

    if (text.startsWith('nprofile1')) {
        try {
            const decoded = nip19.decode(text);
            if (decoded.type === 'nprofile') {
                const npub = nip19.npubEncode(decoded.data.pubkey);
                return {
                    npub,
                    relays: decoded.data.relays?.length ? decoded.data.relays : undefined
                };
            }
        } catch {
            // invalid nprofile encoding
        }
    }

    return null;
}

/** @deprecated Use {@link parseNostrContactFromQrPayload} instead. */
export function parseNpubFromQrPayload(raw: string): string | null {
    const result = parseNostrContactFromQrPayload(raw);
    return result ? result.npub : null;
}
