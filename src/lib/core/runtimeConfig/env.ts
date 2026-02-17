import type { RuntimeConfig } from './types';
import { DEFAULT_RUNTIME_CONFIG } from './defaults';

function parseCommaSeparated(value: string | undefined): string[] {
    const trimmed = value ? value.trim() : '';
    if (!trimmed) {
        return [];
    }

    return trimmed
        .split(',')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
}

function dedupePreserveOrder(values: string[]): string[] {
    const seen = new Set<string>();
    const result: string[] = [];

    for (const value of values) {
        if (seen.has(value)) {
            continue;
        }

        seen.add(value);
        result.push(value);
    }

    return result;
}

function normalizeWssUrl(value: string): string | null {
    try {
        const trimmed = value.trim();
        if (!trimmed) {
            return null;
        }

        const url = new URL(trimmed);
        if (url.protocol !== 'wss:') {
            return null;
        }

        return url.href.replace(/\/$/, '');
    } catch {
        return null;
    }
}

function normalizeHttpsOrigin(value: string): string | null {
    try {
        const trimmed = value.trim();
        if (!trimmed) {
            return null;
        }

        const url = new URL(trimmed);
        if (url.protocol !== 'https:') {
            return null;
        }

        return url.origin;
    } catch {
        return null;
    }
}

function parseWssList(value: string | undefined): string[] {
    const entries = parseCommaSeparated(value);
    return dedupePreserveOrder(entries.map(normalizeWssUrl).filter((entry): entry is string => !!entry));
}

function parseHttpsOriginList(value: string | undefined): string[] {
    const entries = parseCommaSeparated(value);
    return dedupePreserveOrder(entries.map(normalizeHttpsOrigin).filter((entry): entry is string => !!entry));
}

function resolveListOverride(
    envValue: string | undefined,
    parsed: string[],
    fallback: readonly string[],
    name: string
): string[] {
    if (envValue && envValue.trim().length > 0 && parsed.length === 0) {
        console.warn(`Ignoring ${name} override; no valid entries`);
        return [...fallback];
    }

    return parsed.length > 0 ? parsed : [...fallback];
}

function resolveSingleOverride(
    envValue: string | undefined,
    parsed: string | null,
    fallback: string,
    name: string
): string {
    if (envValue && envValue.trim().length > 0 && !parsed) {
        console.warn(`Ignoring ${name} override; invalid value`);
        return fallback;
    }

    return parsed ?? fallback;
}

export function getRuntimeConfigFromEnv(env: Record<string, string | undefined>): RuntimeConfig {
    const discoveryRelaysRaw = env.NOSPEAK_DISCOVERY_RELAYS;
    const defaultMessagingRelaysRaw = env.NOSPEAK_DEFAULT_MESSAGING_RELAYS;
    const defaultBlossomServersRaw = env.NOSPEAK_DEFAULT_BLOSSOM_SERVERS;

    const discoveryRelays = resolveListOverride(
        discoveryRelaysRaw,
        parseWssList(discoveryRelaysRaw),
        DEFAULT_RUNTIME_CONFIG.discoveryRelays,
        'NOSPEAK_DISCOVERY_RELAYS'
    );

    const defaultMessagingRelays = resolveListOverride(
        defaultMessagingRelaysRaw,
        parseWssList(defaultMessagingRelaysRaw),
        DEFAULT_RUNTIME_CONFIG.defaultMessagingRelays,
        'NOSPEAK_DEFAULT_MESSAGING_RELAYS'
    );

    const searchRelayUrl = resolveSingleOverride(
        env.NOSPEAK_SEARCH_RELAY,
        env.NOSPEAK_SEARCH_RELAY ? normalizeWssUrl(env.NOSPEAK_SEARCH_RELAY) : null,
        DEFAULT_RUNTIME_CONFIG.searchRelayUrl,
        'NOSPEAK_SEARCH_RELAY'
    );

    const blasterRelayUrl = resolveSingleOverride(
        env.NOSPEAK_BLASTER_RELAY,
        env.NOSPEAK_BLASTER_RELAY ? normalizeWssUrl(env.NOSPEAK_BLASTER_RELAY) : null,
        DEFAULT_RUNTIME_CONFIG.blasterRelayUrl,
        'NOSPEAK_BLASTER_RELAY'
    );

    const defaultBlossomServers = resolveListOverride(
        defaultBlossomServersRaw,
        parseHttpsOriginList(defaultBlossomServersRaw),
        DEFAULT_RUNTIME_CONFIG.defaultBlossomServers,
        'NOSPEAK_DEFAULT_BLOSSOM_SERVERS'
    );

    const webAppBaseUrl = resolveSingleOverride(
        env.NOSPEAK_WEB_APP_BASE_URL,
        env.NOSPEAK_WEB_APP_BASE_URL ? normalizeHttpsOrigin(env.NOSPEAK_WEB_APP_BASE_URL) : null,
        DEFAULT_RUNTIME_CONFIG.webAppBaseUrl,
        'NOSPEAK_WEB_APP_BASE_URL'
    );

    return {
        discoveryRelays,
        defaultMessagingRelays,
        searchRelayUrl,
        blasterRelayUrl,
        defaultBlossomServers,
        webAppBaseUrl
    };
}
