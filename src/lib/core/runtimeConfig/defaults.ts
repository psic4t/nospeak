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
            // Plain TURN over UDP and TCP on port 3478. Networks that
            // filter UDP (corporate firewalls, hotel WiFi, some
            // hotspots) drop the UDP path; libwebrtc transparently
            // falls back to the TCP variant. TURNS (TURN-over-TLS) is
            // intentionally NOT included — see the
            // add-plain-turn-to-default-ice-servers OpenSpec change
            // for the rationale (server-side configuration and
            // tradeoffs).
            //
            // Keep this list in sync with
            // android/app/src/main/res/raw/default_ice_servers.json —
            // the drift-detection test
            // (`defaultsAndroidDrift.test.ts`) will fail loudly
            // otherwise.
            urls: [
                'turn:turn.data.haus:3478?transport=udp',
                'turn:turn.data.haus:3478?transport=tcp'
            ],
            username: 'free',
            credential: 'free'
        }
    ]
};
