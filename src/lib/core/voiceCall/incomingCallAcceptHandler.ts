import type { NostrEvent } from 'nostr-tools';
import { AndroidVoiceCall, type PendingIncomingCall } from './androidVoiceCallPlugin';
import { voiceCallService } from './VoiceCallService';
import { NIP_AC_KIND_OFFER, NIP_AC_STALENESS_SECONDS } from './constants';

/**
 * Called when the user tapped Accept on the lockscreen incoming-call
 * notification (route kind 'voice-call-accept'). Reads the persisted
 * offer from native SharedPreferences, synthesizes a NIP-AC kind-25050
 * inner event from the stored fields, hands it to the voice-call
 * service, and auto-accepts — the user already chose Accept on the
 * lockscreen, so no in-app IncomingCallOverlay confirmation is needed.
 *
 * The synthesized inner event omits `id` and `sig`. Signature
 * verification has already happened in the native side
 * (`NativeBackgroundMessagingService.handleNipAcCallEvent`) before the
 * payload was persisted. The JS receive path's signature check only
 * applies to events arriving via `handleNipAcWrap`; events synthesized
 * here go directly to `handleNipAcEvent`, which trusts its caller.
 *
 * Idempotent: if the pending offer is missing, has the legacy schema,
 * or its `createdAt` is older than the staleness window, surfaces a
 * missed-call toast and returns.
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
        // No pending call, the plugin returned legacy-shape and discarded
        // it, or it was stale. Surface a toast so the user knows the
        // lockscreen Accept tap landed too late.
        console.log('[VoiceCall] voice-call-accept route fired but no pending call found');
        await surfaceMissedCallToast();
        return;
    }

    // NIP-AC staleness on the stored offer's createdAt.
    const nowSec = Math.floor(Date.now() / 1000);
    if (
        typeof pending.createdAt !== 'number' ||
        nowSec - pending.createdAt > NIP_AC_STALENESS_SECONDS
    ) {
        console.log('[VoiceCall] pending offer is stale; treating as missed');
        try {
            await AndroidVoiceCall.clearPendingIncomingCall();
        } catch {
            /* best-effort */
        }
        await surfaceMissedCallToast();
        return;
    }

    // Best-effort cleanup. If this fails, the offer might be picked up
    // again on a later cold start, but VoiceCallService.handleOffer
    // dedups by callId+peer.
    try {
        await AndroidVoiceCall.clearPendingIncomingCall();
    } catch (err) {
        console.warn('[VoiceCall] clearPendingIncomingCall failed (ignoring)', err);
    }

    // Synthesize a minimal kind-25050 inner event for handleNipAcEvent.
    // No id/sig — see method docstring.
    const synthetic: NostrEvent = {
        kind: NIP_AC_KIND_OFFER,
        pubkey: pending.peerHex,
        created_at: pending.createdAt,
        content: pending.sdp,
        tags: [
            ['call-id', pending.callId],
            ['call-type', pending.callType],
            ['alt', pending.alt]
        ],
        // These fields are required by the NostrEvent type but unused by
        // handleNipAcEvent. Filling them with empty strings rather than
        // forging values.
        id: pending.innerEventId,
        sig: ''
    };

    await voiceCallService.handleNipAcEvent(synthetic);

    // Auto-accept — user already chose Accept on the lockscreen.
    await voiceCallService.acceptCall();
}

async function surfaceMissedCallToast(): Promise<void> {
    try {
        const { showToast } = await import('$lib/stores/toast');
        showToast('Missed call', 'info');
    } catch (err) {
        console.warn('[VoiceCall] could not surface missed-call toast', err);
    }
}
