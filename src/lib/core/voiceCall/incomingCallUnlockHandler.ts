/**
 * Handler for the {@code voice-call-unlock} notification route. Phase
 * 2 of the {@code add-native-voice-calls} OpenSpec change.
 *
 * <p>Triggered when the lockscreen {@code IncomingCallActivity}'s
 * Accept tap detects a PIN-locked nsec (the
 * {@code NativeBackgroundMessagingService} either is not running yet
 * or has no in-memory {@code localSecretKey}). The activity launches
 * MainActivity with {@code EXTRA_UNLOCK_FOR_CALL=<callId>}; the JS
 * layer surfaces the existing unlock screen via the {@code isPinLocked}
 * store; once the user enters their PIN AND {@code currentUser} is
 * available (so the messaging service is fully bootstrapped), this
 * handler calls
 * {@code AndroidVoiceCall.notifyUnlockComplete({ callId })} which in
 * turn fires the {@code nospeak.ACTION_UNLOCK_COMPLETE} broadcast that
 * the active foreground service listens for.
 *
 * <p>Times out after 30 seconds. The native FGS has its own 30s
 * timeout that sends a kind-25054 reject + missed-call rumor if the
 * unlock never completes.
 */

import { get } from 'svelte/store';
import { isPinLocked } from '$lib/stores/pin';
import { currentUser } from '$lib/stores/auth';
import { AndroidVoiceCall } from '$lib/core/voiceCall/androidVoiceCallPlugin';

const UNLOCK_WAIT_TIMEOUT_MS = 30_000;

/**
 * Wait for both the PIN lock to clear AND the user store to be
 * populated (which means {@code initBackgroundMessaging} has run, the
 * native messaging service has been started, and the local nsec is
 * available in memory). Resolves to {@code true} on success,
 * {@code false} on timeout.
 */
function waitForReady(timeoutMs: number): Promise<boolean> {
    return new Promise((resolve) => {
        const isReady = () => !get(isPinLocked) && !!get(currentUser);
        if (isReady()) {
            resolve(true);
            return;
        }

        let settled = false;
        const cleanup = () => {
            if (settled) return;
            settled = true;
            unsubPin();
            unsubUser();
            clearTimeout(timer);
        };

        const unsubPin = isPinLocked.subscribe(() => {
            if (isReady()) {
                cleanup();
                resolve(true);
            }
        });
        const unsubUser = currentUser.subscribe(() => {
            if (isReady()) {
                cleanup();
                resolve(true);
            }
        });
        const timer = setTimeout(() => {
            cleanup();
            resolve(false);
        }, timeoutMs);
    });
}

export async function handleVoiceCallUnlockRoute(callId: string): Promise<void> {
    if (!callId) return;
    const ok = await waitForReady(UNLOCK_WAIT_TIMEOUT_MS);
    if (!ok) {
        console.warn(
            '[VoiceCallUnlock] timed out waiting for PIN unlock + user; native FGS will reject the call'
        );
        return;
    }
    try {
        await AndroidVoiceCall.notifyUnlockComplete({ callId });
    } catch (err) {
        console.error('[VoiceCallUnlock] notifyUnlockComplete failed', err);
    }
}
