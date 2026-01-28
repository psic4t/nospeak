import { get, writable, type Writable } from 'svelte/store';

import { DEFAULT_RUNTIME_CONFIG } from './defaults';
import type { RuntimeConfig } from './types';

const runtimeConfig: Writable<RuntimeConfig> = writable(DEFAULT_RUNTIME_CONFIG);

function isNonEmptyString(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0;
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

function isRuntimeConfig(value: unknown): value is RuntimeConfig {
    if (!value || typeof value !== 'object') {
        return false;
    }

    const candidate = value as Partial<RuntimeConfig>;

    return (
        Array.isArray(candidate.discoveryRelays) &&
        Array.isArray(candidate.defaultMessagingRelays) &&
        Array.isArray(candidate.defaultBlossomServers) &&
        isNonEmptyString(candidate.searchRelayUrl) &&
        isNonEmptyString(candidate.blasterRelayUrl) &&
        isNonEmptyString(candidate.webAppBaseUrl)
    );
}

export async function initRuntimeConfig(_fetchImpl?: typeof fetch): Promise<void> {
    // Runtime configuration is now baked into the client bundle at build time.
    // This function is kept for backward compatibility but does nothing.
    // The DEFAULT_RUNTIME_CONFIG values are used directly.
    return Promise.resolve();
}

export function getRuntimeConfigSnapshot(): RuntimeConfig {
    return get(runtimeConfig);
}

export function getDiscoveryRelays(): string[] {
    return getRuntimeConfigSnapshot().discoveryRelays;
}

export function getDefaultMessagingRelays(): string[] {
    return getRuntimeConfigSnapshot().defaultMessagingRelays;
}

export function getSearchRelayUrl(): string {
    return getRuntimeConfigSnapshot().searchRelayUrl;
}

export function getBlasterRelayUrl(): string {
    return getRuntimeConfigSnapshot().blasterRelayUrl;
}

export function getDefaultBlossomServers(): string[] {
    return getRuntimeConfigSnapshot().defaultBlossomServers;
}

export function getWebAppBaseUrl(): string {
    return getRuntimeConfigSnapshot().webAppBaseUrl;
}

export { runtimeConfig };
