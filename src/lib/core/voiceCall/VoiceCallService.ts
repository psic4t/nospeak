import { get } from 'svelte/store';
import { nip19, type NostrEvent } from 'nostr-tools';
import {
    setOutgoingRinging,
    setIncomingRinging,
    setConnecting,
    setActive,
    endCall,
    toggleMute as storeMute,
    voiceCallState,
    incrementDuration,
    setEndedAnsweredElsewhere,
    setEndedRejectedElsewhere
} from '$lib/stores/voiceCall';
import { getIceServers } from '$lib/core/runtimeConfig/store';
import {
    CALL_OFFER_TIMEOUT_MS,
    ICE_CONNECTION_TIMEOUT_MS,
    AUDIO_CONSTRAINTS,
    NIP_AC_KIND_OFFER,
    NIP_AC_KIND_ANSWER,
    NIP_AC_KIND_ICE,
    NIP_AC_KIND_HANGUP,
    NIP_AC_KIND_REJECT
} from './constants';

// Backend-facing public types (NipAcSenders, CallEventCreator,
// LocalCallEventCreator, AuthoredCallEventType, VoiceCallBackend) live
// in `./types.ts` so VoiceCallServiceNative can implement the same
// interface without circular imports back into this file. Re-exported
// here for backwards compatibility with existing importers.
import type {
    AuthoredCallEventType,
    CallEventCreator,
    LocalCallEventCreator,
    NipAcSenders,
    VoiceCallBackend
} from './types';
export type {
    AuthoredCallEventType,
    CallEventCreator,
    LocalCallEventCreator,
    NipAcSenders,
    VoiceCallBackend
};

/**
 * JavaScript / web implementation of {@link VoiceCallBackend}. Owns an
 * {@code RTCPeerConnection} in the JavaScript runtime and routes NIP-AC
 * signaling through {@code Messaging.ts}'s registered senders. Used on
 * the web/PWA build, and on Android until the native voice-calling
 * stack ships in Phase 1+ of {@code add-native-voice-calls}.
 *
 * Exported under the legacy name {@code VoiceCallService} so existing
 * importers keep working; an alias {@link VoiceCallServiceWeb} is also
 * exported below to make the platform-specificity explicit at new call
 * sites.
 */
export class VoiceCallService implements VoiceCallBackend {
    private peerConnection: RTCPeerConnection | null = null;
    private localStream: MediaStream | null = null;
    private remoteStream: MediaStream | null = null;
    private offerTimeoutId: ReturnType<typeof setTimeout> | null = null;
    private iceTimeoutId: ReturnType<typeof setTimeout> | null = null;
    private durationIntervalId: ReturnType<typeof setInterval> | null = null;
    private senders: NipAcSenders | null = null;
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

    /**
     * NIP-AC ICE candidate buffering — global layer.
     *
     * Holds candidates received before any RTCPeerConnection exists for
     * the sending peer. Keyed by sender hex pubkey. Drained into
     * sessionPendingIce when createPeerConnection is invoked for that
     * peer. Survives across acceptCall() so candidates that arrive while
     * ringing are not lost.
     */
    private globalIceBuffer: Map<string, RTCIceCandidateInit[]> = new Map();

    /**
     * NIP-AC ICE candidate buffering — per-session layer.
     *
     * Holds candidates that arrived after the RTCPeerConnection was
     * created but before setRemoteDescription() resolved. Flushed to
     * peerConnection.addIceCandidate() in arrival order after
     * setRemoteDescription resolves.
     */
    private sessionPendingIce: RTCIceCandidateInit[] = [];

    /** True after setRemoteDescription resolves on the active session. */
    private sessionRemoteDescriptionSet = false;

