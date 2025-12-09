import { describe, it, expect, vi } from 'vitest';

vi.mock('nostr-tools', () => {
    return {
        verifyEvent: (event: any) => event.__valid === true
    };
});

import { POST, OPTIONS, _validateNip98 } from './+server';

function toBase64Url(input: string): string {
    const b64 = Buffer.from(input, 'utf8').toString('base64');
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

describe('api/upload NIP-98 auth and CORS', () => {
    it('rejects requests without Authorization header', async () => {
        const request = new Request('https://nospeak.chat/api/upload', {
            method: 'POST'
        });

        const response = await POST({ request } as any);

        expect(response.status).toBe(401);
        expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });

    it('responds to OPTIONS with CORS headers', async () => {
        const response = await OPTIONS({} as any);
        expect(response.status).toBe(204);
        expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });

    it('accepts a well-formed NIP-98 event via validateNip98', async () => {
        const now = Math.floor(Date.now() / 1000);
        const event = {
            id: 'id',
            sig: 'sig',
            pubkey: 'pubkey',
            kind: 27235,
            created_at: now,
            tags: [
                ['u', 'https://nospeak.chat/api/upload'],
                ['method', 'POST']
            ],
            content: '',
            __valid: true
        };

        const token = toBase64Url(JSON.stringify(event));
        const request = new Request('https://nospeak.chat/api/upload', {
            method: 'POST',
            headers: {
                Authorization: `Nostr ${token}`
            }
        });

        const authError = await _validateNip98(request);
        expect(authError).toBeNull();
    });

    it('rejects NIP-98 events with wrong URL via validateNip98', async () => {
        const now = Math.floor(Date.now() / 1000);
        const event = {
            id: 'id',
            sig: 'sig',
            pubkey: 'pubkey',
            kind: 27235,
            created_at: now,
            tags: [
                ['u', 'https://example.com/wrong'],
                ['method', 'POST']
            ],
            content: '',
            __valid: true
        };

        const token = toBase64Url(JSON.stringify(event));
        const request = new Request('https://nospeak.chat/api/upload', {
            method: 'POST',
            headers: {
                Authorization: `Nostr ${token}`
            }
        });

        const authError = await _validateNip98(request);
        expect(authError).not.toBeNull();
        expect(authError!.status).toBe(401);
        expect(authError!.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });
});
