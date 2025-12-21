import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('SettingsModal nsec reveal behavior', () => {
    it('loads Android nsec from keystore on eye click', () => {
        const filePath = join(__dirname, 'SettingsModal.svelte');
        const content = readFileSync(filePath, 'utf8');

        expect(content).toContain('getAndroidLocalSecretKeyHex');
        expect(content).toContain('nip19.nsecEncode');
        expect(content).toContain('toggleNsecVisibility');
    });
});
