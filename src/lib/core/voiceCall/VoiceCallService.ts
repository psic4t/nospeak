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

/**
 * Persisted call-event types authored on terminal call transitions. Mirrors
 * the union in Messaging.createCallEventMessage and the renderer in
 * CallEventMessage.svelte. Legacy values 'outgoing'/'incoming' are NOT in
 * this set — new code SHALL NOT author them.
 */
export type AuthoredCallEventType =
    | 'missed'
    | 'ended'
    | 'no-answer'
    | 'declined'
    | 'busy'
    | 'failed'
    | 'cancelled';

/**
 * Authoring callback for call-event types that should appear in BOTH peers'
 * chat history (`ended`, `no-answer`, `declined`, `busy`, `failed`).
 * Implemented by Messaging.createCallEventMessage — gift-wraps the rumor to
 * the peer and self-wraps for the sender.
 *
 * `initiatorNpub` (optional, bech32) SHALL be the original WebRTC call
 * initiator. Defaults to the local user when omitted; callee-authored
 * types MUST pass the caller's npub explicitly so the persisted
 * `call-initiator` tag points to the actual initiator (not the rumor
 * author) and the renderer can pick role-aware copy.
 */
type CallEventCreator = (
    recipientNpub: string,
    type: AuthoredCallEventType,
    duration?: number,
    callId?: string,
    initiatorNpub?: string
) => Promise<void>;

/**
 * Authoring callback for call-event types that are LOCAL-ONLY — only the
 * authoring side ever has a row (`missed`, `cancelled`). Implemented by
 * Messaging.createLocalCallEventMessage — saves to the local DB without any
 * relay publish or gift-wrap. The peer will not receive this rumor.
 */
type LocalCallEventCreator = (
    recipientNpub: string,
    type: AuthoredCallEventType,
    callId?: string,
    initiatorNpub?: string
) => Promise<void>;

export class VoiceCallService {
    private peerConnection: RTCPeerConnection | null = null;
    private localStream: MediaStream | null = null;
    private remoteStream: MediaStream | null = null;
    private offerTimeoutId: ReturnType<typeof setTimeout> | null = null;
    private iceTimeoutId: ReturnType<typeof setTimeout> | null = null;
    private durationIntervalId: ReturnType<typeof setInterval> | null = null;
    private sendSignalFn: SignalSender | null = null;
    private createCallEventFn: CallEventCreator | null = null;
    private localCreateCallEventFn: LocalCallEventCreator | null = null;
    /**
     * Gates outgoing ice-candidate signaling. Armed in createPeerConnection,
     * cleared once the connection reaches connected/completed (further
     * candidates can't improve a live call — there's no ICE-restart path
     * here — so signing & publishing them as gift wraps is wasted work).
     * Reset to false in cleanup; re-armed by the next createPeerConnection.
     */
    private iceTrickleEnabled = false;
    /**
     * True iff the current call was started by us (initiateCall). Drives the
     * caller-only authoring of the 'failed' chat-history pill on ICE failure
     * — the spec assigns 'failed' to the caller and relies on NIP-59
     * self-wrap to deliver the rumor to the callee. Set in initiateCall(),
     * reset to false in cleanup().
     */
    private isInitiator = false;

    public registerSignalSender(fn: SignalSender): void {
        this.sendSignalFn = fn;
    }

    public registerCallEventCreator(fn: CallEventCreator): void {
        this.createCallEventFn = fn;
    }

