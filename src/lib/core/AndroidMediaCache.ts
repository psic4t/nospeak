import { Capacitor, registerPlugin } from '@capacitor/core';

import { isAndroidNative } from './NativeDialogs';

/**
 * Result of saving a file to the media cache.
 */
export interface MediaCacheSaveResult {
    /** Whether the save was successful */
    success: boolean;
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
