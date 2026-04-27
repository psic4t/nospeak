import { Capacitor } from '@capacitor/core';
import { AndroidVoiceCall } from './androidVoiceCallPlugin';

const SKIP_KEY = 'nospeak:voice-call:fsi-permission-skipped';

export interface FsiPromptDecision {
    /** True if the prompt should be shown (Android, not granted, not previously skipped). */
    shouldPrompt: boolean;
}

/**
 * Decide whether to show the full-screen-intent permission prompt.
 * Only relevant on Android. Returns `{ shouldPrompt: false }` on web/iOS,
 * when the permission is already granted, or when the user has previously skipped.
 */
export async function evaluateFullScreenIntentPermission(): Promise<FsiPromptDecision> {
    if (Capacitor.getPlatform() !== 'android') return { shouldPrompt: false };
    if (typeof localStorage !== 'undefined' && localStorage.getItem(SKIP_KEY) === 'true') {
        return { shouldPrompt: false };
    }
    try {
        const { granted } = await AndroidVoiceCall.canUseFullScreenIntent();
        return { shouldPrompt: !granted };
    } catch (err) {
        console.warn('[VoiceCall] canUseFullScreenIntent failed', err);
        return { shouldPrompt: false };
    }
}

export function recordFsiPermissionSkipped(): void {
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem(SKIP_KEY, 'true');
    }
}
