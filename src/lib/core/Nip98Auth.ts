import { get } from 'svelte/store';
import type { NostrEvent } from 'nostr-tools';
import { signer } from '$lib/stores/auth';

export const CANONICAL_UPLOAD_URL = 'https://nospeak.chat/api/upload';
const NIP98_KIND = 27235;

function toBase64Url(input: string): string {
    if (typeof btoa === 'function') {
        const b64 = btoa(input);
        return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }

    // Fallback for non-browser environments
    const b64 = Buffer.from(input, 'utf8').toString('base64');
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function buildUploadAuthHeader(): Promise<string | null> {
    const s = get(signer);
    if (!s) {
        return null;
    }

    const now = Math.floor(Date.now() / 1000);

    const event: Partial<NostrEvent> = {
        kind: NIP98_KIND,
        created_at: now,
        tags: [
            ['u', CANONICAL_UPLOAD_URL],
            ['method', 'POST']
        ],
        content: ''
    };

    const signed = await s.signEvent(event);
    const json = JSON.stringify(signed);
    const token = toBase64Url(json);

    return `Nostr ${token}`;
}
