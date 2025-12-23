import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

describe('SettingsModal UnifiedPush topics reactivity', () => {
    it('subscribes to the unifiedPush store for topics', () => {
        const filePath = join(__dirname, 'SettingsModal.svelte');
        const content = readFileSync(filePath, 'utf8');

        expect(content).toContain('unifiedPush.subscribe');
        expect(content).toContain('unifiedPushTopics = settings.topics || []');
        expect(content).toContain('unifiedPushEnabled = settings.enabled');

        // Ensure we do not rely on non-reactive localStorage snapshots for updates.
        expect(content).not.toContain('getSettings');
        expect(content).not.toContain('isUnifiedPushEnabled');
    });
});
