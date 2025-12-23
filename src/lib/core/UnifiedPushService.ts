import { Capacitor, registerPlugin } from '@capacitor/core';
import { isAndroidNative } from './NativeDialogs';

export interface UnifiedPushSettings {
    enabled: boolean;
    serverUrl: string;
    topics: string[];
}

export interface UnifiedPushRegistration {
    token: string;
    packageName: string;
    endpoint: string;
    vapidKey: string;
    message: string;
    topic?: string;
    installed?: boolean;
    removable?: boolean;
}

interface AndroidUnifiedPushPlugin {
    start(options: { serverUrl: string; topics: string[] }): Promise<void>;
    stop(): Promise<void>;
    addTopic(options: { topic: string }): Promise<void>;
    removeTopic(options: { topic: string }): Promise<void>;
    removeRegistration(options: { token: string }): Promise<void>;
    getRegistrations(): Promise<{ registrations: UnifiedPushRegistration[] }>;
    updateNotificationSummary(options: { summary: string }): Promise<void>;
    testPush(options: { serverUrl: string }): Promise<void>;
    getConfig(): Promise<UnifiedPushSettings>;
}

const AndroidUnifiedPush = registerPlugin<AndroidUnifiedPushPlugin>('AndroidUnifiedPush');

const MAX_TOPICS = 20;
const STORAGE_KEY = 'nospeak-unifiedpush-settings';

export function loadSettings(): UnifiedPushSettings {
    if (typeof window === 'undefined' || !window.localStorage) {
        return { enabled: false, serverUrl: '', topics: [] };
    }

    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return { enabled: false, serverUrl: '', topics: [] };
        const parsed = JSON.parse(raw) as UnifiedPushSettings;
        return parsed || { enabled: false, serverUrl: '', topics: [] };
    } catch (e) {
        console.error('Failed to load UnifiedPush settings:', e);
        return { enabled: false, serverUrl: '', topics: [] };
    }
}

export function saveSettings(settings: UnifiedPushSettings): void {
    if (typeof window === 'undefined' || !window.localStorage) {
        return;
    }

    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
        console.error('Failed to save UnifiedPush settings:', e);
    }
}

export async function startUnifiedPush(serverUrl: string): Promise<void> {
    if (Capacitor.getPlatform() !== 'android' || !isAndroidNative()) {
        return;
    }

    const settings = loadSettings();
    const topics = settings.topics || [];

    settings.enabled = true;
    settings.serverUrl = serverUrl;
    settings.topics = topics;

    saveSettings(settings);

    try {
        await AndroidUnifiedPush.start({ serverUrl, topics });
    } catch (e) {
        console.error('Failed to start UnifiedPush:', e);
        throw e;
    }
}

export async function stopUnifiedPush(): Promise<void> {
    if (Capacitor.getPlatform() !== 'android' || !isAndroidNative()) {
        return;
    }

    const settings = loadSettings();
    settings.enabled = false;

    saveSettings(settings);

    try {
        await AndroidUnifiedPush.stop();
    } catch (e) {
        console.error('Failed to stop UnifiedPush:', e);
        throw e;
    }
}

export async function addTopic(topic: string): Promise<void> {
    if (Capacitor.getPlatform() !== 'android' || !isAndroidNative()) {
        return;
    }

    const settings = loadSettings();

    if (settings.topics.includes(topic)) {
        return;
    }

    if (settings.topics.length >= MAX_TOPICS) {
        throw new Error(`Maximum of ${MAX_TOPICS} topics allowed`);
    }

    settings.topics.push(topic);
    saveSettings(settings);

    try {
        await AndroidUnifiedPush.addTopic({ topic });
    } catch (e) {
        console.error('Failed to add UnifiedPush topic:', e);
        throw e;
    }
}

export async function removeTopic(topic: string): Promise<void> {
    if (Capacitor.getPlatform() !== 'android' || !isAndroidNative()) {
        return;
    }

    const settings = loadSettings();
    settings.topics = settings.topics.filter((t) => t !== topic);
    saveSettings(settings);

    try {
        await AndroidUnifiedPush.removeTopic({ topic });
    } catch (e) {
        console.error('Failed to remove UnifiedPush topic:', e);
        throw e;
    }
}

export async function getRegistrations(): Promise<UnifiedPushRegistration[]> {
    if (Capacitor.getPlatform() !== 'android' || !isAndroidNative()) {
        return [];
    }

    try {
        const result = await AndroidUnifiedPush.getRegistrations();
        return result.registrations || [];
    } catch (e) {
        console.error('Failed to get UnifiedPush registrations:', e);
        return [];
    }
}

export async function removeRegistration(token: string): Promise<void> {
    if (Capacitor.getPlatform() !== 'android' || !isAndroidNative()) {
        return;
    }

    if (!token) {
        throw new Error('token is required');
    }

    await AndroidUnifiedPush.removeRegistration({ token });
}

export async function updateNotificationSummary(summary: string): Promise<void> {
    if (Capacitor.getPlatform() !== 'android' || !isAndroidNative()) {
        return;
    }

    try {
        await AndroidUnifiedPush.updateNotificationSummary({ summary });
    } catch (e) {
        console.error('Failed to update UnifiedPush notification summary:', e);
    }
}

export async function testPush(serverUrl: string): Promise<void> {
    if (Capacitor.getPlatform() !== 'android' || !isAndroidNative()) {
        return;
    }

    try {
        await AndroidUnifiedPush.testPush({ serverUrl });
    } catch (e) {
        console.error('Failed to send UnifiedPush test message:', e);
        throw e;
    }
}

export async function getConfig(): Promise<UnifiedPushSettings> {
    if (Capacitor.getPlatform() !== 'android' || !isAndroidNative()) {
        return { enabled: false, serverUrl: '', topics: [] };
    }

    try {
        const config = await AndroidUnifiedPush.getConfig();
        saveSettings(config);
        return config;
    } catch (e) {
        console.error('Failed to get UnifiedPush config:', e);
        return loadSettings();
    }
}

export function getSettings(): UnifiedPushSettings {
    return loadSettings();
}

export function isUnifiedPushEnabled(): boolean {
    return loadSettings().enabled;
}

export function isValidServerUrl(url: string): boolean {
    if (!url || typeof url !== 'string') {
        return false;
    }

    const trimmed = url.trim();
    if (!trimmed) {
        return false;
    }

    try {
        const parsed = new URL(trimmed.startsWith('http://') || trimmed.startsWith('https://') ? trimmed : `https://${trimmed}`);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
}
