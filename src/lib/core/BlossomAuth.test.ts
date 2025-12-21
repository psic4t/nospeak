import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { signer } from '$lib/stores/auth';
import type { Signer } from '$lib/core/signer/Signer';
import { buildBlossomUploadAuthHeader } from './BlossomAuth';

describe('buildBlossomUploadAuthHeader', () => {
    beforeEach(() => {
        (signer as any).set(null);
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
    });

    afterEach(() => {
        vi.useRealTimers();
        (signer as any).set(null);
    });

    it('returns null when no signer is set', async () => {
        const header = await buildBlossomUploadAuthHeader({ sha256: 'aa' });
        expect(header).toBeNull();
    });

    it('signs a kind 24242 upload auth event', async () => {
        const signEvent = vi.fn(async (event) => ({
            id: 'id',
            sig: 'sig',
            pubkey: 'pubkey',
            kind: event.kind!,
            created_at: event.created_at!,
            tags: event.tags ?? [],
            content: event.content ?? ''
        }));

        const mockSigner: Signer = {
            async getPublicKey() {
                return 'pubkey';
            },
            signEvent: signEvent as any,
            async encrypt() {
                return '';
            },
            async decrypt() {
                return '';
            }
        };

        (signer as any).set(mockSigner);

        const header = await buildBlossomUploadAuthHeader({
            sha256: 'deadbeef',
            content: 'Upload test'
        });

        expect(header).toMatch(/^Nostr /);
        expect(signEvent).toHaveBeenCalledTimes(1);

        const eventArg = signEvent.mock.calls[0][0];
        expect(eventArg.kind).toBe(24242);

        const tag = (eventArg.tags ?? []).find((t: string[]) => t[0] === 't');
        expect(tag?.[1]).toBe('upload');

        const xTag = (eventArg.tags ?? []).find((t: string[]) => t[0] === 'x');
        expect(xTag?.[1]).toBe('deadbeef');

        const expirationTag = (eventArg.tags ?? []).find((t: string[]) => t[0] === 'expiration');
        expect(expirationTag).toBeDefined();
    });
});
