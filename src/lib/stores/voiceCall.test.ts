import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import {
    voiceCallState,
    setOutgoingRinging,
    setIncomingRinging,
    setConnecting,
    setActive,
    endCall,
    toggleMute,
    toggleSpeaker,
    incrementDuration,
    resetCall
} from './voiceCall';

describe('voiceCall store', () => {
    beforeEach(() => {
        resetCall();
    });

    it('should start in idle state', () => {
        const state = get(voiceCallState);
        expect(state.status).toBe('idle');
        expect(state.peerNpub).toBeNull();
        expect(state.callId).toBeNull();
        expect(state.duration).toBe(0);
        expect(state.isMuted).toBe(false);
        expect(state.isSpeakerOn).toBe(false);
        expect(state.endReason).toBeNull();
    });

    it('should transition to outgoing-ringing', () => {
        setOutgoingRinging('npub1abc', 'call-123');
        const state = get(voiceCallState);
        expect(state.status).toBe('outgoing-ringing');
        expect(state.peerNpub).toBe('npub1abc');
        expect(state.callId).toBe('call-123');
    });

    it('should transition to incoming-ringing', () => {
        setIncomingRinging('npub1def', 'call-456');
        const state = get(voiceCallState);
        expect(state.status).toBe('incoming-ringing');
        expect(state.peerNpub).toBe('npub1def');
        expect(state.callId).toBe('call-456');
    });

    it('should transition to connecting', () => {
        setOutgoingRinging('npub1abc', 'call-123');
        setConnecting();
        expect(get(voiceCallState).status).toBe('connecting');
    });

    it('should transition to active', () => {
        setOutgoingRinging('npub1abc', 'call-123');
        setConnecting();
        setActive();
        expect(get(voiceCallState).status).toBe('active');
    });

    it('should end call with reason', () => {
        setOutgoingRinging('npub1abc', 'call-123');
        endCall('rejected');
        const state = get(voiceCallState);
        expect(state.status).toBe('ended');
        expect(state.endReason).toBe('rejected');
    });

    it('should toggle mute', () => {
        setActive();
        toggleMute();
        expect(get(voiceCallState).isMuted).toBe(true);
        toggleMute();
        expect(get(voiceCallState).isMuted).toBe(false);
    });

    it('should toggle speaker', () => {
        setActive();
        toggleSpeaker();
        expect(get(voiceCallState).isSpeakerOn).toBe(true);
        toggleSpeaker();
        expect(get(voiceCallState).isSpeakerOn).toBe(false);
    });

    it('should increment duration', () => {
        setActive();
        incrementDuration();
        incrementDuration();
        incrementDuration();
        expect(get(voiceCallState).duration).toBe(3);
    });

    it('should reset to idle', () => {
        setOutgoingRinging('npub1abc', 'call-123');
        setConnecting();
        setActive();
        toggleMute();
        incrementDuration();
        resetCall();
        const state = get(voiceCallState);
        expect(state.status).toBe('idle');
        expect(state.peerNpub).toBeNull();
        expect(state.callId).toBeNull();
        expect(state.duration).toBe(0);
        expect(state.isMuted).toBe(false);
        expect(state.endReason).toBeNull();
    });
});
