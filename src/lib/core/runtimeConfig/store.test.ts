import { describe, it, expect } from 'vitest';

import {
    getIceServersJson,
    serializeIceServers
} from './store';
import { DEFAULT_RUNTIME_CONFIG } from './defaults';

describe('serializeIceServers', () => {
    it('emits valid JSON parseable back to an equivalent array', () => {
        const json = serializeIceServers(DEFAULT_RUNTIME_CONFIG.iceServers);
        const parsed = JSON.parse(json);
        expect(Array.isArray(parsed)).toBe(true);
        expect(parsed.length).toBe(DEFAULT_RUNTIME_CONFIG.iceServers.length);
    });

    it('preserves canonical key order: urls, username, credential', () => {
        const json = serializeIceServers([
            {
                credential: 'pw',
                username: 'user',
                urls: 'turn:example.com:3478'
            }
        ]);
        // urls must appear before username, which must appear before credential.
        expect(json).toBe(
            '[{"urls":"turn:example.com:3478","username":"user","credential":"pw"}]'
        );
    });

    it('omits absent credentials cleanly', () => {
        const json = serializeIceServers([{ urls: 'stun:example.com:3478' }]);
        expect(json).toBe('[{"urls":"stun:example.com:3478"}]');
    });

    it('preserves string-array urls verbatim', () => {
        const json = serializeIceServers([
            {
                urls: [
                    'turn:example.com:3478?transport=udp',
                    'turn:example.com:3478?transport=tcp'
                ],
                username: 'u',
                credential: 'p'
            }
        ]);
        // Array ordering must be preserved.
        const idxUdp = json.indexOf('transport=udp');
        const idxTcp = json.indexOf('transport=tcp');
        expect(idxUdp).toBeGreaterThan(-1);
        expect(idxTcp).toBeGreaterThan(-1);
        expect(idxUdp).toBeLessThan(idxTcp);
        // Both URLs share the credentials from the source entry.
        expect(json).toContain('"username":"u"');
        expect(json).toContain('"credential":"p"');
    });

    it('handles empty list by emitting "[]"', () => {
        expect(serializeIceServers([])).toBe('[]');
    });

    it('is deterministic across consecutive calls with the same input', () => {
        const a = serializeIceServers(DEFAULT_RUNTIME_CONFIG.iceServers);
        const b = serializeIceServers(DEFAULT_RUNTIME_CONFIG.iceServers);
        expect(a).toBe(b);
    });
});

describe('getIceServersJson', () => {
    it('returns the same value as serializeIceServers over the current snapshot', () => {
        // The store starts at DEFAULT_RUNTIME_CONFIG until initRuntimeConfig runs.
        expect(getIceServersJson()).toBe(serializeIceServers(DEFAULT_RUNTIME_CONFIG.iceServers));
    });
});
