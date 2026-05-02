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
    setEndedRejectedElsewhere,
    setCallKind,
    setCameraOff,
    setCameraFlipping,
    setFacingMode,
    setSpeakerOn,
    setRenegotiationState
} from '$lib/stores/voiceCall';
import { getIceServers } from '$lib/core/runtimeConfig/store';
import {
    CALL_OFFER_TIMEOUT_MS,
    ICE_CONNECTION_TIMEOUT_MS,
    RENEGOTIATION_TIMEOUT_MS,
    AUDIO_CONSTRAINTS,
    VIDEO_MEDIA_CONSTRAINTS,
    NIP_AC_KIND_OFFER,
    NIP_AC_KIND_ANSWER,
    NIP_AC_KIND_ICE,
    NIP_AC_KIND_HANGUP,
    NIP_AC_KIND_REJECT,
    NIP_AC_KIND_RENEGOTIATE
} from './constants';

// Backend-facing public types (NipAcSenders, CallEventCreator,
// LocalCallEventCreator, AuthoredCallEventType, VoiceCallBackend) live
// in `./types.ts` so VoiceCallServiceNative can implement the same
// interface without circular imports back into this file. Re-exported
// here for backwards compatibility with existing importers.
import type {
    AuthoredCallEventType,
    CallEventCreator,
    CallKind,
    LocalCallEventCreator,
    NipAcSenders,
    RenegotiationState,
    VoiceCallBackend
} from './types';
export type {
    AuthoredCallEventType,
    CallEventCreator,
    CallKind,
    LocalCallEventCreator,
    NipAcSenders,
    RenegotiationState,
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
     * Media kind of the active or most recent call. Set by initiateCall
     * (outgoing) and handleOffer (incoming). Fixed for the lifetime of
     * a single call. Reset to {@code 'voice'} in cleanup.
     */
    private callKind: CallKind = 'voice';

    /**
     * Cached references to the local audio and video tracks. Populated by
     * {@code cacheLocalTracks} after every {@code getUserMedia}. The
     * audio track drives the mute toggle's {@code enabled} flag (already
     * implemented for voice calls); the video track drives camera-off
     * and is replaced on camera flip. Both are cleared in cleanup.
     */
    private localAudioTrack: MediaStreamTrack | null = null;
    private localVideoTrack: MediaStreamTrack | null = null;

    /**
     * Tracks the currently active camera facing mode for video calls.
     * Mirrored into the Svelte store for the self-view's mirroring UI.
     */
    private currentFacingMode: 'user' | 'environment' = 'user';

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

    /**
     * Cached hex pubkey of the remote peer for the active call. Set by
     * {@link createPeerConnection}. Used during renegotiation glare
     * resolution to lex-compare against the local user's pubkey.
     */
    private currentPeerHex: string | null = null;

    /**
     * Cached hex pubkey of the local user for the active call. Resolved
     * lazily on the first send/receive that needs it (initiateCall,
     * handleRenegotiate). Cleared on cleanup.
     */
    private currentSelfHex: string | null = null;

    /**
     * Active outgoing-renegotiation timeout id. Set by
     * {@link requestVideoUpgrade}; cleared by the matching answer or by
     * {@link rollbackOutgoingRenegotiation}.
     */
    private renegotiationTimeoutId: ReturnType<typeof setTimeout> | null = null;

    /**
     * Track that was attached to the peer connection as part of an
     * outgoing voice→video upgrade. Captured here so a rollback path
     * (timeout, glare loss, error) can remove it cleanly.
     */
    private renegotiationPendingVideoTrack: MediaStreamTrack | null = null;

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

    public async initiateCall(
        recipientNpub: string,
        kind: CallKind = 'voice'
    ): Promise<void> {
        const state = get(voiceCallState);
        if (state.status !== 'idle') {
            console.warn('[VoiceCall] Cannot initiate call — already in a call');
            return;
        }

        const callId = this.generateCallId();
        this.isInitiator = true;
        this.callKind = kind;
        setOutgoingRinging(recipientNpub, callId, kind);

        try {
            const constraints =
                kind === 'video' ? VIDEO_MEDIA_CONSTRAINTS : AUDIO_CONSTRAINTS;
            console.log(
                `[VoiceCall] Requesting ${kind === 'video' ? 'mic+camera' : 'microphone'} access...`
            );
            this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
            this.cacheLocalTracks();
            console.log('[VoiceCall] Media acquired, creating peer connection...');
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
                    this.senders!.sendOffer(recipientNpub, callId, offer.sdp!, {
                        callType: kind
                    })
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
            case NIP_AC_KIND_RENEGOTIATE:
                await this.handleRenegotiate(inner, callId);
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
            const constraints =
                this.callKind === 'video' ? VIDEO_MEDIA_CONSTRAINTS : AUDIO_CONSTRAINTS;
            this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
            this.cacheLocalTracks();

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
        // Capture the call's current media kind BEFORE cleanup() resets
        // it. A call that was upgraded voice→video mid-flight must
        // emit its history rumor with `call-media-type=video`, not the
        // pre-cleanup default. cleanup() runs synchronously inline and
        // would otherwise clobber `this.callKind` to 'voice' before
        // createCallEvent reads it.
        const callKindAtHangup = this.callKind;

        this.cleanup();
        endCall('hangup');

        if (status === 'active') {
            const initiatorNpub = wasInitiator ? undefined : peerNpub;
            void this.createCallEvent(
                'ended', duration, peerNpub, callId, initiatorNpub,
                callKindAtHangup);
        } else if (status === 'outgoing-ringing') {
            void this.createLocalCallEvent(
                'cancelled', peerNpub, callId, undefined, callKindAtHangup);
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

    // ------------------------------------------------------------------
    //  VoiceCallBackend — video controls
    // ------------------------------------------------------------------

    public getCallKind(): CallKind {
        return this.callKind;
    }

    public getLocalStream(): MediaStream | null {
        return this.localStream;
    }

    /**
     * Toggle the local camera by flipping the video track's {@code enabled}
     * flag. Per spec, this is a track-level mute (not a renegotiation):
     * the capturer keeps running, the SDP is unchanged, and the peer
     * receives black/empty frames while the camera is off.
     */
    public async toggleCamera(): Promise<void> {
        if (this.callKind !== 'video' || !this.localVideoTrack) {
            return;
        }
        this.localVideoTrack.enabled = !this.localVideoTrack.enabled;
        setCameraOff(!this.localVideoTrack.enabled);
    }

    /**
     * Switch between front and back cameras during an active video call.
     * Requests a new video track via {@code getUserMedia} for the opposite
     * facingMode, then swaps it into the existing video sender via
     * {@code RTCRtpSender.replaceTrack} — no SDP renegotiation. The old
     * track is stopped after the swap.
     */
    public async flipCamera(): Promise<void> {
        if (
            this.callKind !== 'video' ||
            !this.peerConnection ||
            !this.localStream ||
            !this.localVideoTrack
        ) {
            return;
        }

        const target: 'user' | 'environment' =
            this.currentFacingMode === 'user' ? 'environment' : 'user';

        setCameraFlipping(true);
        try {
            const newStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    frameRate: { ideal: 30, max: 30 },
                    facingMode: target
                }
            });
            const newVideoTrack = newStream.getVideoTracks()[0];
            if (!newVideoTrack) {
                throw new Error('getUserMedia returned no video track');
            }

            // Preserve the existing camera-off state across the swap.
            newVideoTrack.enabled = this.localVideoTrack.enabled;

            const sender = this.peerConnection
                .getSenders()
                .find(s => s.track && s.track.kind === 'video');
            if (sender) {
                await sender.replaceTrack(newVideoTrack);
            }

            // Swap the track inside our cached stream so getLocalStream()
            // reflects the new track immediately.
            const oldVideoTrack = this.localVideoTrack;
            this.localStream.removeTrack(oldVideoTrack);
            this.localStream.addTrack(newVideoTrack);
            oldVideoTrack.stop();
            this.localVideoTrack = newVideoTrack;
            this.currentFacingMode = target;
            setFacingMode(target);
        } catch (err) {
            console.error('[VoiceCall] flipCamera failed:', err);
        } finally {
            setCameraFlipping(false);
        }
    }

    public isCameraOff(): boolean {
        if (this.callKind !== 'video' || !this.localVideoTrack) return false;
        return !this.localVideoTrack.enabled;
    }

    // ------------------------------------------------------------------
    //  VoiceCallBackend — call renegotiation (NIP-AC kind 25055)
    //
    //  Implementations live further down in this file (handleRenegotiate
    //  for the receive side, requestVideoUpgrade plus its rollback
    //  helpers for the send side, and the glare branch shared between
    //  them). The accessors below expose the renegotiation state to
    //  UI subscribers; the Svelte store is the source of truth.
    // ------------------------------------------------------------------

    public getRenegotiationState(): RenegotiationState {
        return get(voiceCallState).renegotiationState;
    }

    /**
     * Cache the audio and video tracks from the active local stream after
     * every {@code getUserMedia} call. Side-effect free for voice calls
     * (video track will be {@code null}).
     */
    private cacheLocalTracks(): void {
        if (!this.localStream) {
            this.localAudioTrack = null;
            this.localVideoTrack = null;
            return;
        }
        // Defensive: some test mocks return a minimal MediaStream that
        // implements only getTracks(). Walk getTracks() and bucket by
        // track.kind rather than relying on getAudio/getVideoTracks.
        const tracks =
            typeof this.localStream.getTracks === 'function'
                ? this.localStream.getTracks()
                : [];
        this.localAudioTrack =
            tracks.find(t => t.kind === 'audio') ?? null;
        this.localVideoTrack =
            tracks.find(t => t.kind === 'video') ?? null;
    }

    private createPeerConnection(peerNpub: string, peerHex: string, callId: string): void {
        const iceServers = getIceServers();
        this.peerConnection = new RTCPeerConnection({ iceServers });
        this.iceTrickleEnabled = true;
        this.sessionRemoteDescriptionSet = false;
        this.sessionPendingIce = [];
        this.currentPeerHex = peerHex.toLowerCase();

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
                // Default to speakerphone on for video calls — users hold
                // the device away from their face. Voice calls keep the
                // existing default (off; user-controlled).
                if (this.callKind === 'video') {
                    setSpeakerOn(true);
                }
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

        // Read media kind off the inner event's `call-type` tag. The
        // sender SHOULD include `['call-type', 'voice'|'video']` on
        // every kind-25050 offer, but we default to 'voice' for
        // back-compat with older builds that omit the tag entirely.
        const callTypeTag = inner.tags.find(t => t[0] === 'call-type');
        const kind: CallKind = callTypeTag && callTypeTag[1] === 'video' ? 'video' : 'voice';
        this.callKind = kind;

        setIncomingRinging(senderNpub, callId, kind);
        this.createPeerConnection(senderNpub, inner.pubkey, callId);

        const remoteDesc = new RTCSessionDescription({
            type: 'offer',
            sdp: inner.content
        });
        await this.peerConnection!.setRemoteDescription(remoteDesc);
        await this.flushPerSessionIce();
    }

    /**
     * Inbound NIP-AC kind-25051 Call Answer. Two distinct flows share
     * this kind:
     *
     * 1. **Initial answer** — the callee accepted the original
     *    kind-25050 offer. Local status is `outgoing-ringing`. We
     *    `setRemoteDescription`, transition to `connecting`, and let
     *    ICE establish the call.
     * 2. **Renegotiation answer** — the callee accepted a kind-25055
     *    Call Renegotiate we sent during an active call. Local
     *    `renegotiationState` is `'outgoing'`. We `setRemoteDescription`
     *    (which completes the in-flight renegotiation) without
     *    changing the call's status. If the renegotiated SDP added a
     *    video m-line, we flip {@code callKind} and re-emit
     *    {@link setActive} so the UI switches to the video layout.
     *
     * Other states drop the answer silently. Wrong `call-id` drops
     * silently.
     */
    private async handleAnswer(inner: NostrEvent, callId: string): Promise<void> {
        const state = get(voiceCallState);
        if (state.callId !== callId || !this.peerConnection) return;

        const remoteDesc = new RTCSessionDescription({
            type: 'answer',
            sdp: inner.content
        });

        // Renegotiation answer path: a previously-sent kind-25055 just
        // got its kind-25051 reply. Apply without touching the call
        // status; the underlying call is still `connecting` or `active`.
        if (state.renegotiationState === 'outgoing') {
            try {
                await this.peerConnection.setRemoteDescription(remoteDesc);
                this.completeOutgoingRenegotiation(inner.content);
            } catch (err) {
                console.error(
                    '[VoiceCall] renegotiation answer apply failed; rolling back',
                    err
                );
                await this.rollbackOutgoingRenegotiation('error');
            }
            return;
        }

        // Initial answer path (the original NIP-AC offer/answer
        // exchange that establishes the call).
        if (state.status !== 'outgoing-ringing') {
            // Stray answer (e.g., we already moved past connecting).
            // Drop silently.
            return;
        }

        this.clearTimeouts();
        setConnecting();

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

    // ------------------------------------------------------------------
    //  NIP-AC kind 25055 Call Renegotiate (mid-call SDP change)
    //
    //  See openspec/changes/add-call-renegotiation/specs/voice-calling/
    //  spec.md for the authoritative requirements. Summary:
    //
    //  - Accepted only in `connecting` or `active` with matching call-id.
    //  - Glare resolution: if `signalingState === 'have-local-offer'`,
    //    lowercase-hex pubkey lex compare; HIGHER pubkey wins.
    //  - Loser performs `setLocalDescription({type: 'rollback'})` and
    //    accepts the winner's offer normally.
    //  - Response SHALL be a kind-25051 Call Answer with no `call-type`
    //    tag (an ordinary answer reusing the existing call-id).
    //  - On video m-line presence, `callKind` flips to `'video'` and
    //    `setActive` is re-emitted so the UI re-renders.
    // ------------------------------------------------------------------

    /**
     * Inbound NIP-AC kind-25055 Call Renegotiate.
     */
    private async handleRenegotiate(inner: NostrEvent, callId: string): Promise<void> {
        const state = get(voiceCallState);
        // Status guard — renegotiation has nothing to apply when we're
        // not in a live media session.
        if (state.status !== 'connecting' && state.status !== 'active') {
            console.warn(
                '[VoiceCall][Recv] handleRenegotiate: dropping; status=' + state.status
            );
            return;
        }
        if (state.callId !== callId) {
            console.warn(
                '[VoiceCall][Recv] handleRenegotiate: callId MISMATCH — dropping'
            );
            return;
        }
        if (!this.peerConnection) {
            console.warn(
                '[VoiceCall][Recv] handleRenegotiate: no peer connection — dropping'
            );
            return;
        }

        // Glare detection: an incoming renegotiate while we already
        // have a pending outgoing offer. Resolve by hex pubkey lex
        // compare — higher wins. (Per NIP-AC §"Renegotiation glare
        // handling".)
        if (this.peerConnection.signalingState === 'have-local-offer') {
            const ourHex = this.resolveSelfHexFromInnerEvent(inner);
            const theirHex = inner.pubkey.toLowerCase();
            if (ourHex !== null && ourHex > theirHex) {
                // We win. Drop their offer; keep waiting for their
                // kind-25051 to ours.
                console.log(
                    '[VoiceCall][Glare] WIN — keeping outgoing offer; dropping peer 25055'
                );
                setRenegotiationState('glare');
                return;
            }
            // We lose (or pubkeys equal — pathological self-call). Roll
            // back our pending offer, remove any artifacts we attached
            // for the upgrade, and accept theirs.
            console.log(
                '[VoiceCall][Glare] LOSE — rolling back outgoing offer; accepting peer 25055'
            );
            try {
                await this.peerConnection.setLocalDescription({
                    type: 'rollback'
                } as RTCSessionDescriptionInit);
            } catch (err) {
                console.error(
                    '[VoiceCall][Glare] rollback failed; ending call with error',
                    err
                );
                this.cleanup();
                endCall('error');
                return;
            }
            this.discardOutgoingRenegotiationArtifacts();
        }

        setRenegotiationState('incoming');

        try {
            const remoteDesc = new RTCSessionDescription({
                type: 'offer',
                sdp: inner.content
            });
            await this.peerConnection.setRemoteDescription(remoteDesc);

            // If the peer is adding a video m-line and we have no
            // local video yet, opportunistically acquire the camera.
            // Permission denial is non-fatal — we still answer with the
            // video transceiver in `recvonly` so the peer's renegotiation
            // completes and we render their video.
            const sdpHasVideo = /\nm=video[ \t]/i.test(inner.content || '');
            if (sdpHasVideo && !this.localVideoTrack) {
                await this.acquireLocalVideoForIncomingUpgrade();
            }

            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);

            if (this.senders && answer.sdp && state.peerNpub) {
                await this.tryCall(() =>
                    this.senders!.sendAnswer(state.peerNpub!, callId, answer.sdp!)
                );
            }

            // If the resulting SDP carries a video m-line, the call's
            // media kind has changed. Flip the cached field AND the
            // store's `callKind` so subscribers re-render against the
            // new kind. The call's status is preserved — renegotiation
            // does not transition between connecting/active.
            // Voice→video upgrades are the primary user-facing case.
            if (this.didCallBecomeVideo(answer.sdp ?? '', inner.content)) {
                this.callKind = 'video';
                setCallKind('video');
                // Default speaker on for video so the user doesn't have
                // to fiddle while phone-to-ear.
                setSpeakerOn(true);
            }
        } catch (err) {
            console.error('[VoiceCall][Recv] handleRenegotiate failed', err);
        } finally {
            setRenegotiationState('idle');
        }
    }

    /**
     * Acquire camera (best effort) to attach a local video track during
     * an incoming voice→video upgrade. On permission denial we
     * intentionally proceed — the peer still gets their kind-25051 and
     * we render their video; only our self-view is degraded.
     */
    private async acquireLocalVideoForIncomingUpgrade(): Promise<void> {
        if (!this.peerConnection || !this.localStream) return;
        try {
            const camStream = await navigator.mediaDevices.getUserMedia({
                video: VIDEO_MEDIA_CONSTRAINTS.video
            });
            const videoTrack = camStream.getVideoTracks()[0];
            if (!videoTrack) return;
            this.localStream.addTrack(videoTrack);
            this.localVideoTrack = videoTrack;
            this.peerConnection.addTrack(videoTrack, this.localStream);
        } catch (err) {
            console.warn(
                '[VoiceCall] camera permission denied / unavailable during upgrade',
                err
            );
            // No-op: we'll still answer; the peer's video transceiver
            // will be sendrecv on their side and recvonly on ours.
        }
    }

    /**
     * User-facing entry point. Initiates a voice→video upgrade by
     * acquiring the camera, attaching a video track to the existing
     * peer connection, creating a new SDP offer, and publishing it as
     * kind 25055. Guarded — silently no-ops when the call is not
     * eligible.
     */
    public async requestVideoUpgrade(): Promise<void> {
        const state = get(voiceCallState);
        if (state.status !== 'active') {
            console.warn(
                '[VoiceCall] requestVideoUpgrade: not active (status=' + state.status + ')'
            );
            return;
        }
        if (this.callKind !== 'voice') {
            console.warn('[VoiceCall] requestVideoUpgrade: already video');
            return;
        }
        if (state.renegotiationState !== 'idle') {
            console.warn(
                '[VoiceCall] requestVideoUpgrade: already renegotiating ('
                    + state.renegotiationState + ')'
            );
            return;
        }
        if (!this.peerConnection || !this.localStream || !state.peerNpub || !state.callId) {
            console.warn('[VoiceCall] requestVideoUpgrade: missing session state');
            return;
        }

        setRenegotiationState('outgoing');

        // Acquire camera.
        let videoTrack: MediaStreamTrack;
        try {
            const camStream = await navigator.mediaDevices.getUserMedia({
                video: VIDEO_MEDIA_CONSTRAINTS.video
            });
            const t = camStream.getVideoTracks()[0];
            if (!t) throw new Error('getUserMedia returned no video track');
            videoTrack = t;
        } catch (err) {
            console.warn('[VoiceCall] camera permission denied for upgrade', err);
            setRenegotiationState('idle');
            return;
        }

        try {
            this.localStream.addTrack(videoTrack);
            this.localVideoTrack = videoTrack;
            this.peerConnection.addTrack(videoTrack, this.localStream);
            this.renegotiationPendingVideoTrack = videoTrack;

            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);

            if (this.senders && offer.sdp) {
                await this.tryCall(() =>
                    this.senders!.sendRenegotiate(state.peerNpub!, state.callId!, offer.sdp!)
                );
            }

            // Arm the timeout. If no kind-25051 arrives within
            // RENEGOTIATION_TIMEOUT_MS we roll back.
            this.renegotiationTimeoutId = setTimeout(() => {
                void this.rollbackOutgoingRenegotiation('timeout');
            }, RENEGOTIATION_TIMEOUT_MS);
        } catch (err) {
            console.error('[VoiceCall] requestVideoUpgrade failed', err);
            await this.rollbackOutgoingRenegotiation('error');
        }
    }

    /**
     * Successful outgoing renegotiation: the peer's kind-25051 has
     * been applied. Clear the timeout, flip {@code callKind} if the
     * SDP indicates video, and reset the renegotiation state.
     */
    private completeOutgoingRenegotiation(remoteAnswerSdp: string): void {
        if (this.renegotiationTimeoutId) {
            clearTimeout(this.renegotiationTimeoutId);
            this.renegotiationTimeoutId = null;
        }
        // Once the answer has been applied we no longer need to track
        // the just-attached video track for rollback purposes.
        this.renegotiationPendingVideoTrack = null;

        // Reflect the new media kind. The peer's answer SDP carries a
        // video m-line iff they accepted the upgrade (a true decline
        // would either omit the m-line or mark it inactive). The
        // call's status is unchanged — renegotiation does not move
        // between `connecting` and `active`.
        const peerAcceptedVideo =
            /\nm=video[ \t]/i.test(remoteAnswerSdp || '') &&
            !/\na=inactive/i.test(remoteAnswerSdp || '');
        if (peerAcceptedVideo) {
            this.callKind = 'video';
            setCallKind('video');
            setSpeakerOn(true);
        } else {
            // Peer declined the video upgrade; remove the local track
            // we attached so we're not capturing pointlessly.
            this.discardOutgoingRenegotiationArtifacts();
        }
        setRenegotiationState('idle');
    }

    /**
     * Roll back an in-flight outgoing renegotiation. Called on timeout,
     * glare-loss, error, or peer-decline. Restores the peer connection
     * to its pre-renegotiation SDP state (best effort) and removes the
     * video track we attached. Leaves the underlying call active.
     */
    private async rollbackOutgoingRenegotiation(reason: string): Promise<void> {
        if (this.renegotiationTimeoutId) {
            clearTimeout(this.renegotiationTimeoutId);
            this.renegotiationTimeoutId = null;
        }
        if (
            this.peerConnection &&
            this.peerConnection.signalingState === 'have-local-offer'
        ) {
            try {
                await this.peerConnection.setLocalDescription({
                    type: 'rollback'
                } as RTCSessionDescriptionInit);
            } catch (err) {
                console.warn(
                    '[VoiceCall] rollbackOutgoingRenegotiation: setLocalDescription(rollback) failed',
                    err
                );
            }
        }
        this.discardOutgoingRenegotiationArtifacts();
        console.log('[VoiceCall] outgoing renegotiation rolled back; reason=' + reason);
        setRenegotiationState('idle');
    }

    /**
     * Tear down the local video track and sender that were attached
     * during an outgoing voice→video upgrade. No-op when no upgrade
     * artifacts are present.
     */
    private discardOutgoingRenegotiationArtifacts(): void {
        const track = this.renegotiationPendingVideoTrack;
        this.renegotiationPendingVideoTrack = null;
        if (!track) return;
        try {
            track.stop();
        } catch (_) { /* ignore */ }
        if (this.localStream) {
            try { this.localStream.removeTrack(track); } catch (_) { /* ignore */ }
        }
        if (this.peerConnection) {
            const sender = this.peerConnection
                .getSenders()
                .find(s => s.track === track || (s.track && s.track.kind === 'video'));
            if (sender) {
                try { this.peerConnection.removeTrack(sender); } catch (_) { /* ignore */ }
            }
        }
        if (this.localVideoTrack === track) {
            this.localVideoTrack = null;
        }
    }

    /**
     * Returns true iff the renegotiated SDP exchange transitions the
     * call from voice-only to video-bearing. Inspects both the
     * remote-offer and the local-answer (or vice versa) for a video
     * m-line that is not declared {@code inactive} on the answer side.
     */
    private didCallBecomeVideo(answerSdp: string, offerSdp: string): boolean {
        if (this.callKind === 'video') return false; // already video
        const offerHasVideo = /\nm=video[ \t]/i.test(offerSdp || '');
        if (!offerHasVideo) return false;
        // Treat the answer as accepting video unless explicitly inactive.
        return !/\na=inactive/i.test(answerSdp || '');
    }

    /**
     * Locate the local user's hex pubkey from the receive-side inner
     * event. Every NIP-AC inner event addressed to us carries our
     * pubkey in a `['p', <hex>]` tag. Used during glare resolution
     * (we MUST compare lowercase hex strings deterministically on both
     * sides).
     */
    private resolveSelfHexFromInnerEvent(inner: NostrEvent): string | null {
        const pTag = inner.tags.find(t => Array.isArray(t) && t[0] === 'p');
        if (!pTag || typeof pTag[1] !== 'string') return null;
        const hex = pTag[1].toLowerCase();
        this.currentSelfHex = hex;
        return hex;
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
        initiatorNpub?: string,
        callKindOverride?: CallKind
    ): Promise<void> {
        const peerNpub = peerNpubOverride ?? get(voiceCallState).peerNpub;
        if (!peerNpub || !this.createCallEventFn) return;
        try {
            // The active call's kind is captured into the rumor so the
            // call-history UI can distinguish voice vs video pills.
            // Callers MAY pass {@code callKindOverride} when the rumor
            // is authored AFTER cleanup() has reset {@code this.callKind}
            // (the standard hangup path captures the kind before cleanup
            // and forwards it here). When omitted we fall back to the
            // current cached kind, which is correct for the
            // "still-in-progress" callsites.
            const kind = callKindOverride ?? this.callKind;
            await this.createCallEventFn(
                peerNpub, type, duration, callId, initiatorNpub, kind);
        } catch (err) {
            console.error('[VoiceCall] Failed to create call event:', err);
        }
    }

    private async createLocalCallEvent(
        type: AuthoredCallEventType,
        peerNpubOverride: string,
        callId: string,
        initiatorNpub?: string,
        callKindOverride?: CallKind
    ): Promise<void> {
        if (!this.localCreateCallEventFn) return;
        try {
            const kind = callKindOverride ?? this.callKind;
            await this.localCreateCallEventFn(
                peerNpubOverride, type, callId, initiatorNpub, kind);
        } catch (err) {
            console.error('[VoiceCall] Failed to create local call event:', err);
        }
    }

    private cleanup(): void {
        this.clearTimeouts();
        this.iceTrickleEnabled = false;
        this.isInitiator = false;
        this.callKind = 'voice';
        this.localAudioTrack = null;
        this.localVideoTrack = null;
        this.currentFacingMode = 'user';
        this.sessionRemoteDescriptionSet = false;
        this.sessionPendingIce = [];
        this.globalIceBuffer.clear();
        this.currentPeerHex = null;
        this.currentSelfHex = null;

        // Renegotiation cleanup. The store's renegotiationState is
        // reset to 'idle' by endCall / resetCall on the store side; we
        // clear the local timer and pending video-track reference here.
        if (this.renegotiationTimeoutId) {
            clearTimeout(this.renegotiationTimeoutId);
            this.renegotiationTimeoutId = null;
        }
        this.renegotiationPendingVideoTrack = null;

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
