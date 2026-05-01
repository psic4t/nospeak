/**
 * Native (Android) implementation of {@link VoiceCallBackend}.
 *
 * <p>Thin proxy around the {@code AndroidVoiceCall} Capacitor plugin.
 * Forwards user intents (initiate / accept / decline / hangup / mute /
 * speaker) to the native call manager via plugin methods, and mirrors
 * native lifecycle events back into the existing {@code voiceCallState}
 * Svelte store so UI components keep working without platform
 * branching.
 *
 * <p>This class never owns an {@code RTCPeerConnection}, never
 * authors NIP-AC signaling itself, and never plays audio — all of
 * that work happens in {@code NativeVoiceCallManager} (Java) and the
 * Stream WebRTC SDK's {@code AudioDeviceModule}.
 *
 * <p>Web/PWA builds never reach this class: the factory in
 * {@code factory.ts} returns {@code VoiceCallServiceWeb} unless the
 * runtime platform is Android.
 */

import { get } from 'svelte/store';
import type { PluginListenerHandle } from '@capacitor/core';
import { nip19, type NostrEvent } from 'nostr-tools';

import { AndroidMicrophone } from '$lib/core/AndroidMicrophone';
import { AndroidCamera } from '$lib/core/AndroidCamera';

import {
    voiceCallState,
    setOutgoingRinging,
    setIncomingRinging,
    setConnecting,
    setActive,
    endCall,
    incrementDuration,
    resetCall,
    toggleMute as storeToggleMute,
    toggleSpeaker as storeToggleSpeaker,
    setEndedAnsweredElsewhere,
    setEndedRejectedElsewhere,
    setCameraOff,
    setFacingMode
} from '$lib/stores/voiceCall';
import { CALL_END_DISPLAY_MS } from './constants';

import type {
    VoiceCallBackend,
    NipAcSenders,
    CallEventCreator,
    CallKind,
    LocalCallEventCreator,
    VoiceCallEndReason,
    AuthoredCallEventType
} from './types';
import {
    AndroidVoiceCall,
    type CallHistoryWriteRequest,
    type CallHistoryRumorRequest,
    type NativeCallStatus
} from './androidVoiceCallPlugin';

/**
 * Map a native call status string to the corresponding Svelte store
 * mutator. Returns a function that takes an optional {@code reason}
 * for ended states (mapped to {@link VoiceCallEndReason}).
 */
function applyStatus(
    status: NativeCallStatus,
    reason: string | undefined,
    callId: string | null,
    peerNpub: string | null
): void {
    const current = get(voiceCallState);
    switch (status) {
        case 'outgoing-ringing':
            if (peerNpub && callId) setOutgoingRinging(peerNpub, callId);
            return;
        case 'incoming-ringing':
            if (peerNpub && callId) setIncomingRinging(peerNpub, callId);
            return;
        case 'connecting':
            // Don't overwrite peerNpub/callId — they were set on ringing.
            // setConnecting only flips status.
            if (current.status === 'idle') {
                // Defensive: native may emit 'connecting' first if we're
                // accepting a call from the lockscreen and the JS layer
                // never saw the incoming-ringing state.
                if (peerNpub && callId) setIncomingRinging(peerNpub, callId);
            }
            setConnecting();
            return;
        case 'active':
            setActive();
            return;
        case 'ended':
            endCall(mapEndReason(reason));
            return;
        case 'idle':
        default:
            return;
    }
}

function mapEndReason(reason: string | undefined): VoiceCallEndReason {
    switch (reason) {
        case 'hangup':
        case 'rejected':
        case 'busy':
        case 'timeout':
        case 'ice-failed':
        case 'error':
        case 'answered-elsewhere':
        case 'rejected-elsewhere':
            return reason;
        default:
            return 'hangup';
    }
}

