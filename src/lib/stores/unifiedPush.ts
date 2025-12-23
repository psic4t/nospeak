import { derived, writable, type Readable } from 'svelte/store';
import { isAndroidNative } from '$lib/core/NativeDialogs';
import type { UnifiedPushSettings, UnifiedPushRegistration } from '$lib/core/UnifiedPushService';
import {
    startUnifiedPush,
    stopUnifiedPush,
    addTopic as serviceAddTopic,
    removeTopic as serviceRemoveTopic,
    getRegistrations as serviceGetRegistrations,
    removeRegistration as serviceRemoveRegistration,
    testPush as serviceTestPush,
    getConfig,
    getSettings,
    isUnifiedPushEnabled,
    isValidServerUrl,
    saveSettings as serviceSaveSettings
} from '$lib/core/UnifiedPushService';

const MAX_TOPICS = 20;

function createUnifiedPushStore() {
    const { subscribe, set, update } = writable<UnifiedPushSettings>({
        enabled: false,
        serverUrl: '',
        topics: []
    });

    const registrations = writable<UnifiedPushRegistration[]>([]);
    const loading = writable<boolean>(false);
    const error = writable<string | null>(null);

    async function initialize(): Promise<void> {
        if (!isAndroidNative()) {
            return;
        }

        loading.set(true);
        error.set(null);

        try {
            const config = await getConfig();
            set(config);

            const regs = await serviceGetRegistrations();
            registrations.set(regs);
        } catch (e) {
            console.error('Failed to initialize UnifiedPush:', e);
            error.set('Failed to load UnifiedPush settings');
        } finally {
            loading.set(false);
        }
    }

    async function setEnabled(enabled: boolean): Promise<void> {
        if (!isAndroidNative()) {
            return;
        }

        const settings = getSettings();

        if (enabled && !settings.serverUrl) {
            error.set('Server URL is required to enable UnifiedPush');
            return;
        }

        loading.set(true);
        error.set(null);

        try {
            if (enabled) {
                await startUnifiedPush(settings.serverUrl);
            } else {
                await stopUnifiedPush();
            }

            update((s) => ({ ...s, enabled }));
        } catch (e) {
            console.error('Failed to enable/disable UnifiedPush:', e);
            error.set('Failed to enable/disable UnifiedPush');
        } finally {
            loading.set(false);
        }
    }

    async function setServerUrl(url: string): Promise<void> {
        if (!isAndroidNative()) {
            return;
        }

        const trimmed = url.trim();

        if (!trimmed) {
            error.set('Server URL is required');
            return;
        }

        if (!isValidServerUrl(trimmed)) {
            error.set('Invalid server URL (must be HTTP or HTTPS)');
            return;
        }

        const settings = getSettings();
        settings.serverUrl = trimmed;
        serviceSaveSettings(settings);
        update((s) => ({ ...s, serverUrl: trimmed }));
        error.set(null);
    }

    async function addTopic(topic: string): Promise<void> {
        if (!isAndroidNative()) {
            return;
        }

        const trimmed = topic.trim();

        if (!trimmed) {
            error.set('Topic cannot be empty');
            return;
        }

        if (trimmed.includes(',') || trimmed.includes('/')) {
            error.set("Topic cannot contain ',' or '/'");
            return;
        }

        const settings = getSettings();
        const previousTopics = settings.topics;

        if (previousTopics.includes(trimmed)) {
            error.set('Topic already exists');
            return;
        }

        if (previousTopics.length >= MAX_TOPICS) {
            error.set(`Maximum of ${MAX_TOPICS} topics allowed`);
            return;
        }

        const newTopics = [...previousTopics, trimmed];

        // Optimistically update the UI.
        update((s) => ({ ...s, topics: newTopics }));
        error.set(null);

        try {
            // IMPORTANT: Call the native plugin before writing to localStorage.
            // UnifiedPushService.addTopic() no-ops if localStorage already contains the topic,
            // so saving first can prevent Android prefs from ever being updated.
            await serviceAddTopic(trimmed);
        } catch (e) {
            console.error('Failed to add topic:', e);
            error.set('Failed to add topic');

            serviceSaveSettings({
                ...settings,
                topics: previousTopics
            });

            update((s) => ({ ...s, topics: previousTopics }));
        }
    }

    async function removeTopic(topic: string): Promise<void> {
        if (!isAndroidNative()) {
            return;
        }

        const settings = getSettings();
        const newTopics = settings.topics.filter((t) => t !== topic);

        serviceSaveSettings({
            ...settings,
            topics: newTopics
        });

        update((s) => ({ ...s, topics: newTopics }));

        try {
            await serviceRemoveTopic(topic);
            error.set(null);
        } catch (e) {
            console.error('Failed to remove topic:', e);
            error.set('Failed to remove topic');
        }
    }

    async function refreshRegistrations(): Promise<void> {
        if (!isAndroidNative()) {
            return;
        }

        try {
            const regs = await serviceGetRegistrations();
            registrations.set(regs);
        } catch (e) {
            console.error('Failed to refresh registrations:', e);
        }
    }

    async function removeRegistration(token: string): Promise<void> {
        if (!isAndroidNative()) {
            return;
        }

        try {
            await serviceRemoveRegistration(token);
            await refreshRegistrations();
        } catch (e) {
            console.error('Failed to remove registration:', e);
            error.set('Failed to remove registration');
        }
    }

    async function sendTestPush(): Promise<void> {
        if (!isAndroidNative()) {
            return;
        }

        const settings = getSettings();

        if (!settings.serverUrl) {
            error.set('Server URL is required to send test push');
            return;
        }

        loading.set(true);
        error.set(null);

        try {
            await serviceTestPush(settings.serverUrl);
        } catch (e) {
            console.error('Failed to send test push:', e);
            error.set('Failed to send test push');
        } finally {
            loading.set(false);
        }
    }

    async function saveSettings(): Promise<void> {
        if (!isAndroidNative()) {
            return;
        }

        const settings = getSettings();

        if (settings.enabled && settings.serverUrl) {
            loading.set(true);
            error.set(null);

            try {
                if (!isUnifiedPushEnabled()) {
                    await startUnifiedPush(settings.serverUrl);
                    update((s) => ({ ...s, enabled: true }));
                }
            } catch (e) {
                console.error('Failed to save UnifiedPush settings:', e);
                error.set('Failed to save settings');
            } finally {
                loading.set(false);
            }
        }
    }

    function clearError(): void {
        error.set(null);
    }

    return {
        subscribe,
        set,
        update,
        initialize,
        setEnabled,
        setServerUrl,
        addTopic,
        removeTopic,
        refreshRegistrations,
        removeRegistration,
        sendTestPush,
        saveSettings,
        clearError,
        registrations: { subscribe: registrations.subscribe },
        loading: { subscribe: loading.subscribe },
        error: { subscribe: error.subscribe }
    };
}

export const unifiedPush = createUnifiedPushStore();

export const isUnifiedPushEnabledStore: Readable<boolean> = derived(
    unifiedPush,
    ($settings) => $settings.enabled
);

export const unifiedPushTopics: Readable<string[]> = derived(
    unifiedPush,
    ($settings) => $settings.topics
);

export const unifiedPushServerUrl: Readable<string> = derived(
    unifiedPush,
    ($settings) => $settings.serverUrl
);
