import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_RUNTIME_CONFIG } from '$lib/core/runtimeConfig/defaults';
import { getRuntimeConfigFromEnv } from '$lib/core/runtimeConfig/env';

describe('getRuntimeConfigFromEnv', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    beforeEach(() => {
        warnSpy.mockClear();
    });

    it('returns defaults when env is empty', () => {
        const config = getRuntimeConfigFromEnv({});
        expect(config).toEqual(DEFAULT_RUNTIME_CONFIG);
        expect(warnSpy).not.toHaveBeenCalled();
    });

    it('parses and normalizes overrides', () => {
        const config = getRuntimeConfigFromEnv({
            NOSPEAK_DISCOVERY_RELAYS: ' wss://a.example , wss://b.example/ , wss://a.example ',
            NOSPEAK_DEFAULT_MESSAGING_RELAYS: 'wss://c.example',
            NOSPEAK_SEARCH_RELAY: 'wss://search.example/',
            NOSPEAK_BLASTER_RELAY: 'wss://blast.example',
            NOSPEAK_DEFAULT_BLOSSOM_SERVERS: 'https://one.example/path, https://two.example/',
            NOSPEAK_WEB_APP_BASE_URL: 'https://web.example/foo'
        });

        expect(config.discoveryRelays).toEqual(['wss://a.example', 'wss://b.example']);
        expect(config.defaultMessagingRelays).toEqual(['wss://c.example']);
        expect(config.searchRelayUrl).toBe('wss://search.example');
        expect(config.blasterRelayUrl).toBe('wss://blast.example');
        expect(config.defaultBlossomServers).toEqual(['https://one.example', 'https://two.example']);
        expect(config.webAppBaseUrl).toBe('https://web.example');
    });

    it('falls back to defaults when overrides are invalid', () => {
        const config = getRuntimeConfigFromEnv({
            NOSPEAK_DISCOVERY_RELAYS: 'ws://not-allowed.example',
            NOSPEAK_WEB_APP_BASE_URL: 'http://not-allowed.example'
        });

        expect(config.discoveryRelays).toEqual(DEFAULT_RUNTIME_CONFIG.discoveryRelays);
        expect(config.webAppBaseUrl).toBe(DEFAULT_RUNTIME_CONFIG.webAppBaseUrl);
        expect(warnSpy).toHaveBeenCalled();
    });
});
