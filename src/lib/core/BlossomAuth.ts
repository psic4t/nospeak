import { get } from 'svelte/store';
import type { NostrEvent } from 'nostr-tools';

import { signer } from '$lib/stores/auth';

const BLOSSOM_AUTH_KIND = 24242;
const DEFAULT_EXPIRATION_SECONDS = 5 * 60;

function toBase64(input: string): string {
    if (typeof btoa === 'function') {
        return btoa(input);
    }

    return Buffer.from(input, 'utf8').toString('base64');
}

export async function buildBlossomUploadAuthHeader(params: {
    sha256: string;
    content?: string;
    expirationSeconds?: number;
}): Promise<string | null> {
    const s = get(signer);
    if (!s) {
        return null;
    }

    const now = Math.floor(Date.now() / 1000);
    const expiration = now + (params.expirationSeconds ?? DEFAULT_EXPIRATION_SECONDS);

    const event: Partial<NostrEvent> = {
        kind: BLOSSOM_AUTH_KIND,
        created_at: now,
        tags: [
            ['t', 'upload'],
            ['x', params.sha256],
            ['expiration', String(expiration)]
        ],
        content: params.content ?? 'Upload blob'
    };

    const signed = await s.signEvent(event);
    const json = JSON.stringify(signed);
    const token = toBase64(json);

    return `Nostr ${token}`;
}
