import { Capacitor, registerPlugin } from '@capacitor/core';

import { isAndroidNative } from './NativeDialogs';

interface AndroidLocalSecretKeyPlugin {
    setSecretKeyHex(options: { secretKeyHex: string }): Promise<void>;
    getSecretKeyHex(): Promise<{ secretKeyHex: string | null }>;
    clearSecretKey(): Promise<void>;
}

const AndroidLocalSecretKey = ((): AndroidLocalSecretKeyPlugin | null => {
    if (Capacitor.getPlatform() !== 'android') {
        return null;
    }

    return registerPlugin<AndroidLocalSecretKeyPlugin>('AndroidLocalSecretKey');
})();

export async function setAndroidLocalSecretKeyHex(secretKeyHex: string): Promise<void> {
    if (!isAndroidNative() || !AndroidLocalSecretKey) {
        return;
    }

    if (!secretKeyHex || secretKeyHex.trim().length === 0) {
        throw new Error('secretKeyHex is required');
    }

    await AndroidLocalSecretKey.setSecretKeyHex({ secretKeyHex });
}

export async function getAndroidLocalSecretKeyHex(): Promise<string | null> {
    if (!isAndroidNative() || !AndroidLocalSecretKey) {
        return null;
    }

    const result = await AndroidLocalSecretKey.getSecretKeyHex();
    const secretKeyHex = result?.secretKeyHex ?? null;

    if (typeof secretKeyHex !== 'string' || secretKeyHex.trim().length === 0) {
        return null;
    }

    return secretKeyHex;
}

export async function clearAndroidLocalSecretKey(): Promise<void> {
    if (!isAndroidNative() || !AndroidLocalSecretKey) {
        return;
    }

    await AndroidLocalSecretKey.clearSecretKey();
}
