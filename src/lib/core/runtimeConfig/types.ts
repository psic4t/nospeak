export interface RuntimeConfig {
    discoveryRelays: string[];
    defaultMessagingRelays: string[];
    searchRelayUrl: string;
    blasterRelayUrl: string;
    defaultBlossomServers: string[];
    webAppBaseUrl: string;
    iceServers: RTCIceServer[];
}
