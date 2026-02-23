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
     * Save a file to the media cache (MediaStore).
     * The file will be saved to Pictures/nospeak images/, Movies/nospeak videos/, 
     * or Music/nospeak audio/ depending on the MIME type.
     */
    saveToCache(options: {
        sha256: string;
        mimeType: string;
        base64Data: string;
        filename?: string;
    }): Promise<MediaCacheSaveResult>;

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
 * Save decrypted media to the local cache (MediaStore).
 * The file will appear in the device gallery under "nospeak images/videos/audio" albums.
 */
export async function saveToMediaCache(
    sha256: string,
    mimeType: string,
    blob: Blob,
    filename?: string
): Promise<MediaCacheSaveResult> {
    if (!isAndroidNative() || !AndroidMediaCache) {
        return { success: false };
    }

    if (!sha256 || sha256.trim().length === 0) {
        return { success: false };
    }

    try {
        // Convert blob to base64
        const base64Data = await blobToBase64(blob);

        const result = await AndroidMediaCache.saveToCache({
            sha256,
            mimeType,
            base64Data,
            filename
        });
        
        return { success: result.success };
    } catch (e) {
        console.error('Failed to save to media cache:', e);
        return { success: false };
    }
}

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

/**
 * Convert a Blob to a base64 string (without the data URL prefix).
 */
async function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const dataUrl = reader.result as string;
            // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
            const base64 = dataUrl.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}
