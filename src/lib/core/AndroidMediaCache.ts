import { Capacitor, registerPlugin } from '@capacitor/core';

import { isAndroidNative } from './NativeDialogs';

/**
 * Result of saving a file to the media cache.
 */
export interface MediaCacheSaveResult {
    /** Whether the save was successful */
    success: boolean;
}

/**
 * Result of loading a file from the media cache.
 */
export interface MediaCacheLoadResult {
    /** Whether the file was found in the cache */
    found: boolean;
    /** Capacitor-converted URL ready for use in <img>/<video> src (only present if found) */
    url?: string;
}

interface AndroidMediaCachePlugin {
    /**
     * Load a file from the media cache (MediaStore) by SHA256 hash.
     * Returns a Capacitor-accessible URL if found.
     */
    loadFromCache(options: {
        sha256: string;
        mimeType: string;
    }): Promise<MediaCacheLoadResult>;

    /**
     * Fetch encrypted media, decrypt with AES-GCM, and save to MediaStore.
     * All heavy work (HTTP fetch, crypto, disk I/O) runs on a Java background thread.
     * Only tiny strings cross the Capacitor bridge.
     */
    fetchDecryptAndSave(options: {
        url: string;
        key: string;
        nonce: string;
        sha256: string;
        mimeType: string;
        filename?: string;
    }): Promise<MediaCacheSaveResult>;
}

const AndroidMediaCache = ((): AndroidMediaCachePlugin | null => {
    if (Capacitor.getPlatform() !== 'android') {
        return null;
    }

    return registerPlugin<AndroidMediaCachePlugin>('AndroidMediaCache');
})();

/**
 * Fetch, decrypt, and save media to gallery entirely on the Java side.
 * Only tiny strings cross the Capacitor bridge — no large binary data.
 * Returns { success: true } if saved, { success: false } on any error.
 */
export async function fetchDecryptAndSaveToGallery(
    url: string,
    key: string,
    nonce: string,
    sha256: string,
    mimeType: string,
    filename?: string
): Promise<MediaCacheSaveResult> {
    if (!isAndroidNative() || !AndroidMediaCache) {
        return { success: false };
    }

    if (!sha256 || sha256.trim().length === 0) {
        return { success: false };
    }

    try {
        return await AndroidMediaCache.fetchDecryptAndSave({
            url, key, nonce, sha256, mimeType, filename
        });
    } catch (e) {
        console.error('Failed to fetch-decrypt-save media:', e);
        return { success: false };
    }
}

/**
 * Check if media caching is enabled in settings.
 */
export function isMediaCacheEnabled(): boolean {
    if (!isAndroidNative()) {
        return false;
    }

    try {
        const saved = localStorage.getItem('nospeak-settings');
        if (saved) {
            const settings = JSON.parse(saved) as { mediaCacheEnabled?: boolean };
            return settings.mediaCacheEnabled === true;
        }
    } catch (e) {
        console.error('Failed to read media cache setting:', e);
    }

    return false;
}

/**
 * Load decrypted media from the local cache (MediaStore).
 * Returns a Capacitor-accessible URL if found, which can be used directly in <img>/<video> src.
 */
export async function loadFromMediaCache(
    sha256: string,
    mimeType: string
): Promise<MediaCacheLoadResult> {
    if (!isAndroidNative() || !AndroidMediaCache) {
        return { found: false };
    }

    if (!sha256 || sha256.trim().length === 0) {
        return { found: false };
    }

    try {
        const result = await AndroidMediaCache.loadFromCache({
            sha256,
            mimeType
        });

        return result;
    } catch (e) {
        console.error('Failed to load from media cache:', e);
        return { found: false };
    }
}