    public registerNipAcSenders(senders: NipAcSenders): void {
        this.senders = senders;
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

        try {
            console.log('[VoiceCall] Requesting microphone access...');
            this.localStream = await navigator.mediaDevices.getUserMedia(AUDIO_CONSTRAINTS);
            console.log('[VoiceCall] Microphone acquired, creating peer connection...');
            const recipientHex = nip19.decode(recipientNpub).data as string;
            this.createPeerConnection(recipientNpub, recipientHex, callId);

            this.localStream.getTracks().forEach(track => {
                this.peerConnection!.addTrack(track, this.localStream!);
            });

            console.log('[VoiceCall] Creating SDP offer...');
            const offer = await this.peerConnection!.createOffer();
            await this.peerConnection!.setLocalDescription(offer);

            console.log('[VoiceCall] Sending offer signal...');
            if (this.senders && offer.sdp) {
                await this.tryCall(() =>
                    this.senders!.sendOffer(recipientNpub, callId, offer.sdp!)
                );
            }
            console.log('[VoiceCall] Offer sent, waiting for answer...');

            this.offerTimeoutId = setTimeout(async () => {
                const current = get(voiceCallState);
                if (current.status === 'outgoing-ringing' && current.callId === callId) {
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

    /**
     * Dispatch a verified NIP-AC inner event from Messaging's receive path.
     * Self-events and follow-gating have already been applied; this method
     * only sees events from the remote peer that have passed all upstream
     * checks.
     */
    public async handleNipAcEvent(inner: NostrEvent): Promise<void> {
        const callId = this.getTagValue(inner, 'call-id');
        if (!callId) {
            console.warn('[VoiceCall][Recv] inner event missing call-id', { kind: inner.kind });
            return;
        }
        const senderNpub = nip19.npubEncode(inner.pubkey);

        switch (inner.kind) {
            case NIP_AC_KIND_OFFER:
                await this.handleOffer(inner, senderNpub, callId);
                break;
            case NIP_AC_KIND_ANSWER:
                await this.handleAnswer(inner, callId);
                break;
            case NIP_AC_KIND_ICE:
                await this.handleIceCandidate(inner, callId);
                break;
            case NIP_AC_KIND_HANGUP:
                await this.handleHangup(callId);
                break;
            case NIP_AC_KIND_REJECT:
                this.handleReject(inner, callId);
                break;
            default:
                console.warn('[VoiceCall][Recv] unsupported kind', inner.kind);
        }
    }

    /**
     * NIP-AC self-event handler invoked when a self-addressed kind-25051
     * Call Answer arrives in `incoming-ringing` state. Transitions to
     * `ended` with reason `answered-elsewhere` if the call-id matches.
     */
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
        this.cleanup();
        setEndedAnsweredElsewhere();
    }

    /**
     * NIP-AC self-event handler invoked when a self-addressed kind-25054
     * Call Reject arrives in `incoming-ringing` state.
     */
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
        this.cleanup();
        setEndedRejectedElsewhere();
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

            if (this.senders && answer.sdp) {
                await this.tryCall(() =>
                    this.senders!.sendAnswer(state.peerNpub!, state.callId!, answer.sdp!)
                );
            }
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
        // the relay connection comes up. sendReject already handles its own
        // failures via the registered helper.
        this.cleanup();
        endCall('rejected');

        if (this.senders) {
            void this.tryCall(() => this.senders!.sendReject(peerNpub, callId));
        }
        // Author the single 'declined' rumor on the callee side. It is
        // gift-wrapped to the caller, so the caller's chat history will
        // also show the call as declined — with role-aware copy at render
        // time. The caller's handleReject() must NOT author a duplicate
        // rumor.
        //
        // The `call-initiator` MUST be the caller (the original WebRTC
        // initiator), not the local user (rumor author). In
        // incoming-ringing, peerNpub IS the caller.
        void this.createCallEvent('declined', undefined, peerNpub, callId, peerNpub);
    }

    public hangup(): void {
        const state = get(voiceCallState);
        if (!state.peerNpub || !state.callId) return;

        const { peerNpub, callId, status, duration } = state;
        const wasInitiator = this.isInitiator;

        this.cleanup();
        endCall('hangup');

        if (status === 'active') {
            const initiatorNpub = wasInitiator ? undefined : peerNpub;
            void this.createCallEvent('ended', duration, peerNpub, callId, initiatorNpub);
        } else if (status === 'outgoing-ringing') {
            void this.createLocalCallEvent('cancelled', peerNpub, callId);
        }
        if (this.senders) {
            void this.tryCall(() => this.senders!.sendHangup(peerNpub, callId));
        }
    }

    public toggleMute(): void {
        if (this.localStream) {
            this.localStream.getAudioTracks().forEach(track => {
                track.enabled = !track.enabled;
            });
        }
        storeMute();
    }

    /**
     * Speaker toggle. Web implementation is a no-op — browsers do not
     * expose a speakerphone routing primitive (the platform decides the
     * output device). Kept so the {@link VoiceCallBackend} interface
     * has a uniform method on both implementations; the active-call
     * UI's speaker button is therefore a placeholder on web today
     * (matching pre-migration behavior).
     */
    public toggleSpeaker(): void {
        // intentional no-op on web
    }

    public getRemoteStream(): MediaStream | null {
        return this.remoteStream;
    }

    private createPeerConnection(peerNpub: string, peerHex: string, callId: string): void {
        const iceServers = getIceServers();
        this.peerConnection = new RTCPeerConnection({ iceServers });
        this.iceTrickleEnabled = true;
        this.sessionRemoteDescriptionSet = false;
        this.sessionPendingIce = [];

        // NIP-AC: drain the global buffer for this peer into the session
        // buffer. Candidates accumulated while ringing must not be lost
        // when the user accepts. Per-session flush happens after
        // setRemoteDescription resolves.
        const buffered = this.globalIceBuffer.get(peerHex);
        if (buffered && buffered.length > 0) {
            this.sessionPendingIce.push(...buffered);
            this.globalIceBuffer.delete(peerHex);
        }

        this.peerConnection.onicecandidate = (event) => {
            // Suppress candidates emitted after the connection is up — they
            // can't help a live call, only inflate signaling traffic.
            if (!this.iceTrickleEnabled) return;
            if (event.candidate && this.senders) {
                // Fire-and-forget: don't await so candidates publish concurrently.
                // sendIceCandidate awaits its own internal publish; tryCall
                // swallows + logs failures so they don't bubble.
                const c = event.candidate;
                void this.tryCall(() =>
                    this.senders!.sendIceCandidate(
                        peerNpub,
                        callId,
                        c.candidate,
                        c.sdpMid,
                        c.sdpMLineIndex
                    )
                );
            }
        };

        this.peerConnection.ontrack = (event) => {
            this.remoteStream = event.streams[0] ?? new MediaStream([event.track]);
        };

        this.peerConnection.oniceconnectionstatechange = () => {
            const iceState = this.peerConnection?.iceConnectionState;
            if (iceState === 'connected' || iceState === 'completed') {
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
     * self-wrap. The callee just tears its side down silently.
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

    private async handleOffer(
        inner: NostrEvent,
        senderNpub: string,
        callId: string
    ): Promise<void> {
        const state = get(voiceCallState);

        // Dedup: same callId from same peer while we're already ringing for it.
        // This happens when the offer arrives both via the live JS subscription
        // and via the Android persisted-prefs cold-start path. Short-circuit
        // before any work, including peer-connection allocation.
        if (
            state.status === 'incoming-ringing' &&
            state.callId === callId &&
            state.peerNpub === senderNpub
        ) {
            return;
        }

        if (state.status !== 'idle') {
            // NIP-AC: busy is a Call Reject (kind 25054) with content "busy".
            if (this.senders) {
                await this.tryCall(() =>
                    this.senders!.sendReject(senderNpub, callId, 'busy')
                );
            }
            return;
        }

        setIncomingRinging(senderNpub, callId);
        this.createPeerConnection(senderNpub, inner.pubkey, callId);

        const remoteDesc = new RTCSessionDescription({
            type: 'offer',
            sdp: inner.content
        });
        await this.peerConnection!.setRemoteDescription(remoteDesc);
        await this.flushPerSessionIce();
    }

    private async handleAnswer(inner: NostrEvent, callId: string): Promise<void> {
        const state = get(voiceCallState);
        if (state.callId !== callId || !this.peerConnection) return;

        this.clearTimeouts();
        setConnecting();

        const remoteDesc = new RTCSessionDescription({
            type: 'answer',
            sdp: inner.content
        });
        await this.peerConnection.setRemoteDescription(remoteDesc);
        await this.flushPerSessionIce();
    }

    /**
     * Apply an incoming kind-25052 ICE Candidate per NIP-AC's two-layer
     * buffering rule:
     *   - No PeerConnection for this sender → push to global buffer
     *   - PeerConnection exists, but setRemoteDescription not resolved → push to per-session buffer
     *   - Otherwise → addIceCandidate directly
     *
     * The session call-id check is intentionally NOT applied for the
     * global-buffer path: ICE may arrive before the local state has
     * accepted the call (and thus before the local callId matches).
     * Once a session for that peer exists, the global buffer is drained
     * irrespective of call-id; a stale candidate is harmless because
     * ICE candidates with no matching transport are simply ignored by
     * the peer connection.
     */
    private async handleIceCandidate(inner: NostrEvent, callId: string): Promise<void> {
        let payload: { candidate: string; sdpMid: string | null; sdpMLineIndex: number | null };
        try {
            payload = JSON.parse(inner.content);
        } catch (err) {
            console.warn('[VoiceCall] handleIceCandidate: malformed JSON content', err);
            return;
        }
        const init: RTCIceCandidateInit = {
            candidate: payload.candidate,
            sdpMid: payload.sdpMid ?? undefined,
            sdpMLineIndex: payload.sdpMLineIndex ?? undefined
        };

        if (!this.peerConnection) {
            // No session yet — buffer globally keyed by sender pubkey.
            const senderHex = inner.pubkey;
            const list = this.globalIceBuffer.get(senderHex) ?? [];
            list.push(init);
            this.globalIceBuffer.set(senderHex, list);
            return;
        }

        // PeerConnection exists. Verify call-id matches the live session
        // before applying — a candidate from a stale call-id should not
        // reach the active connection.
        const state = get(voiceCallState);
        if (state.callId !== callId) return;

        if (!this.sessionRemoteDescriptionSet) {
            this.sessionPendingIce.push(init);
            return;
        }

        try {
            await this.peerConnection.addIceCandidate(new RTCIceCandidate(init));
        } catch (err) {
            console.warn('[VoiceCall] addIceCandidate failed', err);
        }
    }

    /**
     * Flush all per-session buffered candidates to addIceCandidate.
     * Called after setRemoteDescription resolves on offer or answer.
     * Marks the session as ready to apply candidates directly.
     */
    private async flushPerSessionIce(): Promise<void> {
        if (!this.peerConnection) return;
        this.sessionRemoteDescriptionSet = true;
        const pending = this.sessionPendingIce;
        this.sessionPendingIce = [];
        for (const init of pending) {
            try {
                await this.peerConnection.addIceCandidate(new RTCIceCandidate(init));
            } catch (err) {
                console.warn('[VoiceCall] flushPerSessionIce: addIceCandidate failed', err);
            }
        }
    }

    private async handleHangup(callId: string): Promise<void> {
        const state = get(voiceCallState);
        if (state.callId !== callId) return;
        const peerNpub = state.peerNpub;
        const wasIncomingRinging = state.status === 'incoming-ringing';
        this.cleanup();
        endCall('hangup');
        if (wasIncomingRinging && peerNpub && callId) {
            // call-initiator is the caller (peerNpub during incoming-ringing).
            void this.createLocalCallEvent('missed', peerNpub, callId, peerNpub);
        }
    }

    private handleReject(inner: NostrEvent, callId: string): void {
        const state = get(voiceCallState);
        if (state.callId !== callId) {
            console.warn('[VoiceCall][Recv] handleReject: callId MISMATCH — IGNORED');
            return;
        }
        const reason = inner.content;
        const peerNpub = state.peerNpub;
        this.cleanup();
        if (reason === 'busy') {
            endCall('busy');
            // Caller-only authoring: the callee already had an active call.
            if (peerNpub) {
                void this.createCallEvent('busy', undefined, peerNpub, callId);
            }
        } else {
            // The callee authored the single 'declined' rumor in declineCall()
            // and gift-wrapped it to us; we do NOT author a duplicate here.
            endCall('rejected');
        }
    }

    private async tryCall(fn: () => Promise<void>): Promise<void> {
        try {
            await fn();
        } catch (err) {
            console.error('[VoiceCall] send helper failed:', err);
        }
    }

    private getTagValue(event: NostrEvent, tagName: string): string | null {
        const tag = event.tags.find((t) => Array.isArray(t) && t[0] === tagName);
        return tag && typeof tag[1] === 'string' ? tag[1] : null;
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
        const peerNpub = peerNpubOverride ?? get(voiceCallState).peerNpub;
        if (!peerNpub || !this.createCallEventFn) return;
        try {
            await this.createCallEventFn(peerNpub, type, duration, callId, initiatorNpub);
        } catch (err) {
            console.error('[VoiceCall] Failed to create call event:', err);
        }
    }

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
        this.sessionRemoteDescriptionSet = false;
        this.sessionPendingIce = [];
        this.globalIceBuffer.clear();

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

/**
 * Explicit alias for the JS / web implementation of the
 * {@link VoiceCallBackend} interface. New call sites SHOULD prefer
 * importing this name to make the platform-specificity clear; the
 * legacy {@link VoiceCallService} export is kept for backwards
 * compatibility with existing importers and is identical to this
 * type.
 */
export { VoiceCallService as VoiceCallServiceWeb };

/**
 * Singleton {@link VoiceCallBackend} used throughout the app. The
 * factory in {@code ./factory.ts} returns
 * {@code VoiceCallServiceNative} on Android (which proxies to the
 * native peer connection) and {@link VoiceCallService} on web/PWA.
 *
 * Importers SHALL NOT depend on the concrete class — only on the
 * {@link VoiceCallBackend} interface — so the platform swap stays
 * transparent to consumers.
 */
import { createVoiceCallBackend } from './factory';
export const voiceCallService: VoiceCallBackend = createVoiceCallBackend();