/** Thin Promise-returning wrapper for plugin event subscription. */
type CallStateEvent = {
    callId: string;
    status: NativeCallStatus;
    reason?: string;
};
type DurationTickEvent = { callId: string; seconds: number };
type CallErrorEvent = { callId: string; code: string; message: string };
type MuteStateEvent = { callId: string; muted: boolean };

export class VoiceCallServiceNative implements VoiceCallBackend {
    private listeners: PluginListenerHandle[] = [];

    private createCallEventFn: CallEventCreator | null = null;
    private localCreateCallEventFn: LocalCallEventCreator | null = null;

    /**
     * The peerNpub for the current call. Native emits {@code peerHex};
     * we translate once at receipt and remember it so subsequent state
     * transitions (which carry no peer info) preserve the mapping.
     */
    private currentPeerNpub: string | null = null;
    private currentCallId: string | null = null;

    /**
     * Media kind of the active or most recent call. Set by initiateCall
     * (outgoing) and by the SharedPreferences pending-offer path
     * (incoming). Reset to {@code 'voice'} on idle/ended.
     */
    private callKind: CallKind = 'voice';

    /**
     * Pending {@code resetCall} timer scheduled when the native call
     * manager transitions to {@code ended}. Mirrors the legacy
     * {@code ActiveCallOverlay.svelte} effect — that overlay is
     * suppressed on Android, so without this timer the store would
     * stay at {@code ended} forever and subsequent {@code initiateCall}
     * attempts would early-return at the {@code idle} check.
     */
    private endResetTimer: ReturnType<typeof setTimeout> | null = null;

    constructor() {
        this.subscribeAll();
    }

    private async subscribeAll(): Promise<void> {
        try {
            this.listeners.push(
                await AndroidVoiceCall.addListener(
                    'callStateChanged',
                    (data: CallStateEvent) => this.onCallStateChanged(data)
                )
            );
            this.listeners.push(
                await AndroidVoiceCall.addListener(
                    'durationTick',
                    (data: DurationTickEvent) => this.onDurationTick(data)
                )
            );
            this.listeners.push(
                await AndroidVoiceCall.addListener(
                    'callError',
                    (data: CallErrorEvent) => this.onCallError(data)
                )
            );
            this.listeners.push(
                await AndroidVoiceCall.addListener(
                    'muteStateChanged',
                    (data: MuteStateEvent) => this.onMuteStateChanged(data)
                )
            );
            this.listeners.push(
                await AndroidVoiceCall.addListener(
                    'callHistoryWriteRequested',
                    (data: CallHistoryWriteRequest) =>
                        void this.onCallHistoryWriteRequested(data)
                )
            );
            this.listeners.push(
                await AndroidVoiceCall.addListener(
                    'callHistoryRumorRequested',
                    (data: CallHistoryRumorRequest) =>
                        void this.onCallHistoryRumorRequested(data)
                )
            );
            this.listeners.push(
                await AndroidVoiceCall.addListener(
                    'cameraStateChanged',
                    (data: { callId: string; cameraOff: boolean }) =>
                        this.onCameraStateChanged(data)
                )
            );
            this.listeners.push(
                await AndroidVoiceCall.addListener(
                    'facingModeChanged',
                    (data: { callId: string; facing: 'user' | 'environment' }) =>
                        this.onFacingModeChanged(data)
                )
            );
        } catch (err) {
            console.error('[VoiceCallNative] event subscription failed', err);
        }
    }

    private onCameraStateChanged(data: { callId: string; cameraOff: boolean }): void {
        setCameraOff(!!data.cameraOff);
    }

    private onFacingModeChanged(data: { callId: string; facing: 'user' | 'environment' }): void {
        setFacingMode(data.facing === 'environment' ? 'environment' : 'user');
    }

    // -----------------------------------------------------------------
    //  VoiceCallBackend — registration + utility
    // -----------------------------------------------------------------

