import { Capacitor, registerPlugin } from '@capacitor/core';

import { isAndroidNative } from './NativeDialogs';

export interface AndroidProfileCacheEntry {
    pubkeyHex: string;
    username: string;
    picture?: string;
    updatedAt?: number;
}

interface AndroidProfileCachePlugin {
    cacheProfile(entry: AndroidProfileCacheEntry): Promise<void>;
}

const AndroidProfileCache = ((): AndroidProfileCachePlugin | null => {
    if (Capacitor.getPlatform() !== 'android') {
        return null;
    }

    return registerPlugin<AndroidProfileCachePlugin>('AndroidBackgroundMessaging');
})();

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

export function extractKind0Username(metadata: unknown): string | null {
    if (!isRecord(metadata)) {
        return null;
    }

    const raw = metadata.name;
    if (typeof raw !== 'string') {
        return null;
    }

    const trimmed = raw.trim();
    if (trimmed.length === 0) {
        return null;
    }

    return trimmed;
}

/**
 * Extract the best display name from kind-0 metadata.
 * Priority: display_name → name → displayName → null
 */
export function extractKind0DisplayName(metadata: unknown): string | null {
    if (!isRecord(metadata)) {
        return null;
    }

    for (const key of ['display_name', 'name', 'displayName']) {
        const raw = metadata[key];
        if (typeof raw === 'string') {
            const trimmed = raw.trim();
            if (trimmed.length > 0) {
                return trimmed;
            }
        }
    }

    return null;
}

export function extractKind0Picture(metadata: unknown): string | null {
    if (!isRecord(metadata)) {
        return null;
    }

    const raw = metadata.picture;
    if (typeof raw !== 'string') {
        return null;
    }

    const trimmed = raw.trim();
    if (trimmed.length === 0) {
        return null;
    }

    return trimmed;
}

export async function cacheAndroidProfileIdentity(entry: AndroidProfileCacheEntry): Promise<void> {
    if (!isAndroidNative() || !AndroidProfileCache) {
        return;
    }

    if (!entry.pubkeyHex || entry.pubkeyHex.trim().length === 0) {
        return;
    }

    if (!entry.username || entry.username.trim().length === 0) {
        return;
    }

    try {
        await AndroidProfileCache.cacheProfile(entry);
    } catch (e) {
        console.warn('Failed to cache Android profile identity:', e);
    }
}
