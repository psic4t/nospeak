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

/**
 * Initialize the runtime config store.
 *
 * When `serverConfig` is provided (from +layout.server.ts SSR data),
 * the store is set directly — no HTTP fetch needed.
 *
 * When called without arguments (Android/static builds where SSR data
 * is unavailable), falls back to hardcoded defaults with an optional
 * PUBLIC_WEB_APP_BASE_URL build-time override.
 */
export function initRuntimeConfig(serverConfig?: unknown): void {
    if (typeof window === 'undefined') {
        return;
    }

    // If server-provided config is available (SSR), use it directly.
    if (serverConfig && isRuntimeConfig(serverConfig)) {
        const normalizedWebBase = normalizeHttpsOrigin(serverConfig.webAppBaseUrl) ?? DEFAULT_RUNTIME_CONFIG.webAppBaseUrl;
        runtimeConfig.set({
            ...serverConfig,
            webAppBaseUrl: normalizedWebBase
        });
        return;
    }

    // Fallback for Android/static builds: apply build-time env var override.
    try {
        const envBase = (import.meta.env.PUBLIC_WEB_APP_BASE_URL as string | undefined) ?? '';
        const normalized = envBase ? normalizeHttpsOrigin(envBase) : null;
        if (normalized) {
            runtimeConfig.update((current) => ({
                ...current,
                webAppBaseUrl: normalized
            }));
        }
    } catch {
        // ignore
    }
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