    public registerLocalCallEventCreator(fn: LocalCallEventCreator): void {
        this.localCreateCallEventFn = fn;
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
        this.isInitiator = true;
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
                    // Capture peerNpub + callId synchronously before cleanup
                    // (cleanup() doesn't touch the store, but endCall does and
                    // future reducer changes shouldn't be able to drop the
                    // recipient out from under the author).
                    const peerNpub = current.peerNpub;
                    this.cleanup();
                    endCall('timeout');
                    if (peerNpub) {
                        void this.createCallEvent('no-answer', undefined, peerNpub, callId);
                    }
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

    public declineCall(): void {
        const state = get(voiceCallState);
        if (state.status !== 'incoming-ringing' || !state.peerNpub || !state.callId) return;

        const { peerNpub, callId } = state;

        // Dismiss the UI synchronously, then publish the reject signal in the
        // background. Awaiting the publish here would freeze the overlay while
        // the relay connection comes up (see Messaging.publishWithDeadline,
        // 5 s deadline) — bug visible on desktop PWA where relays may not be
        // pre-warmed. Android keeps relays warm via the foreground messaging
        // service so it didn't surface there. sendSignal already swallows and
        // logs publish failures, so fire-and-forget is safe.
        this.cleanup();
        endCall('rejected');

        void this.sendSignal(peerNpub, {
            type: CALL_SIGNAL_TYPE,
            action: 'reject',
            callId
        });
        // Author the single 'declined' rumor on the callee side. It is
        // gift-wrapped to the caller, so the caller's chat history will
        // also show the call as declined — with role-aware copy at render
        // time (the caller sees "Call declined", the callee sees
        // "Declined"). The caller's handleReject() must NOT author a
        // duplicate rumor.
        //
        // The `call-initiator` MUST be the caller (the original WebRTC
        // initiator), not the local user (rumor author). Pass `peerNpub`
        // explicitly: in the incoming-ringing state, peerNpub is the
        // caller. Without this, the renderer's iAmInitiator check would
        // be inverted and both peers would see the wrong copy.
        void this.createCallEvent('declined', undefined, peerNpub, callId, peerNpub);
    }

    public hangup(): void {
        const state = get(voiceCallState);
        if (!state.peerNpub || !state.callId) return;

        const { peerNpub, callId, status, duration } = state;
        // Capture isInitiator before cleanup() resets it. Used to set the
        // call-initiator tag correctly for 'ended' rumors authored by the
        // callee (where the local user is NOT the WebRTC initiator).
        const wasInitiator = this.isInitiator;

        // Dismiss the UI synchronously first; both the call-event authoring
        // and the hangup signal publish happen fire-and-forget so a slow
        // relay can't keep the call overlay on screen. See declineCall() for
        // the full rationale. createCallEvent and sendSignal both already
        // catch+log their own errors.
        this.cleanup();
        endCall('hangup');

        if (status === 'active') {
            // Either side hangs up an established call → 'ended' with
            // duration. Authored exactly once by the hangup initiator and
            // gift-wrapped to the peer; the peer's handleHangup() must NOT
            // author a duplicate. The `call-initiator` tag is the WebRTC
            // initiator: the local user if we initiated, otherwise the
            // peer.
            const initiatorNpub = wasInitiator ? undefined : peerNpub;
            void this.createCallEvent('ended', duration, peerNpub, callId, initiatorNpub);
        } else if (status === 'outgoing-ringing') {
            // Caller cancelled an outgoing call before the callee answered.
            // Author 'cancelled' on the caller's local DB ONLY — do NOT
            // gift-wrap to the callee. The callee's own handleHangup()
            // authors a separate local-only 'missed' rumor; both sides see
            // their own perspective without producing a duplicate pill.
            // call-initiator defaults to the local user, which is correct
            // here because only the caller can hang up while
            // outgoing-ringing.
            void this.createLocalCallEvent('cancelled', peerNpub, callId);
        }
        void this.sendSignal(peerNpub, {
            type: CALL_SIGNAL_TYPE,
            action: 'hangup',
            callId
        });
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
                this.handleIceFailure();
            }
        };

