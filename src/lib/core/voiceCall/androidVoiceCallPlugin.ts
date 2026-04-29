import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';

/**
 * Cold-start handoff payload persisted in SharedPreferences
 * `nospeak_pending_incoming_call`. Schema is the NIP-AC shape: enough
 * fields to synthesize a kind-25050 inner event for the JS pipeline
 * without re-fetching the gift wrap.
 *
 * Old-shape entries from pre-NIP-AC builds (lacking `callType`, `alt`,
 * `innerEventId`, or `createdAt`) MUST be ignored by the read path; the
 * Capacitor plugin returns `{ pending: null }` for them.
 */
export interface PendingIncomingCall {
    callId: string;
    /** Raw SDP offer string. */
    sdp: string;
    /** Sender pubkey, hex-encoded. */
    peerHex: string;
    /** NIP-AC `call-type` tag value, currently always `'voice'`. */
    callType: 'voice' | 'video';
    /** NIP-AC `alt` tag content. */
    alt: string;
    /** Inner event id (kind 25050) — used for dedup against live subscription. */
    innerEventId: string;
    /** Inner event `created_at` (Unix seconds) — used for staleness check. */
    createdAt: number;
}

export interface AndroidVoiceCallPluginShape {
    startCallSession(opts: {
        callId: string;
        peerNpub: string;
        peerName?: string;
        role: 'incoming' | 'outgoing';
    }): Promise<void>;

    endCallSession(): Promise<void>;

    getPendingIncomingCall(): Promise<{ pending: PendingIncomingCall | null }>;

    clearPendingIncomingCall(): Promise<void>;

    /**
     * NIP-AC multi-device: another device of the same user has answered
     * or rejected the call. The native side cancels the FSI notification,
     * finishes `IncomingCallActivity` if it's showing, and stops the
     * ringer foreground service. Best-effort; safe to call when none of
     * those are active.
     */
    dismissIncomingCall(opts: { callId: string }): Promise<void>;

    canUseFullScreenIntent(): Promise<{ granted: boolean }>;

    requestFullScreenIntentPermission(): Promise<void>;

    addListener(
        eventName: 'hangupRequested',
        cb: (data: { callId: string }) => void
    ): Promise<PluginListenerHandle>;

    addListener(
        eventName: 'pendingCallAvailable',
        cb: (data: { callId: string }) => void
    ): Promise<PluginListenerHandle>;
}

export const AndroidVoiceCall = registerPlugin<AndroidVoiceCallPluginShape>('AndroidVoiceCall');
