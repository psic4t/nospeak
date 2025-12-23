import { describe, expect, it, vi } from 'vitest';

vi.mock('$lib/core/NativeDialogs', () => ({
    isAndroidNative: () => true
}));

const mockServiceAddTopic = vi.fn(async () => {});
const mockServiceSaveSettings = vi.fn();

vi.mock('$lib/core/UnifiedPushService', () => ({
    startUnifiedPush: vi.fn(async () => {}),
    stopUnifiedPush: vi.fn(async () => {}),
    addTopic: mockServiceAddTopic,
    removeTopic: vi.fn(async () => {}),
    getRegistrations: vi.fn(async () => []),
    removeRegistration: vi.fn(async () => {}),
    testPush: vi.fn(async () => {}),
    getConfig: vi.fn(async () => ({ enabled: true, serverUrl: 'https://ntfy.sh', topics: [] })),
    getSettings: vi.fn(() => ({ enabled: true, serverUrl: 'https://ntfy.sh', topics: [] })),
    isUnifiedPushEnabled: vi.fn(() => true),
    isValidServerUrl: vi.fn(() => true),
    saveSettings: mockServiceSaveSettings
}));

describe('unifiedPush store addTopic', () => {
    it('calls the native addTopic handler before persisting', async () => {
        vi.resetModules();

        const { unifiedPush } = await import('$lib/stores/unifiedPush');

        let latestTopics: string[] = [];
        const unsubscribe = unifiedPush.subscribe((settings) => {
            latestTopics = settings.topics;
        });

        await unifiedPush.addTopic('alerts');

        expect(mockServiceAddTopic).toHaveBeenCalledWith('alerts');
        expect(latestTopics).toEqual(['alerts']);

        // The store should not pre-write local settings (UnifiedPushService does that).
        expect(mockServiceSaveSettings).not.toHaveBeenCalled();

        unsubscribe();
    });
});
