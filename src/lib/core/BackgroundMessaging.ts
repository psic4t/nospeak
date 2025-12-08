import { get } from 'svelte/store';
import { currentUser } from '$lib/stores/auth';
import { profileRepo } from '$lib/db/ProfileRepository';
import { connectionManager } from './connection/instance';
import { isAndroidNative } from './NativeDialogs';

interface NospeakSettings {
    notificationsEnabled?: boolean;
    urlPreviewsEnabled?: boolean;
    backgroundMessagingEnabled?: boolean;
}

function loadSettings(): NospeakSettings {
    if (typeof window === 'undefined' || !window.localStorage) {
        return {};
    }

    try {
        const raw = window.localStorage.getItem('nospeak-settings');
        if (!raw) return {};
        const parsed = JSON.parse(raw) as NospeakSettings;
        return parsed || {};
    } catch (e) {
        console.error('Failed to load nospeak-settings for background messaging:', e);
        return {};
    }
}

export function isBackgroundMessagingPreferenceEnabled(): boolean {
    const settings = loadSettings();
    return settings.backgroundMessagingEnabled === true;
}

function buildRelaySummary(relays: string[]): string {
    if (!relays || relays.length === 0) {
        return 'No read relays configured';
    }

    const uniqueRelays = Array.from(new Set(relays));
    const limited = uniqueRelays.slice(0, 4);
    const list = limited.join(', ');

    return `Connected to read relays: ${list}`;
}

async function startNativeForegroundService(summary: string): Promise<void> {
    if (typeof window === 'undefined') {
        return;
    }

    const anyWindow: any = window as any;
    const plugin = anyWindow.Capacitor && anyWindow.Capacitor.Plugins && anyWindow.Capacitor.Plugins.BackgroundMessaging;
    if (!plugin || typeof plugin.start !== 'function') {
        console.warn('BackgroundMessaging plugin not available on this platform');
        return;
    }

    try {
        await plugin.start({ summary });
    } catch (e) {
        console.error('Failed to start Android background messaging service:', e);
    }
}

async function stopNativeForegroundService(): Promise<void> {
    if (typeof window === 'undefined') {
        return;
    }

    const anyWindow: any = window as any;
    const plugin = anyWindow.Capacitor && anyWindow.Capacitor.Plugins && anyWindow.Capacitor.Plugins.BackgroundMessaging;
    if (!plugin || typeof plugin.stop !== 'function') {
        console.warn('BackgroundMessaging plugin not available on this platform');
        return;
    }

    try {
        await plugin.stop();
    } catch (e) {
        console.error('Failed to stop Android background messaging service:', e);
    }
}

export async function enableAndroidBackgroundMessaging(): Promise<void> {
    if (!isAndroidNative()) {
        return;
    }

    const user = get(currentUser);
    let readRelays: string[] = [];

    try {
        if (user?.npub) {
            const profile = await profileRepo.getProfileIgnoreTTL(user.npub);
            if (profile?.readRelays && Array.isArray(profile.readRelays)) {
                readRelays = profile.readRelays;
            }
        }
    } catch (e) {
        console.error('Failed to load profile for Android background messaging:', e);
    }

    const summary = buildRelaySummary(readRelays);

    // Apply more conservative reconnection behavior while background messaging is enabled
    connectionManager.setBackgroundModeEnabled(true);

    await startNativeForegroundService(summary);
}

export async function disableAndroidBackgroundMessaging(): Promise<void> {
    if (!isAndroidNative()) {
        return;
    }

    // Restore default reconnection behavior
    connectionManager.setBackgroundModeEnabled(false);

    await stopNativeForegroundService();
}

export async function syncAndroidBackgroundMessagingFromPreference(): Promise<void> {
    if (!isAndroidNative()) {
        return;
    }

    if (isBackgroundMessagingPreferenceEnabled()) {
        await enableAndroidBackgroundMessaging();
    } else {
        await disableAndroidBackgroundMessaging();
    }
}
