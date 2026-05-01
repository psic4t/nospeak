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
    /** NIP-AC `call-type` tag value: `'voice'` or `'video'`. */
    callType: 'voice' | 'video';
    /** NIP-AC `alt` tag content. */
    alt: string;
    /** Inner event id (kind 25050) — used for dedup against live subscription. */
    innerEventId: string;
    /** Inner event `created_at` (Unix seconds) — used for staleness check. */
    createdAt: number;
}

/**
 * Lifecycle / state union mirroring the JS-side {@link VoiceCallStatus}.
 * The {@code callStateChanged} event payload uses these as kebab-case
 * strings (see {@code NativeVoiceCallManager.CallStatus.wireName}).
 */
export type NativeCallStatus =
    | 'idle'
    | 'outgoing-ringing'
    | 'incoming-ringing'
    | 'connecting'
    | 'active'
    | 'ended';

/**
 * Payload of the {@code callHistoryWriteRequested} plugin event.
 * Emitted by the native call manager when a LOCAL-ONLY chat-history
 * rumor is required ({@code missed} or {@code cancelled}).
 *
 * The JS handler is expected to author the rumor through
 * {@code Messaging.createLocalCallEventMessage}.
 */
export interface CallHistoryWriteRequest {
    callId: string;
    type: 'missed' | 'cancelled';
    /** Remote peer's pubkey hex. Convert to npub for the messageRepo write. */
    peerHex: string;
    /** Original WebRTC initiator's pubkey hex; absent if the local user. */
    initiatorHex?: string;
    /** Always absent for local-only types — kept as optional for shape parity. */
    durationSec?: number;
}

/**
 * Payload of the {@code callHistoryRumorRequested} plugin event.
 * Emitted by the native call manager when a GIFT-WRAPPED chat-history
 * rumor is required ({@code ended}, {@code no-answer}, {@code failed},
 * {@code busy}). The JS handler is expected to author the rumor
 * through {@code Messaging.createCallEventMessage}, which gift-wraps
 * to both the peer and the local user (NIP-59 self-wrap).
 *
 * <p>Phase 1 stopgap; Phase 4 reimplements these types fully natively.
 */
export interface CallHistoryRumorRequest {
    callId: string;
    type: 'ended' | 'no-answer' | 'failed' | 'busy';
    peerHex: string;
    initiatorHex?: string;
    /** Present iff {@code type === 'ended'}. */
    durationSec?: number;
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

    // ===================================================================
    //  Native voice-call methods. The Android build always uses the
    //  native call stack; the web build never invokes these (the JS
    //  factory returns VoiceCallServiceWeb on non-Android platforms).
    // ===================================================================

    /**
     * Begin a native outgoing call. The optional {@code callKind}
     * field selects voice ({@code 'voice'}, default) or video
     * ({@code 'video'}); the FGS reads it off the intent and passes
     * it to {@code NativeVoiceCallManager.initiateCall(callId, peerHex,
     * kind)}.
     */
    initiateCall(opts: {
        callId: string;
        peerHex: string;
        peerName?: string;
        callKind?: 'voice' | 'video';
    }): Promise<void>;

    /** Accept the pending incoming call (reads SDP from SharedPreferences). */
    acceptCall(opts?: { callId?: string }): Promise<void>;

    /** Decline the in-progress incoming call. */
    declineCall(): Promise<void>;

    /** Hang up the active or in-progress native call. */
    hangup(): Promise<void>;

    /** Toggle local microphone mute. */
    toggleMute(opts: { muted: boolean }): Promise<void>;

    /** Toggle speakerphone routing through AudioManager. */
    toggleSpeaker(opts: { on: boolean }): Promise<void>;

    /**
     * Toggle the local camera on/off (track-level mute, no SDP
     * renegotiation). No-op on voice calls.
     */
    toggleCamera(opts: { off: boolean }): Promise<void>;

    /**
     * Switch between the front and back camera. No-op on voice calls.
     */
    flipCamera(): Promise<void>;

    /**
     * Phase 2 of add-native-voice-calls: emit the
     * {@code nospeak.ACTION_UNLOCK_COMPLETE} local broadcast that the
     * active foreground service listens for. Called by the JS unlock
     * route handler ({@code incomingCallUnlockHandler.ts}) once the
     * user has unlocked a previously-locked nsec. Best-effort.
     */
    notifyUnlockComplete(opts: { callId: string }): Promise<void>;

    addListener(
        eventName: 'hangupRequested',
        cb: (data: { callId: string }) => void
    ): Promise<PluginListenerHandle>;

    addListener(
        eventName: 'pendingCallAvailable',
        cb: (data: { callId: string }) => void
    ): Promise<PluginListenerHandle>;

    addListener(
        eventName: 'callStateChanged',
        cb: (data: {
            callId: string;
            status: NativeCallStatus;
            reason?: string;
        }) => void
    ): Promise<PluginListenerHandle>;

    addListener(
        eventName: 'durationTick',
        cb: (data: { callId: string; seconds: number }) => void
    ): Promise<PluginListenerHandle>;

    addListener(
        eventName: 'callError',
        cb: (data: { callId: string; code: string; message: string }) => void
    ): Promise<PluginListenerHandle>;

    addListener(
        eventName: 'muteStateChanged',
        cb: (data: { callId: string; muted: boolean }) => void
    ): Promise<PluginListenerHandle>;

    addListener(
        eventName: 'callHistoryWriteRequested',
        cb: (data: CallHistoryWriteRequest) => void
    ): Promise<PluginListenerHandle>;

    addListener(
        eventName: 'callHistoryRumorRequested',
        cb: (data: CallHistoryRumorRequest) => void
    ): Promise<PluginListenerHandle>;

    addListener(
        eventName: 'cameraStateChanged',
        cb: (data: { callId: string; cameraOff: boolean }) => void
    ): Promise<PluginListenerHandle>;

    addListener(
        eventName: 'facingModeChanged',
        cb: (data: { callId: string; facing: 'user' | 'environment' }) => void
    ): Promise<PluginListenerHandle>;
}

export const AndroidVoiceCall = registerPlugin<AndroidVoiceCallPluginShape>('AndroidVoiceCall');
