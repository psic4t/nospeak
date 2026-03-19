import { Capacitor, registerPlugin } from '@capacitor/core';

import { isAndroidNative } from './NativeDialogs';

interface AndroidDownloadsPlugin {
    saveToDownloads(options: {
        filename: string;
        data: string;
        mimeType?: string;
    }): Promise<{ success: boolean; error?: string }>;
}

const AndroidDownloads = ((): AndroidDownloadsPlugin | null => {
    if (Capacitor.getPlatform() !== 'android') {
        return null;
    }

    return registerPlugin<AndroidDownloadsPlugin>('AndroidDownloads');
})();

export async function saveToDownloads(
    filename: string,
    data: string,
    mimeType?: string
): Promise<boolean> {
    if (!isAndroidNative() || !AndroidDownloads) {
        return false;
    }

    if (!filename || filename.trim().length === 0) {
        return false;
    }

    if (!data || data.trim().length === 0) {
        return false;
    }

    try {
        const result = await AndroidDownloads.saveToDownloads({
            filename,
            data,
            mimeType
        });

        return result.success;
    } catch (e) {
        console.error('Failed to save to Downloads:', e);
        return false;
    }
}
