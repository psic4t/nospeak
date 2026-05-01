import { writable } from 'svelte/store';
import type { VoiceCallState, VoiceCallEndReason, CallKind } from '$lib/core/voiceCall/types';

const INITIAL_STATE: VoiceCallState = {
    status: 'idle',
    peerNpub: null,
    callId: null,
    duration: 0,
    isMuted: false,
    isSpeakerOn: false,
    endReason: null,
    callKind: 'voice',
    isCameraOff: false,
    isCameraFlipping: false,
    facingMode: 'user'
};

export const voiceCallState = writable<VoiceCallState>({ ...INITIAL_STATE });

export function setOutgoingRinging(
    peerNpub: string,
    callId: string,
    kind: CallKind = 'voice'
): void {
    voiceCallState.set({
        ...INITIAL_STATE,
        status: 'outgoing-ringing',
        peerNpub,
        callId,
        callKind: kind
    });
}

export function setIncomingRinging(
    peerNpub: string,
    callId: string,
    kind: CallKind = 'voice'
): void {
    voiceCallState.set({
        ...INITIAL_STATE,
        status: 'incoming-ringing',
        peerNpub,
        callId,
        callKind: kind
    });
}

export function setConnecting(): void {
    voiceCallState.update(s => ({ ...s, status: 'connecting' }));
}

export function setActive(): void {
    voiceCallState.update(s => ({ ...s, status: 'active' }));
}

export function endCall(reason: VoiceCallEndReason): void {
    voiceCallState.update(s => ({ ...s, status: 'ended', endReason: reason }));
}

/**
 * NIP-AC multi-device: another device of the same user accepted the
 * incoming call. Transitions to `ended` with reason `answered-elsewhere`
 * while preserving peerNpub and callId for the brief Ended display.
 */
export function setEndedAnsweredElsewhere(): void {
    voiceCallState.update(s => ({
        ...s,
        status: 'ended',
        endReason: 'answered-elsewhere'
    }));
}

/**
 * NIP-AC multi-device: another device of the same user rejected the
 * incoming call.
 */
export function setEndedRejectedElsewhere(): void {
    voiceCallState.update(s => ({
        ...s,
        status: 'ended',
        endReason: 'rejected-elsewhere'
    }));
}

export function toggleMute(): void {
    voiceCallState.update(s => ({ ...s, isMuted: !s.isMuted }));
}

export function toggleSpeaker(): void {
    voiceCallState.update(s => ({ ...s, isSpeakerOn: !s.isSpeakerOn }));
}

export function incrementDuration(): void {
    voiceCallState.update(s => ({ ...s, duration: s.duration + 1 }));
}

export function resetCall(): void {
    voiceCallState.set({ ...INITIAL_STATE });
}

/**
 * Set the call kind explicitly. Used by backends when the kind is
 * determined after the initial state transition (e.g. when reading
 * `call-type` off an inbound offer).
 */
export function setCallKind(kind: CallKind): void {
    voiceCallState.update(s => ({ ...s, callKind: kind }));
}

/**
 * Set whether the local camera is off (track.enabled = false). Mutator
 * called by the backend after the underlying flip resolves.
 */
export function setCameraOff(off: boolean): void {
    voiceCallState.update(s => ({ ...s, isCameraOff: off }));
}

/**
 * Mark a camera flip as in-flight or completed. UI can use this to
 * disable the flip control while a swap is pending.
 */
export function setCameraFlipping(flag: boolean): void {
    voiceCallState.update(s => ({ ...s, isCameraFlipping: flag }));
}

/**
 * Set the active camera facing mode. Drives self-view mirroring in the
 * UI: front-facing cameras are mirrored, back-facing cameras are not.
 */
export function setFacingMode(mode: 'user' | 'environment'): void {
    voiceCallState.update(s => ({ ...s, facingMode: mode }));
}

/**
 * Force the speaker flag without invoking the backend toggle. Used to
 * default speakerphone ON when a video call transitions to active.
 */
export function setSpeakerOn(on: boolean): void {
    voiceCallState.update(s => ({ ...s, isSpeakerOn: on }));
}
