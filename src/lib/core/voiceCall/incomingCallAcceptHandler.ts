import { AndroidVoiceCall, type PendingIncomingCall } from './androidVoiceCallPlugin';
import { voiceCallService } from './VoiceCallService';
import type { VoiceCallSignal } from './types';

/**
 * Called when the user tapped Accept on the lockscreen incoming-call notification
 * (route kind 'voice-call-accept'). Reads the persisted offer from native
 * SharedPrefs, hands it to the voice-call service, and auto-accepts —
 * the user already chose Accept on the lockscreen, so no in-app
 * IncomingCallOverlay confirmation is needed.
 *
 * Idempotent: if the pending offer is missing or expired, logs and returns.
 * Failures during clearPendingIncomingCall are non-fatal.
 */
export async function handleVoiceCallAcceptRoute(): Promise<void> {
    let pending: PendingIncomingCall | null;
    try {
        const result = await AndroidVoiceCall.getPendingIncomingCall();
        pending = result.pending;
    } catch (err) {
        console.warn('[VoiceCall] getPendingIncomingCall failed', err);
        return;
    }

    if (!pending) {
        // No pending call (or it was stale and the plugin already cleared it).
        // Surface a toast so the user knows the lockscreen Accept tap landed too late.
        console.log('[VoiceCall] voice-call-accept route fired but no pending call found');
        try {
            const { showToast } = await import('$lib/stores/toast');
            showToast('Missed call', 'info');
        } catch (err) {
            // Toast is best-effort; never throw from the route handler.
            console.warn('[VoiceCall] could not surface missed-call toast', err);
        }
        return;
    }

    // Best-effort cleanup. If this fails, the offer might be picked up again on
    // a later cold start, but VoiceCallService.handleOffer dedup will filter.
    try {
        await AndroidVoiceCall.clearPendingIncomingCall();
    } catch (err) {
        console.warn('[VoiceCall] clearPendingIncomingCall failed (ignoring)', err);
    }

    let signal: VoiceCallSignal;
    try {
        signal = JSON.parse(pending.signalJson);
    } catch (err) {
        console.warn('[VoiceCall] Failed to parse pending signalJson', err);
        return;
    }
    if (signal.type !== 'voice-call' || signal.action !== 'offer') {
        console.warn('[VoiceCall] Pending call is not a voice-call offer; ignoring');
        return;
    }

    // Synthesize the incoming-ringing state by feeding the offer to handleSignal.
    await voiceCallService.handleSignal(signal, pending.senderNpub);

    // Auto-accept — user already chose Accept on the lockscreen.
    await voiceCallService.acceptCall();
}