        this.iceTimeoutId = setTimeout(() => {
            const iceState = this.peerConnection?.iceConnectionState;
            if (iceState !== 'connected' && iceState !== 'completed') {
                this.handleIceFailure();
            }
        }, ICE_CONNECTION_TIMEOUT_MS);
    }

    /**
     * Common terminal handler for ICE-level failures. Authors a 'failed'
     * chat-history pill exactly once per call, and only on the caller side
     * (gated on `isInitiator`); the rumor reaches the callee via NIP-59
     * self-wrap. The callee just tears its side down silently — they will
     * also typically detect the failure themselves but don't author a
     * duplicate pill.
     *
     * Capturing peerNpub/callId/isInitiator before cleanup() because
     * cleanup() resets isInitiator. endCall() preserves peerNpub/callId
     * today but capturing locally is robust against future store changes.
     */
    private handleIceFailure(): void {
        const state = get(voiceCallState);
        const wasInitiator = this.isInitiator;
        const peerNpub = state.peerNpub;
        const callId = state.callId;
        this.cleanup();
        endCall('ice-failed');
        if (wasInitiator && peerNpub && callId) {
            void this.createCallEvent('failed', undefined, peerNpub, callId);
        }
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
        // 'ended' events are authored by the hangup initiator (see hangup())
        // and delivered to us via the normal gift-wrap path; we don't author
        // a duplicate here.
        //
        // For an unanswered incoming call (caller cancelled before pickup)
        // we author 'missed' as a LOCAL-ONLY rumor — only the callee sees
        // this row. The caller authors its own local-only 'cancelled'
        // rumor in hangup(). This way each side gets exactly one
        // perspective-appropriate pill without duplicates.
        const peerNpub = state.peerNpub;
        const callId = state.callId;
        const wasIncomingRinging = state.status === 'incoming-ringing';
        this.cleanup();
        endCall('hangup');
        if (wasIncomingRinging && peerNpub && callId) {
            // call-initiator is the caller, not the local user (callee /
            // rumor author). peerNpub is the caller during incoming-ringing.
            void this.createLocalCallEvent('missed', peerNpub, callId, peerNpub);
        }
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
        // The callee authored the single 'declined' rumor in declineCall()
        // and gift-wrapped it to us; we do NOT author a duplicate here.
        // Just transition state.
        this.cleanup();
        endCall('rejected');
    }

    private handleBusy(signal: VoiceCallSignal): void {
        const state = get(voiceCallState);
        if (state.callId !== signal.callId) return;
        const peerNpub = state.peerNpub;
        const callId = state.callId;
        this.cleanup();
        endCall('busy');
        // Caller-only authoring: the callee already had an active call and
        // just sent us back a 'busy' signal — for them this attempt was
        // never a real call.
        if (peerNpub && callId) {
            void this.createCallEvent('busy', undefined, peerNpub, callId);
        }
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

    private async createCallEvent(
        type: AuthoredCallEventType,
        duration?: number,
        peerNpubOverride?: string,
        callId?: string,
        initiatorNpub?: string
    ): Promise<void> {
        // Allow callers to pass peerNpub + callId explicitly so they can
        // mutate the store (e.g., endCall) before authoring without losing
        // the recipient. Today endCall() preserves peerNpub, but capturing
        // at the callsite is more robust against future store reducer
        // changes.
        //
        // `initiatorNpub` is the original WebRTC caller; when omitted the
        // implementation defaults to the local user. Callee-authored
        // types MUST pass the caller's npub explicitly.
        const peerNpub = peerNpubOverride ?? get(voiceCallState).peerNpub;
        if (!peerNpub || !this.createCallEventFn) return;
        try {
            await this.createCallEventFn(peerNpub, type, duration, callId, initiatorNpub);
        } catch (err) {
            console.error('[VoiceCall] Failed to create call event:', err);
        }
    }

    /**
     * Author a local-only call-event rumor — the rumor lands in the local
     * DB but is NOT gift-wrapped or published. Used for `missed` and
     * `cancelled` where each side's history reflects only what they
     * observed locally and a peer-delivered pill would either duplicate
     * the local one or contradict the local user's perspective.
     */
    private async createLocalCallEvent(
        type: AuthoredCallEventType,
        peerNpubOverride: string,
        callId: string,
        initiatorNpub?: string
    ): Promise<void> {
        if (!this.localCreateCallEventFn) return;
        try {
            await this.localCreateCallEventFn(peerNpubOverride, type, callId, initiatorNpub);
        } catch (err) {
            console.error('[VoiceCall] Failed to create local call event:', err);
        }
    }

    private cleanup(): void {
        this.clearTimeouts();
        this.iceTrickleEnabled = false;
        this.isInitiator = false;

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
