import { writable } from 'svelte/store';
import type { VoiceCallState, VoiceCallEndReason } from '$lib/core/voiceCall/types';

const INITIAL_STATE: VoiceCallState = {
    status: 'idle',
    peerNpub: null,
    callId: null,
    duration: 0,
    isMuted: false,
    isSpeakerOn: false,
    endReason: null
};

export const voiceCallState = writable<VoiceCallState>({ ...INITIAL_STATE });

export function setOutgoingRinging(peerNpub: string, callId: string): void {
    voiceCallState.set({
        ...INITIAL_STATE,
        status: 'outgoing-ringing',
        peerNpub,
        callId
    });
}

export function setIncomingRinging(peerNpub: string, callId: string): void {
    voiceCallState.set({
        ...INITIAL_STATE,
        status: 'incoming-ringing',
        peerNpub,
        callId
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
