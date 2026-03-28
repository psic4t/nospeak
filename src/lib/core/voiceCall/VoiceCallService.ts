import { get } from 'svelte/store';
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

    public registerSignalSender(fn: SignalSender): void {
        this.sendSignalFn = fn;
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

        try {
            this.localStream = await navigator.mediaDevices.getUserMedia(AUDIO_CONSTRAINTS);
            this.createPeerConnection(recipientNpub, callId);

            this.localStream.getTracks().forEach(track => {
                this.peerConnection!.addTrack(track, this.localStream!);
            });

            const offer = await this.peerConnection!.createOffer();
            await this.peerConnection!.setLocalDescription(offer);

            await this.sendSignal(recipientNpub, {
                type: CALL_SIGNAL_TYPE,
                action: 'offer',
                callId,
                sdp: offer.sdp
            });

            this.offerTimeoutId = setTimeout(() => {
                const current = get(voiceCallState);
                if (current.status === 'outgoing-ringing' && current.callId === callId) {
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

        this.peerConnection.onicecandidate = async (event) => {
            if (event.candidate) {
                await this.sendSignal(peerNpub, {
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

    private handleHangup(signal: VoiceCallSignal): void {
        const state = get(voiceCallState);
        if (state.callId !== signal.callId) return;
        this.cleanup();
        endCall('hangup');
    }

    private handleReject(signal: VoiceCallSignal): void {
        const state = get(voiceCallState);
        if (state.callId !== signal.callId) return;
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

    private cleanup(): void {
        this.clearTimeouts();

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
    }
}

export const voiceCallService = new VoiceCallService();
