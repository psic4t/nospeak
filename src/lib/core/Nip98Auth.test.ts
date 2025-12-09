import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { signer } from '$lib/stores/auth';
import type { Signer } from '$lib/core/signer/Signer';
import { buildUploadAuthHeader, CANONICAL_UPLOAD_URL } from './Nip98Auth';

describe('buildUploadAuthHeader', () => {
    const originalBtoa = globalThis.btoa;

    beforeEach(() => {
        (signer as any).set(null);
    });

    afterEach(() => {
        globalThis.btoa = originalBtoa;
        (signer as any).set(null);
    });

    it('returns null when no signer is set', async () => {
        const header = await buildUploadAuthHeader();
        expect(header).toBeNull();
    });

    it('builds a Nostr Authorization header when signer is available', async () => {
        const mockSigner: Signer = {
            async getPublicKey() {
                return 'pubkey';
            },
            async signEvent(event) {
                return {
                    id: 'id',
                    sig: 'sig',
                    pubkey: 'pubkey',
                    kind: event.kind!,
                    created_at: event.created_at!,
                    tags: event.tags ?? [],
                    content: event.content ?? ''
                };
            },
            async encrypt() {
                return '';
            },
            async decrypt() {
                return '';
            }
        };

        (signer as any).set(mockSigner);

        const header = await buildUploadAuthHeader();
        expect(header).not.toBeNull();
        expect(header!.startsWith('Nostr ')).toBe(true);
    });

    it('uses the canonical upload URL in the signed event', async () => {
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

        await buildUploadAuthHeader();

        expect(signEvent).toHaveBeenCalledTimes(1);
        const eventArg = signEvent.mock.calls[0][0];
        const urlTag = (eventArg.tags ?? []).find((t: string[]) => t[0] === 'u');
        expect(urlTag).toBeDefined();
        expect(urlTag[1]).toBe(CANONICAL_UPLOAD_URL);
    });
});
