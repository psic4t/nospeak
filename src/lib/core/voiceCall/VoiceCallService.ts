import { get } from 'svelte/store';
import { Capacitor } from '@capacitor/core';
import {
    setOutgoingRinging,
    setIncomingRinging,
    setConnecting,
    setActive,
    endCall,
    toggleMute as storeMute,
    resetCall,
    voiceCallState,
    incrementDuration
} from '$lib/stores/voiceCall';
import { getIceServers } from '$lib/core/runtimeConfig/store';
import { AndroidVoiceCall } from '$lib/core/voiceCall/androidVoiceCallPlugin';
import { CALL_OFFER_TIMEOUT_MS, ICE_CONNECTION_TIMEOUT_MS, CALL_SIGNAL_TYPE, AUDIO_CONSTRAINTS } from './constants';
import type { VoiceCallSignal } from './types';

type SignalSender = (recipientNpub: string, signalContent: string) => Promise<void>;

export class VoiceCallService {
    private peerConnection: RTCPeerConnection | null = null;
    private localStream: MediaStream | null = null;
    private remoteStream: MediaStream | null = null;
    private offerTimeoutId: ReturnType<typeof setTimeout> | null = null;
    private iceTimeoutId: ReturnType<typeof setTimeout> | null = null;
    private durationIntervalId: ReturnType<typeof setInterval> | null = null;
    private sendSignalFn: SignalSender | null = null;
    private createCallEventFn: ((recipientNpub: string, type: string, duration?: number) => Promise<void>) | null = null;
    /**
     * Gates outgoing ice-candidate signaling. Armed in createPeerConnection,
     * cleared once the connection reaches connected/completed (further
     * candidates can't improve a live call — there's no ICE-restart path
     * here — so signing & publishing them as gift wraps is wasted work).
     * Reset to false in cleanup; re-armed by the next createPeerConnection.
     */
    private iceTrickleEnabled = false;

    public registerSignalSender(fn: SignalSender): void {
        this.sendSignalFn = fn;
    }

    public registerCallEventCreator(fn: (recipientNpub: string, type: string, duration?: number) => Promise<void>): void {
        this.createCallEventFn = fn;
    }

    public isVoiceCallSignal(content: string): boolean {
        return this.parseSignal(content) !== null;
    }

    public parseSignal(content: string): VoiceCallSignal | null {
        try {
            const parsed = JSON.parse(content);
            if (
                parsed &&
                parsed.type === CALL_SIGNAL_TYPE &&
                typeof parsed.action === 'string' &&
                typeof parsed.callId === 'string'
            ) {
                return parsed as VoiceCallSignal;
            }
            return null;
        } catch {
            return null;
        }
    }

