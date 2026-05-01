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
    resetCall,
    setCallKind,
    setCameraOff,
    setCameraFlipping,
    setFacingMode,
    setSpeakerOn
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
        expect(state.callKind).toBe('voice');
        expect(state.isCameraOff).toBe(false);
        expect(state.isCameraFlipping).toBe(false);
        expect(state.facingMode).toBe('user');
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

    describe('callKind', () => {
        it('defaults to voice when setOutgoingRinging is called without a kind', () => {
            setOutgoingRinging('npub1abc', 'call-1');
            expect(get(voiceCallState).callKind).toBe('voice');
        });

        it('captures the kind from setOutgoingRinging', () => {
            setOutgoingRinging('npub1abc', 'call-1', 'video');
            expect(get(voiceCallState).callKind).toBe('video');
        });

        it('captures the kind from setIncomingRinging', () => {
            setIncomingRinging('npub1abc', 'call-1', 'video');
            expect(get(voiceCallState).callKind).toBe('video');
        });

        it('defaults to voice when setIncomingRinging is called without a kind', () => {
            setIncomingRinging('npub1abc', 'call-1');
            expect(get(voiceCallState).callKind).toBe('voice');
        });

        it('setCallKind updates kind in place without touching other fields', () => {
            setOutgoingRinging('npub1abc', 'call-1');
            setConnecting();
            setCallKind('video');
            const state = get(voiceCallState);
            expect(state.callKind).toBe('video');
            expect(state.status).toBe('connecting');
            expect(state.peerNpub).toBe('npub1abc');
        });

        it('resetCall clears callKind back to voice', () => {
            setOutgoingRinging('npub1abc', 'call-1', 'video');
            resetCall();
            expect(get(voiceCallState).callKind).toBe('voice');
        });
    });

    describe('camera state mutators', () => {
        it('setCameraOff toggles isCameraOff', () => {
            setCameraOff(true);
            expect(get(voiceCallState).isCameraOff).toBe(true);
            setCameraOff(false);
            expect(get(voiceCallState).isCameraOff).toBe(false);
        });

        it('setCameraFlipping toggles isCameraFlipping', () => {
            setCameraFlipping(true);
            expect(get(voiceCallState).isCameraFlipping).toBe(true);
            setCameraFlipping(false);
            expect(get(voiceCallState).isCameraFlipping).toBe(false);
        });

        it('setFacingMode updates facingMode', () => {
            setFacingMode('environment');
            expect(get(voiceCallState).facingMode).toBe('environment');
            setFacingMode('user');
            expect(get(voiceCallState).facingMode).toBe('user');
        });

        it('resetCall clears all camera state', () => {
            setOutgoingRinging('npub1abc', 'call-1', 'video');
            setCameraOff(true);
            setCameraFlipping(true);
            setFacingMode('environment');
            resetCall();
            const state = get(voiceCallState);
            expect(state.isCameraOff).toBe(false);
            expect(state.isCameraFlipping).toBe(false);
            expect(state.facingMode).toBe('user');
        });
    });

    describe('setSpeakerOn', () => {
        it('forces speaker on or off without toggling', () => {
            setSpeakerOn(true);
            expect(get(voiceCallState).isSpeakerOn).toBe(true);
            // Calling again with the same value is idempotent
            setSpeakerOn(true);
            expect(get(voiceCallState).isSpeakerOn).toBe(true);
            setSpeakerOn(false);
            expect(get(voiceCallState).isSpeakerOn).toBe(false);
        });
    });
});
