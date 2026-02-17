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
 * On web/Docker (SSR), the server hook injects a `<script>` tag that sets
 * `window.__NOSPEAK_CONFIG__` with the resolved config before any component
 * code runs. This function reads it synchronously — no load function, no
 * HTTP fetch, zero navigation overhead.
 *
 * On Android/static builds where the injected script is absent, falls back
 * to hardcoded defaults with an optional PUBLIC_WEB_APP_BASE_URL build-time
 * override.
 */
export function initRuntimeConfig(): void {
    if (typeof window === 'undefined') {
        return;
    }

    // Read config injected by hooks.server.ts into the HTML <head>.
    const injected = (window as unknown as Record<string, unknown>).__NOSPEAK_CONFIG__;
    if (injected && isRuntimeConfig(injected)) {
        const normalizedWebBase = normalizeHttpsOrigin(injected.webAppBaseUrl) ?? DEFAULT_RUNTIME_CONFIG.webAppBaseUrl;
        runtimeConfig.set({
            ...injected,
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