    /**
     * NIP-AC senders are owned by the JS layer (via Messaging.ts) on
     * the web build but are dormant on Android: the native call
     * manager publishes its own NIP-AC signals through
     * {@code NativeBackgroundMessagingService}'s helpers. We accept
     * the registration to keep API parity with the web impl, but the
     * senders are never invoked from this class.
     */
    public registerNipAcSenders(_senders: NipAcSenders): void {
        // intentional no-op; native path bypasses JS senders
    }

    public registerCallEventCreator(fn: CallEventCreator): void {
        this.createCallEventFn = fn;
    }

    public registerLocalCallEventCreator(fn: LocalCallEventCreator): void {
        this.localCreateCallEventFn = fn;
    }

    public generateCallId(): string {
        const bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);
        return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    }

    // -----------------------------------------------------------------
    //  VoiceCallBackend — user intents
    // -----------------------------------------------------------------

    public async initiateCall(
        recipientNpub: string,
        kind: CallKind = 'voice'
    ): Promise<void> {
        const state = get(voiceCallState);
        if (state.status !== 'idle') {
            console.warn('[VoiceCallNative] not idle, ignoring initiateCall');
            return;
        }
        let peerHex: string;
        try {
            peerHex = nip19.decode(recipientNpub).data as string;
        } catch (err) {
            console.error('[VoiceCallNative] invalid npub', err);
            return;
        }
        // Phase 4 of add-native-voice-calls: request RECORD_AUDIO via
        // the existing AndroidMicrophone plugin BEFORE the native
        // call manager starts AudioRecord. Without this, WebRTC's
        // AudioRecord captures silence (no exception) and the callee
        // hears nothing — a silent failure that's easy to miss.
        if (!(await this.ensureMicrophonePermission())) {
            console.warn('[VoiceCallNative] microphone permission denied');
            return;
        }
        // For video calls we additionally need CAMERA. We do NOT silently
        // downgrade to a voice call on denial — the caller's UI promised
        // video, so we abort cleanly instead.
        if (kind === 'video' && !(await this.ensureCameraPermission())) {
            console.warn('[VoiceCallNative] camera permission denied');
            return;
        }
        const callId = this.generateCallId();
        this.callKind = kind;
        // Optimistically update the Svelte store so the UI flips to
        // outgoing-ringing without waiting for the native callback round
        // trip. The native manager will emit its own callStateChanged
        // shortly after; the second call is idempotent.
        this.currentPeerNpub = recipientNpub;
        this.currentCallId = callId;
        setOutgoingRinging(recipientNpub, callId, kind);

        try {
            await AndroidVoiceCall.initiateCall({
                callId,
                peerHex,
                callKind: kind
            });
        } catch (err) {
            console.error('[VoiceCallNative] initiateCall failed', err);
            endCall('error');
        }
    }

    public async acceptCall(): Promise<void> {
        const state = get(voiceCallState);
        if (state.status !== 'incoming-ringing' && state.status !== 'idle') {
            console.warn('[VoiceCallNative] cannot accept; status=' + state.status);
            return;
        }
        if (!(await this.ensureMicrophonePermission())) {
            console.warn('[VoiceCallNative] microphone permission denied; declining');
            // Without mic access we'd have a one-way call. Treat as
            // decline so the caller hears a clean reject rather than
            // a connecting-then-silent surprise.
            try { await AndroidVoiceCall.declineCall(); } catch (_) { /* ignore */ }
            return;
        }
        // For video calls we additionally need CAMERA. We DO decline
        // (rather than silently downgrade) on denial because the caller
        // promised video and the user already chose to accept; a
        // connecting-then-no-camera surprise is worse than a reject.
        // Read kind from the store first (set by the live JS path on
        // platforms where Messaging dispatches NIP-AC into JS) and
        // fall back to the cached field. Phase 5 will plumb kind from
        // native callStateChanged events so this branch stops mattering
        // for Android.
        const acceptKind: CallKind =
            state.callKind || this.callKind || 'voice';
        if (acceptKind === 'video' && !(await this.ensureCameraPermission())) {
            console.warn(
                '[VoiceCallNative] camera permission denied; declining video call'
            );
            try { await AndroidVoiceCall.declineCall(); } catch (_) { /* ignore */ }
            return;
        }
        // The native side reads the offer from SharedPreferences on its
        // own; we just trigger the FGS action.
        try {
            await AndroidVoiceCall.acceptCall({
                callId: state.callId ?? this.currentCallId ?? undefined
            });
        } catch (err) {
            console.error('[VoiceCallNative] acceptCall failed', err);
            endCall('error');
        }
    }

    /**
     * Ensure the user has granted RECORD_AUDIO at runtime. Returns
     * {@code true} if granted (or already-granted), {@code false} if
     * denied. Best-effort: if the AndroidMicrophone plugin is missing
     * (shouldn't happen on Android) we optimistically return true so
     * the call doesn't fail purely because we couldn't ask.
     */
    private async ensureMicrophonePermission(): Promise<boolean> {
        if (!AndroidMicrophone) return true;
        try {
            const { granted } = await AndroidMicrophone.requestPermission();
            return granted;
        } catch (err) {
            console.warn(
                '[VoiceCallNative] microphone permission request errored; assuming granted',
                err
            );
            return true;
        }
    }

    /**
     * Ensure the user has granted CAMERA at runtime for a video call.
     * Returns {@code true} if granted (or already-granted), {@code false}
     * if denied. Best-effort: if the AndroidCamera plugin is missing
     * (shouldn't happen on Android) we optimistically return true so
     * the call doesn't fail purely because we couldn't ask.
     */
    private async ensureCameraPermission(): Promise<boolean> {
        if (!AndroidCamera) return true;
        try {
            const { granted } = await AndroidCamera.requestPermission();
            return granted;
        } catch (err) {
            console.warn(
                '[VoiceCallNative] camera permission request errored; assuming granted',
                err
            );
            return true;
        }
    }

    public declineCall(): void {
        const state = get(voiceCallState);
        if (state.status !== 'incoming-ringing') return;
        // Optimistic ended state for snappy UI.
        endCall('rejected');
        void AndroidVoiceCall.declineCall().catch((err) =>
            console.warn('[VoiceCallNative] declineCall failed', err)
        );
    }

    public hangup(): void {
        const state = get(voiceCallState);
        if (state.status === 'idle' || state.status === 'ended') return;
        // Optimistic UI; native will emit ended via callStateChanged.
        endCall('hangup');
        void AndroidVoiceCall.hangup().catch((err) =>
            console.warn('[VoiceCallNative] hangup failed', err)
        );
    }

    public toggleMute(): void {
        const state = get(voiceCallState);
        const next = !state.isMuted;
        // Optimistic store flip.
        storeToggleMute();
        void AndroidVoiceCall.toggleMute({ muted: next }).catch((err) =>
            console.warn('[VoiceCallNative] toggleMute failed', err)
        );
    }

    public toggleSpeaker(): void {
        const state = get(voiceCallState);
        const next = !state.isSpeakerOn;
        storeToggleSpeaker();
        void AndroidVoiceCall.toggleSpeaker({ on: next }).catch((err) =>
            console.warn('[VoiceCallNative] toggleSpeaker failed', err)
        );
    }

    public getRemoteStream(): MediaStream | null {
        // Remote audio is rendered by the native AudioDeviceModule, not
        // a JS MediaStream. The hidden <audio> in ActiveCallOverlay.svelte
        // receives null and is a no-op on Android (the overlay is
        // suppressed in Phase 2 anyway).
        return null;
    }

    // ------------------------------------------------------------------
    //  VoiceCallBackend — video stubs
    //
    //  Phase 1 wires the interface through the type system. Real video
    //  capture, rendering, and camera controls are added in Phase 5
    //  (native Android side) once the AndroidCamera plugin (Phase 4)
    //  and its host UI are in place.
    // ------------------------------------------------------------------

    public getCallKind(): CallKind {
        return this.callKind;
    }

    public getLocalStream(): MediaStream | null {
        // The native SurfaceViewRenderer subscribes directly to the
        // VideoTrack inside NativeVoiceCallManager — there is no JS
        // MediaStream to surface.
        return null;
    }

    public async toggleCamera(): Promise<void> {
        const state = get(voiceCallState);
        if (state.callKind !== 'video') return;
        const next = !state.isCameraOff;
        // Optimistic store flip; native fires cameraStateChanged shortly
        // after which is idempotent.
        setCameraOff(next);
        try {
            await AndroidVoiceCall.toggleCamera({ off: next });
        } catch (err) {
            console.warn('[VoiceCallNative] toggleCamera failed', err);
        }
    }

    public async flipCamera(): Promise<void> {
        const state = get(voiceCallState);
        if (state.callKind !== 'video') return;
        try {
            await AndroidVoiceCall.flipCamera();
        } catch (err) {
            console.warn('[VoiceCallNative] flipCamera failed', err);
        }
    }

    public isCameraOff(): boolean {
        return get(voiceCallState).isCameraOff;
    }

    // -----------------------------------------------------------------
    //  VoiceCallBackend — NIP-AC inbound (no-op on native)
    // -----------------------------------------------------------------

    /**
     * Inbound NIP-AC events on Android are dispatched directly from
     * {@code NativeBackgroundMessagingService} into the native call
     * manager. The JS-side dispatch in {@code Messaging.ts} skips
     * NIP-AC kinds on Android, so this method should never be called
     * in practice. Logged warning if it is.
     */
    public async handleNipAcEvent(_inner: NostrEvent): Promise<void> {
        console.warn(
            '[VoiceCallNative] handleNipAcEvent should not run on native; check Messaging.ts skip pattern'
        );
    }

    public async handleSelfAnswer(inner: NostrEvent): Promise<void> {
        const callId = this.getTagValue(inner, 'call-id');
        const state = get(voiceCallState);
        if (
            state.status !== 'incoming-ringing' ||
            !callId ||
            state.callId !== callId
        ) {
            return;
        }
        // Multi-device "answered elsewhere": dismiss the FSI on this
        // device and end the call locally. The native manager has no
        // session to tear down (this device hadn't accepted yet), so we
        // only need to cancel the ringer + flip the store.
        try {
            await AndroidVoiceCall.dismissIncomingCall({ callId });
        } catch (err) {
            console.warn('[VoiceCallNative] dismissIncomingCall failed', err);
        }
        setEndedAnsweredElsewhere();
    }

    public async handleSelfReject(inner: NostrEvent): Promise<void> {
        const callId = this.getTagValue(inner, 'call-id');
        const state = get(voiceCallState);
        if (
            state.status !== 'incoming-ringing' ||
            !callId ||
            state.callId !== callId
        ) {
            return;
        }
        try {
            await AndroidVoiceCall.dismissIncomingCall({ callId });
        } catch (err) {
            console.warn('[VoiceCallNative] dismissIncomingCall failed', err);
        }
        setEndedRejectedElsewhere();
    }

    private getTagValue(event: NostrEvent, name: string): string | undefined {
        for (const tag of event.tags) {
            if (Array.isArray(tag) && tag[0] === name && typeof tag[1] === 'string') {
                return tag[1];
            }
        }
        return undefined;
    }

    // -----------------------------------------------------------------
    //  Plugin event handlers
    // -----------------------------------------------------------------

    private onCallStateChanged(data: CallStateEvent): void {
        // Translate peerHex (carried implicitly via this.currentPeerNpub
        // if we initiated, or set at incoming-ringing time) into the
        // store. For incoming-ringing fired by the cold-start accept
        // path the manager may not know the peerNpub here; in practice
        // the native side only emits 'connecting' for cold-start
        // accepts (since incoming-ringing was the FSI screen, not a
        // store state), so peerNpub is null but the store update is
        // still safe.
        if (data.callId) this.currentCallId = data.callId;
        applyStatus(
            data.status,
            data.reason,
            this.currentCallId,
            this.currentPeerNpub
        );

        // Reset peer cache when call ends, and schedule a deferred
        // resetCall() so the next initiateCall() doesn't early-return
        // at the `state.status !== 'idle'` check. The legacy Svelte
        // ActiveCallOverlay used to schedule this same timer; that
        // overlay is gated off on Android, so the service does it
        // here. CALL_END_DISPLAY_MS gives any UI surface (the native
        // ActiveCallActivity) a brief window to show the ended
        // reason before the store flips back to idle.
        if (data.status === 'ended') {
            this.currentPeerNpub = null;
            this.currentCallId = null;
            this.callKind = 'voice';
            if (this.endResetTimer !== null) {
                clearTimeout(this.endResetTimer);
            }
            this.endResetTimer = setTimeout(() => {
                this.endResetTimer = null;
                resetCall();
            }, CALL_END_DISPLAY_MS);
        } else if (data.status !== 'idle') {
            // A new call started while a previous reset was pending —
            // cancel the timer to avoid clobbering the new state.
            if (this.endResetTimer !== null) {
                clearTimeout(this.endResetTimer);
                this.endResetTimer = null;
            }
        }
    }

    private onDurationTick(data: DurationTickEvent): void {
        // Native ticks once per second with the absolute duration.
        // The store's incrementDuration adds 1 — but the native side
        // is the source of truth, so set the duration field directly.
        // We use voiceCallState.update via incrementDuration only when
        // we missed exactly one tick; otherwise we sync absolute.
        const current = get(voiceCallState);
        if (data.seconds <= current.duration) return;
        if (data.seconds === current.duration + 1) {
            incrementDuration();
            return;
        }
        // Set absolute. Cheaper than catching up by repeated increments.
        voiceCallState.update((s) => ({ ...s, duration: data.seconds }));
    }

    private onCallError(data: CallErrorEvent): void {
        console.error('[VoiceCallNative] call error', data);
        // Don't double-end; the manager's finishCall already emits
        // callStateChanged with the appropriate reason.
    }

    private onMuteStateChanged(data: MuteStateEvent): void {
        const current = get(voiceCallState);
        if (current.isMuted !== data.muted) {
            voiceCallState.update((s) => ({ ...s, isMuted: data.muted }));
        }
    }

    private async onCallHistoryWriteRequested(
        data: CallHistoryWriteRequest
    ): Promise<void> {
        const fn = this.localCreateCallEventFn;
        if (!fn) {
            console.warn(
                '[VoiceCallNative] callHistoryWriteRequested with no creator registered'
            );
            return;
        }
        try {
            const recipientNpub = nip19.npubEncode(data.peerHex);
            const initiatorNpub = data.initiatorHex
                ? nip19.npubEncode(data.initiatorHex)
                : undefined;
            await fn(recipientNpub, data.type as AuthoredCallEventType, data.callId, initiatorNpub);
        } catch (err) {
            console.error(
                '[VoiceCallNative] callHistoryWriteRequested handler failed',
                err
            );
        }
    }

    private async onCallHistoryRumorRequested(
        data: CallHistoryRumorRequest
    ): Promise<void> {
        const fn = this.createCallEventFn;
        if (!fn) {
            console.warn(
                '[VoiceCallNative] callHistoryRumorRequested with no creator registered'
            );
            return;
        }
        try {
            const recipientNpub = nip19.npubEncode(data.peerHex);
            const initiatorNpub = data.initiatorHex
                ? nip19.npubEncode(data.initiatorHex)
                : undefined;
            await fn(
                recipientNpub,
                data.type as AuthoredCallEventType,
                data.durationSec,
                data.callId,
                initiatorNpub
            );
        } catch (err) {
            console.error(
                '[VoiceCallNative] callHistoryRumorRequested handler failed',
                err
            );
        }
    }
}
