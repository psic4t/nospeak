import { describe, it, expect } from 'vitest';

import { normalizeBlossomServerUrl, parseBlossomServerListEvent } from './BlossomServers';

describe('normalizeBlossomServerUrl', () => {
    it('normalizes hostnames to https origin', () => {
        expect(normalizeBlossomServerUrl('cdn.example.com')).toBe('https://cdn.example.com');
    });

    it('strips path, query, and hash', () => {
        expect(normalizeBlossomServerUrl('https://cdn.example.com/foo?bar=baz#x')).toBe('https://cdn.example.com');
    });

    it('rejects non-http(s) urls', () => {
        expect(normalizeBlossomServerUrl('wss://relay.example.com')).toBeNull();
    });
});

describe('parseBlossomServerListEvent', () => {
    it('extracts ordered unique server list', () => {
        const servers = parseBlossomServerListEvent({
            tags: [
                ['server', 'https://cdn.one'],
                ['server', 'cdn.two'],
                ['server', 'https://cdn.one/extra']
            ]
        });

        expect(servers).toEqual(['https://cdn.one', 'https://cdn.two']);
    });
});