    public generateCallId(): string {
        const bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);
        return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    }

    public async initiateCall(recipientNpub: string): Promise<void> {
        const state = get(voiceCallState);
        if (state.status !== 'idle') {
            console.warn('[VoiceCall] Cannot initiate call — already in a call');
            return;
        }

        const callId = this.generateCallId();
        setOutgoingRinging(recipientNpub, callId);
        await this.startAndroidSession(callId, recipientNpub, 'outgoing');

        try {
            console.log('[VoiceCall] Requesting microphone access...');
            this.localStream = await navigator.mediaDevices.getUserMedia(AUDIO_CONSTRAINTS);
            console.log('[VoiceCall] Microphone acquired, creating peer connection...');
            this.createPeerConnection(recipientNpub, callId);

            this.localStream.getTracks().forEach(track => {
                this.peerConnection!.addTrack(track, this.localStream!);
            });

            console.log('[VoiceCall] Creating SDP offer...');
            const offer = await this.peerConnection!.createOffer();
            await this.peerConnection!.setLocalDescription(offer);

            console.log('[VoiceCall] Sending offer signal...');
            await this.sendSignal(recipientNpub, {
                type: CALL_SIGNAL_TYPE,
                action: 'offer',
                callId,
                sdp: offer.sdp
            });
            console.log('[VoiceCall] Offer sent, waiting for answer...');

            this.offerTimeoutId = setTimeout(async () => {
                const current = get(voiceCallState);
                if (current.status === 'outgoing-ringing' && current.callId === callId) {
                    await this.createCallEvent('outgoing');
                    this.cleanup();
                    endCall('timeout');
                }
            }, CALL_OFFER_TIMEOUT_MS);
        } catch (err) {
            console.error('[VoiceCall] Failed to initiate call:', err);
            this.cleanup();
            endCall('error');
        }
    }

    public async handleSignal(signal: VoiceCallSignal, senderNpub: string): Promise<void> {
        console.log('[VoiceCall][Recv] handleSignal: action=' + signal.action
            + ' callId=' + signal.callId);
        switch (signal.action) {
            case 'offer':
                await this.handleOffer(signal, senderNpub);
                break;
            case 'answer':
                await this.handleAnswer(signal);
                break;
            case 'ice-candidate':
                await this.handleIceCandidate(signal);
                break;
            case 'hangup':
                this.handleHangup(signal);
                break;
            case 'reject':
                this.handleReject(signal);
                break;
            case 'busy':
                this.handleBusy(signal);
                break;
        }
    }

    public async acceptCall(): Promise<void> {
        const state = get(voiceCallState);
        if (state.status !== 'incoming-ringing' || !state.peerNpub || !state.callId) {
            console.warn('[VoiceCall] Cannot accept — not in incoming-ringing state');
            return;
        }

        try {
            setConnecting();
            await this.startAndroidSession(state.callId, state.peerNpub, 'incoming');
            this.localStream = await navigator.mediaDevices.getUserMedia(AUDIO_CONSTRAINTS);

            this.localStream.getTracks().forEach(track => {
                this.peerConnection!.addTrack(track, this.localStream!);
            });

            const answer = await this.peerConnection!.createAnswer();
            await this.peerConnection!.setLocalDescription(answer);

            await this.sendSignal(state.peerNpub, {
                type: CALL_SIGNAL_TYPE,
                action: 'answer',
                callId: state.callId,
                sdp: answer.sdp
            });
        } catch (err) {
            console.error('[VoiceCall] Failed to accept call:', err);
            this.cleanup();
            endCall('error');
        }
    }

    public async declineCall(): Promise<void> {
        const state = get(voiceCallState);
        if (state.status !== 'incoming-ringing' || !state.peerNpub || !state.callId) return;

        await this.sendSignal(state.peerNpub, {
            type: CALL_SIGNAL_TYPE,
            action: 'reject',
            callId: state.callId
        });
        this.cleanup();
        endCall('rejected');
    }

    public async hangup(): Promise<void> {
        const state = get(voiceCallState);
        if (!state.peerNpub || !state.callId) return;

        if (state.status === 'active') {
            await this.createCallEvent('ended', state.duration);
        }

        await this.sendSignal(state.peerNpub, {
            type: CALL_SIGNAL_TYPE,
            action: 'hangup',
            callId: state.callId
        });
        this.cleanup();
        endCall('hangup');
    }

    public toggleMute(): void {
        if (this.localStream) {
            this.localStream.getAudioTracks().forEach(track => {
                track.enabled = !track.enabled;
            });
        }
        storeMute();
    }

    public getRemoteStream(): MediaStream | null {
        return this.remoteStream;
    }

    private createPeerConnection(peerNpub: string, callId: string): void {
        const iceServers = getIceServers();
        this.peerConnection = new RTCPeerConnection({ iceServers });
        this.iceTrickleEnabled = true;

        this.peerConnection.onicecandidate = (event) => {
            // Suppress candidates emitted after the connection is up — they
            // can't help a live call, only inflate signaling traffic.
            if (!this.iceTrickleEnabled) return;
            if (event.candidate) {
                // Fire-and-forget: don't await so candidates publish concurrently
                this.sendSignal(peerNpub, {
                    type: CALL_SIGNAL_TYPE,
                    action: 'ice-candidate',
                    callId,
                    candidate: event.candidate.toJSON()
                });
            }
        };

        this.peerConnection.ontrack = (event) => {
            this.remoteStream = event.streams[0] ?? new MediaStream([event.track]);
        };

        this.peerConnection.oniceconnectionstatechange = () => {
            const iceState = this.peerConnection?.iceConnectionState;
            if (iceState === 'connected' || iceState === 'completed') {
                // Stop forwarding further locally-gathered candidates; the
                // connection is established and any late candidate (typically
                // relay/TURN) would be wasted signaling traffic.
                this.iceTrickleEnabled = false;
                this.clearTimeouts();
                setActive();
                this.startDurationTimer();
            } else if (iceState === 'failed' || iceState === 'disconnected') {
                this.cleanup();
                endCall('ice-failed');
            }
        };

        this.iceTimeoutId = setTimeout(() => {
            const iceState = this.peerConnection?.iceConnectionState;
            if (iceState !== 'connected' && iceState !== 'completed') {
                this.cleanup();
                endCall('ice-failed');
            }
        }, ICE_CONNECTION_TIMEOUT_MS);
    }

    private async handleOffer(signal: VoiceCallSignal, senderNpub: string): Promise<void> {
        const state = get(voiceCallState);

        // Dedup: same callId from same peer while we're already ringing for it.
        // This happens when the offer arrives both via the live JS subscription
        // and via the Android persisted-prefs cold-start path (or any other
        // double-delivery scenario). Short-circuit before any work, including
        // peer-connection allocation.
        if (
            state.status === 'incoming-ringing' &&
            state.callId === signal.callId &&
            state.peerNpub === senderNpub
        ) {
            return;
        }

        if (state.status !== 'idle') {
            await this.sendSignal(senderNpub, {
                type: CALL_SIGNAL_TYPE,
                action: 'busy',
                callId: signal.callId
            });
            return;
        }

        setIncomingRinging(senderNpub, signal.callId);
        this.createPeerConnection(senderNpub, signal.callId);

        const remoteDesc = new RTCSessionDescription({
            type: 'offer',
            sdp: signal.sdp!
        });
        await this.peerConnection!.setRemoteDescription(remoteDesc);
    }

    private async handleAnswer(signal: VoiceCallSignal): Promise<void> {
        const state = get(voiceCallState);
        if (state.callId !== signal.callId || !this.peerConnection) return;

        this.clearTimeouts();
        setConnecting();

        const remoteDesc = new RTCSessionDescription({
            type: 'answer',
            sdp: signal.sdp!
        });
        await this.peerConnection.setRemoteDescription(remoteDesc);
    }

    private async handleIceCandidate(signal: VoiceCallSignal): Promise<void> {
        const state = get(voiceCallState);
        if (state.callId !== signal.callId || !this.peerConnection) return;

        if (signal.candidate) {
            await this.peerConnection.addIceCandidate(new RTCIceCandidate(signal.candidate));
        }
    }

    private async handleHangup(signal: VoiceCallSignal): Promise<void> {
        const state = get(voiceCallState);
        if (state.callId !== signal.callId) return;
        // 'ended' events are authored by the hangup initiator (see hangup()),
        // and delivered to us via the normal gift-wrap path. Authoring one
        // here too would produce a duplicate pill with a slightly different
        // duration. Only author for 'missed' (caller cancelled before we
        // accepted), where no peer-side hangup() ran to author it.
        if (state.status === 'incoming-ringing') {
            await this.createCallEvent('missed');
        }
        this.cleanup();
        endCall('hangup');
    }

    private handleReject(signal: VoiceCallSignal): void {
        const state = get(voiceCallState);
        console.log('[VoiceCall][Recv] handleReject: signal.callId=' + signal.callId
            + ' state.callId=' + state.callId + ' state.status=' + state.status);
        if (state.callId !== signal.callId) {
            console.warn('[VoiceCall][Recv] handleReject: callId MISMATCH — IGNORED');
            return;
        }
        console.log('[VoiceCall][Recv] handleReject: matched, cleaning up and endCall("rejected")');
        this.cleanup();
        endCall('rejected');
    }

    private handleBusy(signal: VoiceCallSignal): void {
        const state = get(voiceCallState);
        if (state.callId !== signal.callId) return;
        this.cleanup();
        endCall('busy');
    }

    private async sendSignal(recipientNpub: string, signal: VoiceCallSignal): Promise<void> {
        if (!this.sendSignalFn) {
            console.error('[VoiceCall] Signal sender not registered');
            return;
        }
        try {
            await this.sendSignalFn(recipientNpub, JSON.stringify(signal));
        } catch (err) {
            console.error('[VoiceCall] Failed to send signal:', err);
        }
    }

    private startDurationTimer(): void {
        this.durationIntervalId = setInterval(() => {
            incrementDuration();
        }, 1000);
    }

    private clearTimeouts(): void {
        if (this.offerTimeoutId) {
            clearTimeout(this.offerTimeoutId);
            this.offerTimeoutId = null;
        }
        if (this.iceTimeoutId) {
            clearTimeout(this.iceTimeoutId);
            this.iceTimeoutId = null;
        }
    }

    private async createCallEvent(type: 'missed' | 'outgoing' | 'ended', duration?: number): Promise<void> {
        const state = get(voiceCallState);
        if (!state.peerNpub || !this.createCallEventFn) return;
        try {
            await this.createCallEventFn(state.peerNpub, type, duration);
        } catch (err) {
            console.error('[VoiceCall] Failed to create call event:', err);
        }
    }

    private cleanup(): void {
        this.clearTimeouts();
        this.iceTrickleEnabled = false;

        if (this.durationIntervalId) {
            clearInterval(this.durationIntervalId);
            this.durationIntervalId = null;
        }

        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }

        this.remoteStream = null;

        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }

        // End the Android foreground service / notification if one is active.
        // Fire-and-forget: cleanup is sync and we don't want to block on the
        // bridge round-trip.
        const stateAtCleanup = get(voiceCallState);
        if (stateAtCleanup.status !== 'idle' && stateAtCleanup.status !== 'ended') {
            void this.endAndroidSession();
        }
    }

    private async startAndroidSession(callId: string, peerNpub: string, role: 'incoming' | 'outgoing'): Promise<void> {
        if (Capacitor.getPlatform() !== 'android') return;
        try {
            await AndroidVoiceCall.startCallSession({
                callId,
                peerNpub,
                role
            });
        } catch (err) {
            console.warn('[VoiceCall] startCallSession failed', err);
        }
    }

    private async endAndroidSession(): Promise<void> {
        if (Capacitor.getPlatform() !== 'android') return;
        try {
            await AndroidVoiceCall.endCallSession();
        } catch (err) {
            console.warn('[VoiceCall] endCallSession failed', err);
        }
    }
}

export const voiceCallService = new VoiceCallService();
