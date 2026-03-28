import type { RuntimeConfig } from './types';

export const DEFAULT_RUNTIME_CONFIG: RuntimeConfig = {
    discoveryRelays: [
        'wss://nostr.data.haus',
        'wss://relay.damus.io',
        'wss://nos.lol',
        'wss://relay.primal.net',
        'wss://purplepag.es',
        'wss://user.kindpag.es',
        'wss://profiles.nostr1.com',
        'wss://directory.yabu.me'
    ],
    defaultMessagingRelays: [
        'wss://nostr.data.haus',
        'wss://nos.lol',
        'wss://relay.damus.io'
    ],
    searchRelayUrl: 'wss://nostr.wine',
    blasterRelayUrl: 'wss://sendit.nosflare.com',
    defaultBlossomServers: [
        'https://blossom.data.haus',
        'https://blossom.primal.net'
    ],
    webAppBaseUrl: 'https://nospeak.chat',
    iceServers: [
        { urls: 'stun:turn.data.haus:3478' },
        { urls: 'stun:stun.cloudflare.com:3478' },
        {
            urls: 'turn:turn.data.haus:3478',
            username: 'free',
            credential: 'free'
        }
    ]
};
