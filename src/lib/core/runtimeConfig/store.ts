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
        isNonEmptyString(candidate.webAppBaseUrl) &&
        Array.isArray(candidate.iceServers)
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

export function getIceServers(): RTCIceServer[] {
    return getRuntimeConfigSnapshot().iceServers;
}

/**
 * Deterministic JSON serialization of the current {@link RTCIceServer}
 * list. Used by {@code VoiceCallServiceNative} to forward the runtime
 * config to the Android Capacitor plugin (and from there into the
 * native foreground service intent extra) so the native peer
 * connection can be configured with the same ICE servers as the web
 * build.
 *
 * The output is byte-stable for a given input: each entry's keys are
 * emitted in canonical order ({@code urls}, then {@code username},
 * then {@code credential}; absent keys are omitted), and array
 * {@code urls} values preserve their original order. This stability
 * lets tests assert on exact strings without quoting / key-order
 * surprises and lets the Android side parse with the same expectations
 * regardless of which JS engine produced the JSON.
 *
 * Returns the literal string {@code "[]"} when the iceServers list is
 * empty; callers MUST tolerate this and fall back to their own
 * compile-time default.
 */
export function getIceServersJson(): string {
    return serializeIceServers(getRuntimeConfigSnapshot().iceServers);
}

/**
 * Pure helper exposed for unit testing. Serializes a list of
 * {@link RTCIceServer} entries with canonical key order
 * ({@code urls} / {@code username} / {@code credential}) and stable
 * URL ordering.
 */
export function serializeIceServers(servers: RTCIceServer[]): string {
    const normalized = servers.map((server) => {
        const entry: { urls: string | string[]; username?: string; credential?: string } = {
            urls: server.urls
        };
        if (typeof server.username === 'string' && server.username.length > 0) {
            entry.username = server.username;
        }
        if (typeof server.credential === 'string' && server.credential.length > 0) {
            entry.credential = server.credential;
        }
        return entry;
    });
    return JSON.stringify(normalized);
}

export { runtimeConfig };
