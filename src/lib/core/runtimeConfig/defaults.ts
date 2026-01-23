import type { RuntimeConfig } from './types';

export const DEFAULT_RUNTIME_CONFIG: RuntimeConfig = {
    discoveryRelays: [
        'wss://nostr.data.haus',
        'wss://relay.damus.io',
        'wss://nos.lol',
        'wss://relay.primal.net',
        'wss://purplepag.es'
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
    robohashBaseUrl: 'https://robohash.org/'
};
