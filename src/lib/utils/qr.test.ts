import { describe, it, expect } from 'vitest';
import { nip19 } from 'nostr-tools';

import { parseNostrContactFromQrPayload, parseNpubFromQrPayload } from './qr';

describe('parseNostrContactFromQrPayload', () => {
    it('extracts npub from nostr:npub URI', () => {
        const result = parseNostrContactFromQrPayload('nostr:npub1example');
        expect(result).toEqual({ npub: 'npub1example' });
    });

    it('handles mixed-case nostr prefix and whitespace', () => {
        const result = parseNostrContactFromQrPayload('  Nostr:npub1mixedcase ');
        expect(result).toEqual({ npub: 'npub1mixedcase' });
    });

    it('returns result when payload is bare npub', () => {
        const result = parseNostrContactFromQrPayload('npub1barevalue');
        expect(result).toEqual({ npub: 'npub1barevalue' });
    });

    it('does not include relays for npub payloads', () => {
        const result = parseNostrContactFromQrPayload('npub1barevalue');
        expect(result?.relays).toBeUndefined();
    });

    it('decodes nprofile with relay hints', () => {
        const pubkeyHex = '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d';
        const relays = ['wss://relay.damus.io', 'wss://nos.lol'];
        const nprofile = nip19.nprofileEncode({ pubkey: pubkeyHex, relays });
        const expectedNpub = nip19.npubEncode(pubkeyHex);

        const result = parseNostrContactFromQrPayload(nprofile);
        expect(result).toEqual({ npub: expectedNpub, relays });
    });

    it('decodes nprofile with nostr: prefix', () => {
        const pubkeyHex = '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d';
        const relays = ['wss://relay.damus.io'];
        const nprofile = nip19.nprofileEncode({ pubkey: pubkeyHex, relays });
        const expectedNpub = nip19.npubEncode(pubkeyHex);

        const result = parseNostrContactFromQrPayload(`nostr:${nprofile}`);
        expect(result).toEqual({ npub: expectedNpub, relays });
    });

    it('decodes nprofile without relay hints', () => {
        const pubkeyHex = '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d';
        const nprofile = nip19.nprofileEncode({ pubkey: pubkeyHex });
        const expectedNpub = nip19.npubEncode(pubkeyHex);

        const result = parseNostrContactFromQrPayload(nprofile);
        expect(result).toEqual({ npub: expectedNpub });
        expect(result?.relays).toBeUndefined();
    });

    it('returns null for invalid nprofile', () => {
        const result = parseNostrContactFromQrPayload('nprofile1invaliddata');
        expect(result).toBeNull();
    });

    it('returns null for unrelated payloads', () => {
        expect(parseNostrContactFromQrPayload('http://example.com')).toBeNull();
        expect(parseNostrContactFromQrPayload('')).toBeNull();
    });

    it('returns null for note and nevent payloads', () => {
        expect(parseNostrContactFromQrPayload('nostr:note1something')).toBeNull();
        expect(parseNostrContactFromQrPayload('nostr:nevent1something')).toBeNull();
    });
});

describe('parseNpubFromQrPayload (deprecated)', () => {
    it('returns npub string for npub payloads', () => {
        expect(parseNpubFromQrPayload('npub1example')).toBe('npub1example');
    });

    it('returns npub string for nprofile payloads', () => {
        const pubkeyHex = '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d';
        const nprofile = nip19.nprofileEncode({ pubkey: pubkeyHex, relays: ['wss://relay.damus.io'] });
        const expectedNpub = nip19.npubEncode(pubkeyHex);

        expect(parseNpubFromQrPayload(nprofile)).toBe(expectedNpub);
    });

    it('returns null for unrelated payloads', () => {
        expect(parseNpubFromQrPayload('http://example.com')).toBeNull();
        expect(parseNpubFromQrPayload('')).toBeNull();
    });
});
