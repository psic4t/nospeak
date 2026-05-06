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
    setRenegotiationState,
    groupVoiceCallState,
    setGroupOutgoingRinging,
    setGroupIncomingRinging,
    upsertGroupParticipant,
    setGroupParticipantStatus,
    setGroupConnecting,
    endGroupCall,
    setGroupEndedAnsweredElsewhere,
    setGroupEndedRejectedElsewhere,
    toggleGroupMute as storeGroupMute,
    incrementGroupDuration,
    resetGroupCall
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
    NIP_AC_KIND_RENEGOTIATE,
    GROUP_CALL_ID_TAG,
    CONVERSATION_ID_TAG,
    INITIATOR_TAG,
    PARTICIPANTS_TAG,
    ROLE_TAG,
    ROLE_INVITE,
    GROUP_CALL_MAX_PARTICIPANTS
} from './constants';
import { conversationRepo } from '$lib/db/ConversationRepository';
import { currentUser } from '$lib/stores/auth';
import type { NipAcGroupSendContext } from './types';

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
    VoiceCallBackend,
    GroupCallEventCreator,
    LocalGroupCallEventCreator,
    VoiceCallEndReason
} from './types';
export type {
    AuthoredCallEventType,
    CallEventCreator,
    CallKind,
    LocalCallEventCreator,
    NipAcSenders,
    RenegotiationState,
    VoiceCallBackend,
    GroupCallEventCreator,
    LocalGroupCallEventCreator
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
     * Authoring callbacks for GROUP-call history (Kind 1405 with
     * multiple `p` tags + `group-call-id` + `conversation-id`).
     * Registered by `Messaging.ts` alongside the 1-on-1 callbacks.
     */
    private createGroupCallEventFn: GroupCallEventCreator | null = null;
    private createLocalGroupCallEventFn: LocalGroupCallEventCreator | null = null;
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

    // ------------------------------------------------------------------
    //  Group voice-call state (full-mesh, anchored to a group
    //  conversation). Activated by `initiateGroupCall` /
    //  `acceptGroupCall` / mesh-formation inbound offers; cleared by
    //  `cleanupGroup`. Coexists with the 1-on-1 fields above; the "one
    //  call total" invariant guarantees only one is active at a time.
    //
    //  See the design doc and spec deltas under
    //  openspec/changes/add-group-voice-calling/.
    // ------------------------------------------------------------------

    /** Active group call's id, or null while no group call is in progress. */
    private currentGroupCallId: string | null = null;

    /**
     * Per-peer WebRTC sessions in the group's mesh, keyed by peer hex
     * pubkey. Cleared on group call cleanup.
     */
    private groupPeerConnections: Map<
        string,
        {
            pc: RTCPeerConnection;
            callId: string;
            peerNpub: string;
            iceTrickleEnabled: boolean;
            sessionRemoteDescriptionSet: boolean;
            sessionPendingIce: RTCIceCandidateInit[];
            offerTimeoutId: ReturnType<typeof setTimeout> | null;
            iceTimeoutId: ReturnType<typeof setTimeout> | null;
            remoteStream: MediaStream | null;
        }
    > = new Map();

    /**
     * Pending inbound offers for the active group call, indexed by peer
     * hex pubkey. Buffered while {@code incoming-ringing} so that
     * `acceptGroupCall` can drain them in one pass. Each entry is the
     * inbound kind-25050 inner event (real-SDP or invite-only).
     */
    private groupPendingOffers: Map<string, NostrEvent> = new Map();

    /**
     * NIP-AC ICE candidate buffering for groups — global layer keyed
     * by `(senderHex, groupCallId)`. Holds candidates received before a
     * matching `RTCPeerConnection` exists. The map's values are arrays
     * keyed first by group-call-id then by sender hex; cleared on group
     * cleanup.
     */
    private groupGlobalIceBuffer: Map<string, Map<string, RTCIceCandidateInit[]>>
        = new Map();

    /**
     * Authoritative {@code (groupCallId → {initiatorHex, conversationId,
     * roster})} cache. Populated from the FIRST kind-25050 received
     * locally for a given {@code group-call-id}. Subsequent inner events
     * whose tags disagree with the cached values SHALL be dropped.
     * Cleared on group cleanup.
     */
    private groupAuthoritativeQuad: {
        groupCallId: string;
        initiatorHex: string;
        conversationId: string;
        roster: string[];
    } | null = null;

    /**
     * Whether the local user is the initiator of the active group call.
     * Drives the "outgoing-ringing" branch of seeding and the
     * call-history authoring decision (initiator authors `cancelled`
     * locally; everyone else authors `missed`).
     */
    private groupIsInitiator = false;

    /** Local user's hex pubkey for the active group call. */
    private groupSelfHex: string | null = null;

    /** Anchored conversation id of the active group call. */
    private groupConversationId: string | null = null;

    /** Duration timer for the active group call. Started on first peer active. */
    private groupDurationIntervalId: ReturnType<typeof setInterval> | null = null;
    private groupDurationStarted = false;

    /** Local capture stream shared across all peers in the mesh. */
    private groupLocalStream: MediaStream | null = null;

    public registerNipAcSenders(senders: NipAcSenders): void {
        this.senders = senders;
    }

    public registerCallEventCreator(fn: CallEventCreator): void {
        this.createCallEventFn = fn;
    }

    public registerLocalCallEventCreator(fn: LocalCallEventCreator): void {
        this.localCreateCallEventFn = fn;
    }

    public registerGroupCallEventCreator(fn: GroupCallEventCreator): void {
        this.createGroupCallEventFn = fn;
    }

    public registerLocalGroupCallEventCreator(
        fn: LocalGroupCallEventCreator
    ): void {
        this.createLocalGroupCallEventFn = fn;
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
        const groupState = get(groupVoiceCallState);
        const inGroupCall =
            groupState.status !== 'idle' && groupState.status !== 'ended';
        if (state.status !== 'idle' || inGroupCall) {
            console.warn(
                '[VoiceCall] Cannot initiate call — already in a call'
            );
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
     *
     * <p>Branches on presence of `['group-call-id', ...]`: when present
     * the event is part of a group call and is routed to the group
     * dispatch path; when absent the existing 1-on-1 path runs
     * unchanged.
     */
    public async handleNipAcEvent(inner: NostrEvent): Promise<void> {
        const groupCallId = this.getTagValue(inner, GROUP_CALL_ID_TAG);
        if (groupCallId) {
            await this.handleGroupNipAcEvent(inner, groupCallId);
            return;
        }
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
     * `ended` with reason `answered-elsewhere`.
     *
     * <p>Group calls dedup on `group-call-id` rather than per-pair
     * `call-id` (per the spec's modified self-event filter): when the
     * self-event carries `['group-call-id', G]` and the local group
     * status is `incoming-ringing` for the same G, we transition the
     * GROUP store to `ended` and stop ringing.
     */
    public async handleSelfAnswer(inner: NostrEvent): Promise<void> {
        const groupCallId = this.getTagValue(inner, GROUP_CALL_ID_TAG);
        if (groupCallId) {
            const groupState = get(groupVoiceCallState);
            if (
                groupState.status !== 'incoming-ringing' ||
                groupState.groupCallId !== groupCallId
            ) {
                return;
            }
            this.cleanupGroup();
            setGroupEndedAnsweredElsewhere();
            return;
        }
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
     * Call Reject arrives in `incoming-ringing` state. Generalized to
     * dedup on `group-call-id` when present (per the spec's modified
     * self-event filter).
     */
    public async handleSelfReject(inner: NostrEvent): Promise<void> {
        const groupCallId = this.getTagValue(inner, GROUP_CALL_ID_TAG);
        if (groupCallId) {
            const groupState = get(groupVoiceCallState);
            if (
                groupState.status !== 'incoming-ringing' ||
                groupState.groupCallId !== groupCallId
            ) {
                return;
            }
            this.cleanupGroup();
            setGroupEndedRejectedElsewhere();
            return;
        }
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
        const groupState = get(groupVoiceCallState);

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

        // Concurrency: a 1-on-1 offer arriving while we are in ANY
        // call (1-on-1 or group, in any non-idle/non-ended state) is
        // auto-rejected with busy. Per the modified
        // "Call Initiation Restrictions" spec.
        const inGroupCall =
            groupState.status !== 'idle' && groupState.status !== 'ended';
        if (state.status !== 'idle' || inGroupCall) {
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

    // ==================================================================
    //  Group voice-call methods (full-mesh, anchored to a group
    //  conversation). All implementations live in this contiguous block
    //  so the 1-on-1 surface above is unmodified except for the small
    //  dispatch branch in `handleNipAcEvent` and the `cleanup()` call
    //  to `cleanupGroup` below.
    // ==================================================================

    /**
     * Initiate an outgoing GROUP voice call anchored to an existing
     * group conversation. Validates roster size and conversation
     * membership, allocates a fresh group-call id, and seeds an
     * offer to every other roster member according to the
     * deterministic-pair offerer rule (lex-lower → real-SDP offer;
     * lex-higher → invite-only offer with empty SDP).
     *
     * <p>Voice-only in v1; group video is not supported.
     */
    public async initiateGroupCall(conversationId: string): Promise<void> {
        if (this.isAnyCallActive()) {
            console.warn(
                '[VoiceCall] Cannot initiate group call — already in a call'
            );
            return;
        }

        const conv = await conversationRepo.getConversation(conversationId);
        if (!conv || !conv.isGroup) {
            console.warn(
                '[VoiceCall] initiateGroupCall: no group conversation with id',
                conversationId
            );
            return;
        }

        const participantNpubs = conv.participants;
        const selfNpub = get(currentUser)?.npub;
        if (!selfNpub) {
            console.warn('[VoiceCall] initiateGroupCall: no current user');
            return;
        }
        const selfHex = (nip19.decode(selfNpub).data as string).toLowerCase();
        if (!participantNpubs.includes(selfNpub)) {
            console.warn(
                '[VoiceCall] initiateGroupCall: local user not in conversation participants'
            );
            return;
        }

        // Build the canonical roster: hex pubkeys of all participants
        // (including self), lowercased and lexicographically sorted.
        const otherNpubs = participantNpubs.filter((np) => np !== selfNpub);
        const otherHexes = otherNpubs.map(
            (np) => (nip19.decode(np).data as string).toLowerCase()
        );
        const roster = [selfHex, ...otherHexes].sort();

        if (roster.length > GROUP_CALL_MAX_PARTICIPANTS) {
            console.warn(
                `[VoiceCall] initiateGroupCall: roster size ${roster.length} exceeds cap ${GROUP_CALL_MAX_PARTICIPANTS}`
            );
            return;
        }
        if (roster.length < 2) {
            console.warn(
                '[VoiceCall] initiateGroupCall: need at least 2 participants'
            );
            return;
        }

        const groupCallId = this.generateGroupCallId();
        const initiatorHex = selfHex;

        // Acquire microphone once; the same audio track is added to every
        // peer connection in the mesh.
        let localStream: MediaStream;
        try {
            localStream = await navigator.mediaDevices.getUserMedia(
                AUDIO_CONSTRAINTS
            );
        } catch (err) {
            console.error(
                '[VoiceCall] initiateGroupCall: getUserMedia failed',
                err
            );
            return;
        }
        this.groupLocalStream = localStream;

        // Seed authoritative quadruple from our own kick-off so any
        // mesh-formation offers we receive later validate against the
        // same values we publish.
        this.groupAuthoritativeQuad = {
            groupCallId,
            initiatorHex,
            conversationId,
            roster
        };
        this.groupIsInitiator = true;
        this.groupSelfHex = selfHex;
        this.groupConversationId = conversationId;
        this.currentGroupCallId = groupCallId;

        // Build per-peer seeds using the deterministic-pair offerer
        // rule, then send offers in parallel. Offers SHALL NOT be
        // self-wrapped (per spec, matching 1-on-1 offer rules).
        const seeds: Array<{
            pubkeyHex: string;
            callId: string;
            role: 'offerer' | 'answerer';
            pcStatus: 'pending' | 'ringing';
        }> = [];

        for (const peerHex of otherHexes) {
            const peerNpub = nip19.npubEncode(peerHex);
            const callId = this.generateCallId();
            const localIsOfferer = selfHex < peerHex;
            seeds.push({
                pubkeyHex: peerHex,
                callId,
                role: localIsOfferer ? 'offerer' : 'answerer',
                pcStatus: 'ringing'
            });

            const groupCtx: NipAcGroupSendContext = {
                groupCallId,
                conversationId,
                initiatorHex,
                participants: roster,
                roleInvite: !localIsOfferer
            };

            if (localIsOfferer) {
                // Build PC, attach audio, create real-SDP offer.
                this.createGroupPeerConnection(peerHex, peerNpub, callId);
                const session = this.groupPeerConnections.get(peerHex)!;
                this.groupLocalStream.getAudioTracks().forEach((t) => {
                    session.pc.addTrack(t, this.groupLocalStream!);
                });
                try {
                    const offer = await session.pc.createOffer();
                    await session.pc.setLocalDescription(offer);
                    if (this.senders && offer.sdp) {
                        await this.tryCall(() =>
                            this.senders!.sendOffer(
                                peerNpub,
                                callId,
                                offer.sdp!,
                                {
                                    callType: 'voice',
                                    group: { ...groupCtx, roleInvite: false }
                                }
                            )
                        );
                    }
                    this.armGroupOfferTimeout(peerHex);
                } catch (err) {
                    console.error(
                        '[VoiceCall] initiateGroupCall: offer build failed for peer',
                        peerHex,
                        err
                    );
                    setGroupParticipantStatus(peerHex, 'ended', 'error');
                }
            } else {
                // Invite-only kind-25050 with empty content.
                if (this.senders) {
                    await this.tryCall(() =>
                        this.senders!.sendOffer(peerNpub, callId, '', {
                            callType: 'voice',
                            group: groupCtx
                        })
                    );
                }
                this.armGroupOfferTimeout(peerHex);
            }
        }

        setGroupOutgoingRinging(
            groupCallId,
            conversationId,
            initiatorHex,
            roster,
            seeds
        );
    }

    /**
     * Accept the in-progress incoming GROUP voice call. Drains the
     * pending-offers buffer: real-SDP offers get answered (kind 25051);
     * invite-only offers prompt this device to send a real-SDP offer
     * (kind 25050) back; for any roster member with no edge yet, the
     * lex rule decides whether we offer or wait.
     */
    public async acceptGroupCall(): Promise<void> {
        const groupState = get(groupVoiceCallState);
        if (
            groupState.status !== 'incoming-ringing' ||
            !this.groupAuthoritativeQuad ||
            !this.groupSelfHex
        ) {
            console.warn(
                '[VoiceCall] acceptGroupCall: not in group incoming-ringing'
            );
            return;
        }

        const { groupCallId, initiatorHex, conversationId, roster } =
            this.groupAuthoritativeQuad;
        const selfHex = this.groupSelfHex;

        try {
            const stream = await navigator.mediaDevices.getUserMedia(
                AUDIO_CONSTRAINTS
            );
            this.groupLocalStream = stream;
        } catch (err) {
            console.error(
                '[VoiceCall] acceptGroupCall: getUserMedia failed',
                err
            );
            this.cleanupGroup();
            endGroupCall('error');
            return;
        }

        setGroupConnecting();

        // Drain pending offers. Real-SDP → answer back; invite-only →
        // we are the offerer, send a real-SDP kind-25050 back.
        const pending = Array.from(this.groupPendingOffers.entries());
        this.groupPendingOffers.clear();

        for (const [peerHex, offerEvent] of pending) {
            const peerNpub = nip19.npubEncode(peerHex);
            const callId = this.getTagValue(offerEvent, 'call-id');
            if (!callId) continue;
            const isInvite =
                offerEvent.tags.some(
                    (t) => t[0] === ROLE_TAG && t[1] === ROLE_INVITE
                ) || offerEvent.content === '';

            const groupCtx: NipAcGroupSendContext = {
                groupCallId,
                conversationId,
                initiatorHex
            };

            if (!isInvite) {
                // Real-SDP offer → we are the answerer for this edge.
                this.createGroupPeerConnection(peerHex, peerNpub, callId);
                const session = this.groupPeerConnections.get(peerHex)!;
                this.groupLocalStream.getAudioTracks().forEach((t) => {
                    session.pc.addTrack(t, this.groupLocalStream!);
                });
                try {
                    await session.pc.setRemoteDescription(
                        new RTCSessionDescription({
                            type: 'offer',
                            sdp: offerEvent.content
                        })
                    );
                    await this.flushGroupPerSessionIce(peerHex);
                    const answer = await session.pc.createAnswer();
                    await session.pc.setLocalDescription(answer);
                    if (this.senders && answer.sdp) {
                        await this.tryCall(() =>
                            this.senders!.sendAnswer(
                                peerNpub,
                                callId,
                                answer.sdp!,
                                { group: groupCtx }
                            )
                        );
                    }
                    setGroupParticipantStatus(peerHex, 'connecting');
                } catch (err) {
                    console.error(
                        '[VoiceCall] acceptGroupCall: answer build failed for',
                        peerHex,
                        err
                    );
                    setGroupParticipantStatus(peerHex, 'ended', 'error');
                }
            } else {
                // Invite-only → we are the offerer. Allocate our own
                // per-pair callId for this edge (the inviter does not
                // own the call-id on an invite-only offer).
                const ourCallId = this.generateCallId();
                this.createGroupPeerConnection(peerHex, peerNpub, ourCallId);
                const session = this.groupPeerConnections.get(peerHex)!;
                this.groupLocalStream.getAudioTracks().forEach((t) => {
                    session.pc.addTrack(t, this.groupLocalStream!);
                });
                try {
                    const offer = await session.pc.createOffer();
                    await session.pc.setLocalDescription(offer);
                    if (this.senders && offer.sdp) {
                        await this.tryCall(() =>
                            this.senders!.sendOffer(
                                peerNpub,
                                ourCallId,
                                offer.sdp!,
                                {
                                    callType: 'voice',
                                    group: {
                                        ...groupCtx,
                                        participants: roster,
                                        roleInvite: false
                                    }
                                }
                            )
                        );
                    }
                    setGroupParticipantStatus(peerHex, 'ringing');
                    this.armGroupOfferTimeout(peerHex);
                } catch (err) {
                    console.error(
                        '[VoiceCall] acceptGroupCall: invite-back offer failed',
                        err
                    );
                    setGroupParticipantStatus(peerHex, 'ended', 'error');
                }
            }
        }

        // For roster members without ANY edge yet, apply the
        // deterministic-pair rule: if we are lex-lower, offer
        // proactively; otherwise wait for them to offer to us.
        for (const peerHex of roster) {
            if (peerHex === selfHex) continue;
            if (this.groupPeerConnections.has(peerHex)) continue;
            if (selfHex < peerHex) {
                const peerNpub = nip19.npubEncode(peerHex);
                const ourCallId = this.generateCallId();
                this.createGroupPeerConnection(peerHex, peerNpub, ourCallId);
                const session = this.groupPeerConnections.get(peerHex)!;
                this.groupLocalStream.getAudioTracks().forEach((t) => {
                    session.pc.addTrack(t, this.groupLocalStream!);
                });
                try {
                    const offer = await session.pc.createOffer();
                    await session.pc.setLocalDescription(offer);
                    if (this.senders && offer.sdp) {
                        await this.tryCall(() =>
                            this.senders!.sendOffer(
                                peerNpub,
                                ourCallId,
                                offer.sdp!,
                                {
                                    callType: 'voice',
                                    group: {
                                        groupCallId,
                                        conversationId,
                                        initiatorHex,
                                        participants: roster,
                                        roleInvite: false
                                    }
                                }
                            )
                        );
                    }
                    upsertGroupParticipant(peerHex, {
                        callId: ourCallId,
                        role: 'offerer',
                        pcStatus: 'ringing'
                    });
                    this.armGroupOfferTimeout(peerHex);
                } catch (err) {
                    console.error(
                        '[VoiceCall] acceptGroupCall: backstop offer failed',
                        err
                    );
                }
            } else {
                // Lex-higher peer: we wait for them to offer to us.
                upsertGroupParticipant(peerHex, {
                    callId: '',
                    role: 'answerer',
                    pcStatus: 'pending'
                });
            }
        }
    }

    /**
     * Decline the in-progress incoming GROUP voice call. Sends kind
     * 25054 to every pending offerer (self-wrapped per the existing
     * 1-on-1 reject rule, which mirrors group rules). Authors a
     * local-only Kind 1405 `'declined'` entry in the group chat.
     */
    public declineGroupCall(): void {
        const groupState = get(groupVoiceCallState);
        if (
            groupState.status !== 'incoming-ringing' ||
            !this.groupAuthoritativeQuad
        )
            return;

        const { groupCallId, initiatorHex, conversationId } =
            this.groupAuthoritativeQuad;

        const pending = Array.from(this.groupPendingOffers.entries());
        this.cleanupGroup();
        endGroupCall('rejected');

        for (const [peerHex, offerEvent] of pending) {
            const peerNpub = nip19.npubEncode(peerHex);
            const callId = this.getTagValue(offerEvent, 'call-id');
            if (!callId) continue;
            if (this.senders) {
                void this.tryCall(() =>
                    this.senders!.sendReject(peerNpub, callId, undefined, {
                        group: { groupCallId, conversationId, initiatorHex }
                    })
                );
            }
        }

        // Local-only `'declined'` entry — the local user is the
        // "decline-author"; the initiator authored the offer chain so
        // is recorded as `call-initiator`.
        void this.createLocalGroupCallEvent(
            'declined',
            conversationId,
            groupCallId,
            initiatorHex
        );
    }

    /**
     * Hang up / leave the active GROUP voice call. Sends kind 25053 to
     * every still-active or still-connecting peer; tears down all
     * local PCs. Aggregate per-call status transitions to `ended`
     * locally; remaining participants stay connected to each other.
     */
    public hangupGroupCall(): void {
        const groupState = get(groupVoiceCallState);
        if (
            groupState.groupCallId === null ||
            !this.groupAuthoritativeQuad
        )
            return;

        const { groupCallId, initiatorHex, conversationId, roster } =
            this.groupAuthoritativeQuad;
        const wasInitiator = this.groupIsInitiator;
        const wasActive = groupState.status === 'active';
        const wasOutgoingRinging = groupState.status === 'outgoing-ringing';
        const duration = groupState.duration;
        const otherRosterHex = roster.filter(
            (h) => h !== this.groupSelfHex
        );

        // Snapshot the still-live peers BEFORE cleanup tears them down.
        const livePeers: Array<{ peerHex: string; callId: string }> = [];
        for (const [peerHex, session] of this.groupPeerConnections) {
            const ps = groupState.participants[peerHex];
            if (ps && ps.pcStatus !== 'ended') {
                livePeers.push({ peerHex, callId: session.callId });
            }
        }

        this.cleanupGroup();
        endGroupCall('hangup');

        for (const { peerHex, callId } of livePeers) {
            const peerNpub = nip19.npubEncode(peerHex);
            if (this.senders) {
                void this.tryCall(() =>
                    this.senders!.sendHangup(peerNpub, callId, undefined, {
                        group: { groupCallId, conversationId, initiatorHex }
                    })
                );
            }
        }

        const otherNpubs = otherRosterHex.map((h) => nip19.npubEncode(h));
        const initiatorNpub = nip19.npubEncode(initiatorHex);
        if (wasActive) {
            void this.createGroupCallEvent(
                'ended',
                duration,
                conversationId,
                otherNpubs,
                groupCallId,
                initiatorNpub
            );
        } else if (wasOutgoingRinging && wasInitiator) {
            void this.createLocalGroupCallEvent(
                'cancelled',
                conversationId,
                groupCallId,
                initiatorHex
            );
        }
    }

    /**
     * Toggle local microphone mute across every peer connection in the
     * group's mesh. The same audio track is shared, so flipping its
     * `enabled` flag mutes us to all peers simultaneously.
     */
    public toggleGroupMute(): void {
        if (this.groupLocalStream) {
            this.groupLocalStream.getAudioTracks().forEach((t) => {
                t.enabled = !t.enabled;
            });
        }
        storeGroupMute();
    }

    /**
     * Snapshot of the active group call's remote streams keyed by peer
     * hex pubkey. UI components bind one hidden {@code <audio>} element
     * per entry so the browser mixes audio across all peers without
     * any extra Web-Audio plumbing on our side. Returns an empty map
     * when no group call is in progress.
     */
    public getGroupRemoteStreams(): Map<string, MediaStream> {
        const out = new Map<string, MediaStream>();
        for (const [peerHex, session] of this.groupPeerConnections) {
            if (session.remoteStream) out.set(peerHex, session.remoteStream);
        }
        return out;
    }

    /**
     * Generate a fresh 32-byte hex group-call id. Distinct from the
     * UUID-shaped per-pair {@link generateCallId}.
     */
    public generateGroupCallId(): string {
        const bytes = new Uint8Array(32);
        crypto.getRandomValues(bytes);
        return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Returns true iff any call (1-on-1 or group) is in progress —
     * i.e. either store is in a non-`idle`/non-`ended` state. Used by
     * the busy-rejection branch to enforce the "one call total"
     * invariant.
     */
    private isAnyCallActive(): boolean {
        const oneToOne = get(voiceCallState).status;
        const group = get(groupVoiceCallState).status;
        return (
            (oneToOne !== 'idle' && oneToOne !== 'ended') ||
            (group !== 'idle' && group !== 'ended')
        );
    }

    /**
     * Build a per-peer {@code RTCPeerConnection} for the active group
     * call, install the standard event handlers, and register it in
     * the {@link groupPeerConnections} map. Drains any globally
     * buffered ICE for this peer into the per-session buffer.
     */
    private createGroupPeerConnection(
        peerHex: string,
        peerNpub: string,
        callId: string
    ): void {
        const iceServers = getIceServers();
        const pc = new RTCPeerConnection({ iceServers });
        const session = {
            pc,
            callId,
            peerNpub,
            iceTrickleEnabled: true,
            sessionRemoteDescriptionSet: false,
            sessionPendingIce: [] as RTCIceCandidateInit[],
            offerTimeoutId: null as ReturnType<typeof setTimeout> | null,
            iceTimeoutId: null as ReturnType<typeof setTimeout> | null,
            remoteStream: null as MediaStream | null
        };
        this.groupPeerConnections.set(peerHex, session);

        // Drain global ICE buffer into per-session buffer.
        const groupCallId = this.currentGroupCallId;
        if (groupCallId) {
            const byGroup = this.groupGlobalIceBuffer.get(groupCallId);
            const buffered = byGroup?.get(peerHex);
            if (buffered && buffered.length > 0) {
                session.sessionPendingIce.push(...buffered);
                byGroup!.delete(peerHex);
            }
        }

        pc.onicecandidate = (event) => {
            if (!session.iceTrickleEnabled) return;
            if (!event.candidate || !this.senders) return;
            const c = event.candidate;
            const quad = this.groupAuthoritativeQuad;
            if (!quad) return;
            void this.tryCall(() =>
                this.senders!.sendIceCandidate(
                    peerNpub,
                    callId,
                    c.candidate,
                    c.sdpMid,
                    c.sdpMLineIndex,
                    {
                        group: {
                            groupCallId: quad.groupCallId,
                            conversationId: quad.conversationId,
                            initiatorHex: quad.initiatorHex
                        }
                    }
                )
            );
        };

        pc.ontrack = (event) => {
            session.remoteStream =
                event.streams[0] ?? new MediaStream([event.track]);
        };

        pc.oniceconnectionstatechange = () => {
            const iceState = pc.iceConnectionState;
            if (iceState === 'connected' || iceState === 'completed') {
                session.iceTrickleEnabled = false;
                if (session.iceTimeoutId) {
                    clearTimeout(session.iceTimeoutId);
                    session.iceTimeoutId = null;
                }
                if (session.offerTimeoutId) {
                    clearTimeout(session.offerTimeoutId);
                    session.offerTimeoutId = null;
                }
                setGroupParticipantStatus(peerHex, 'active');
                this.maybeStartGroupDurationTimer();
            } else if (iceState === 'failed' || iceState === 'disconnected') {
                this.handleGroupIceFailure(peerHex);
            }
        };

        session.iceTimeoutId = setTimeout(() => {
            const iceState = session.pc.iceConnectionState;
            if (iceState !== 'connected' && iceState !== 'completed') {
                this.handleGroupIceFailure(peerHex);
            }
        }, ICE_CONNECTION_TIMEOUT_MS);
    }

    /** Arm the per-pair offer-without-answer timeout for a group edge. */
    private armGroupOfferTimeout(peerHex: string): void {
        const session = this.groupPeerConnections.get(peerHex);
        if (!session) {
            // No PC yet (invite-only outgoing edge); arm a synthetic
            // timeout that just marks the participant ended on expiry.
            const t = setTimeout(() => {
                const groupState = get(groupVoiceCallState);
                const ps = groupState.participants[peerHex];
                if (ps && ps.pcStatus === 'ringing') {
                    setGroupParticipantStatus(peerHex, 'ended', 'timeout');
                }
                this.maybeFinalizeGroupCallEnd();
            }, CALL_OFFER_TIMEOUT_MS);
            // Stash on a temporary holder under the peer; if a session
            // gets created later (unlikely for invite-only), the new
            // offer-timeout there supersedes this one.
            this.groupInviteOnlyTimeouts.set(peerHex, t);
            return;
        }
        if (session.offerTimeoutId) clearTimeout(session.offerTimeoutId);
        session.offerTimeoutId = setTimeout(() => {
            const groupState = get(groupVoiceCallState);
            const ps = groupState.participants[peerHex];
            if (ps && (ps.pcStatus === 'ringing' || ps.pcStatus === 'pending')) {
                setGroupParticipantStatus(peerHex, 'ended', 'timeout');
                this.tearDownGroupPeer(peerHex);
            }
            this.maybeFinalizeGroupCallEnd();
        }, CALL_OFFER_TIMEOUT_MS);
    }

    /**
     * Synthetic timeouts for invite-only outgoing edges (no
     * RTCPeerConnection exists locally — the recipient is the offerer
     * for that pair, so we wait for THEIR kind-25050).
     */
    private groupInviteOnlyTimeouts: Map<
        string,
        ReturnType<typeof setTimeout>
    > = new Map();

    /**
     * Per-pair ICE failure on a group edge. Tears down only that one
     * PC; the rest of the mesh continues.
     */
    private handleGroupIceFailure(peerHex: string): void {
        const groupState = get(groupVoiceCallState);
        const ps = groupState.participants[peerHex];
        if (!ps || ps.pcStatus === 'ended') return;
        setGroupParticipantStatus(peerHex, 'ended', 'ice-failed');
        this.tearDownGroupPeer(peerHex);
        this.maybeFinalizeGroupCallEnd();
    }

    /**
     * Close and remove a single peer connection from the mesh, clearing
     * its timeouts. Does NOT touch the local stream or other peers.
     */
    private tearDownGroupPeer(peerHex: string): void {
        const session = this.groupPeerConnections.get(peerHex);
        if (!session) return;
        if (session.offerTimeoutId) {
            clearTimeout(session.offerTimeoutId);
            session.offerTimeoutId = null;
        }
        if (session.iceTimeoutId) {
            clearTimeout(session.iceTimeoutId);
            session.iceTimeoutId = null;
        }
        try {
            session.pc.close();
        } catch (_) {
            /* ignore */
        }
        session.remoteStream = null;
        this.groupPeerConnections.delete(peerHex);

        const inviteT = this.groupInviteOnlyTimeouts.get(peerHex);
        if (inviteT) {
            clearTimeout(inviteT);
            this.groupInviteOnlyTimeouts.delete(peerHex);
        }
    }

    /**
     * Last-one-standing finalizer. If every other roster member's
     * pcStatus is `ended` and the local aggregate has not already been
     * forced to `ended`, transition to `ended` with the appropriate
     * reason and author the right call-history rumor.
     */
    private maybeFinalizeGroupCallEnd(): void {
        const groupState = get(groupVoiceCallState);
        if (
            groupState.groupCallId === null ||
            groupState.status === 'ended' ||
            !this.groupAuthoritativeQuad
        )
            return;

        const entries = Object.values(groupState.participants);
        if (entries.length === 0) return;
        const allEnded = entries.every((p) => p.pcStatus === 'ended');
        if (!allEnded) return;

        const quad = this.groupAuthoritativeQuad;
        const wasActive = groupState.status === 'active';
        const wasOutgoingRinging = groupState.status === 'outgoing-ringing';
        const wasIncomingRinging = groupState.status === 'incoming-ringing';
        const duration = groupState.duration;
        const wasInitiator = this.groupIsInitiator;
        const otherRosterHex = quad.roster.filter(
            (h) => h !== this.groupSelfHex
        );
        const otherNpubs = otherRosterHex.map((h) => nip19.npubEncode(h));
        const initiatorNpub = nip19.npubEncode(quad.initiatorHex);

        this.cleanupGroup();
        endGroupCall('hangup');

        if (wasActive) {
            void this.createGroupCallEvent(
                'ended',
                duration,
                quad.conversationId,
                otherNpubs,
                quad.groupCallId,
                initiatorNpub
            );
        } else if (wasOutgoingRinging && wasInitiator) {
            // Caller saw nobody answer.
            void this.createGroupCallEvent(
                'no-answer',
                undefined,
                quad.conversationId,
                otherNpubs,
                quad.groupCallId,
                initiatorNpub
            );
        } else if (wasIncomingRinging) {
            // Callee never accepted before all offers ended.
            void this.createLocalGroupCallEvent(
                'missed',
                quad.conversationId,
                quad.groupCallId,
                quad.initiatorHex
            );
        }
    }

    private maybeStartGroupDurationTimer(): void {
        if (this.groupDurationStarted) return;
        this.groupDurationStarted = true;
        this.groupDurationIntervalId = setInterval(() => {
            incrementGroupDuration();
        }, 1000);
    }

    /**
     * Flush per-session ICE buffer for one group peer after
     * setRemoteDescription resolves.
     */
    private async flushGroupPerSessionIce(peerHex: string): Promise<void> {
        const session = this.groupPeerConnections.get(peerHex);
        if (!session) return;
        session.sessionRemoteDescriptionSet = true;
        const pending = session.sessionPendingIce;
        session.sessionPendingIce = [];
        for (const init of pending) {
            try {
                await session.pc.addIceCandidate(new RTCIceCandidate(init));
            } catch (err) {
                console.warn(
                    '[VoiceCall] flushGroupPerSessionIce failed',
                    err
                );
            }
        }
    }

    /**
     * Group dispatch for a verified NIP-AC inner event whose
     * `group-call-id` tag is present. Self-event filtering and stale /
     * dedup checks have already run upstream; signature has been
     * verified.
     */
    private async handleGroupNipAcEvent(
        inner: NostrEvent,
        groupCallId: string
    ): Promise<void> {
        switch (inner.kind) {
            case NIP_AC_KIND_OFFER:
                await this.handleGroupOffer(inner, groupCallId);
                break;
            case NIP_AC_KIND_ANSWER:
                await this.handleGroupAnswer(inner, groupCallId);
                break;
            case NIP_AC_KIND_ICE:
                await this.handleGroupIceCandidate(inner, groupCallId);
                break;
            case NIP_AC_KIND_HANGUP:
                await this.handleGroupHangup(inner, groupCallId);
                break;
            case NIP_AC_KIND_REJECT:
                this.handleGroupReject(inner, groupCallId);
                break;
            case NIP_AC_KIND_RENEGOTIATE:
                console.warn(
                    '[VoiceCall][Recv] kind-25055 with group-call-id is not supported in v1; dropping'
                );
                break;
            default:
                console.warn(
                    '[VoiceCall][Recv] unsupported group inner kind',
                    inner.kind
                );
        }
    }

    /**
     * Inbound kind-25050 for a group call. Handles the spec's
     * follow-gate, authoritative-quadruple validation, busy rejection
     * for different-group concurrent calls, and either ringing-time
     * buffering OR mesh-formation dispatch depending on the local
     * group status.
     */
    private async handleGroupOffer(
        inner: NostrEvent,
        groupCallId: string
    ): Promise<void> {
        const senderHex = inner.pubkey.toLowerCase();
        const senderNpub = nip19.npubEncode(senderHex);
        const callId = this.getTagValue(inner, 'call-id');
        const conversationId = this.getTagValue(inner, CONVERSATION_ID_TAG);
        const initiatorHex = this.getTagValue(inner, INITIATOR_TAG)?.toLowerCase();
        const callType = this.getTagValue(inner, 'call-type') ?? 'voice';
        if (!callId || !conversationId || !initiatorHex) {
            console.warn(
                '[VoiceCall][Recv] group offer missing required tags; dropping'
            );
            return;
        }
        if (callType === 'video') {
            console.warn(
                '[VoiceCall][Recv] group video offer not supported in v1; dropping'
            );
            return;
        }
        const participantsTag = inner.tags.find(
            (t) => t[0] === PARTICIPANTS_TAG
        );
        if (!participantsTag || participantsTag.length < 3) {
            console.warn(
                '[VoiceCall][Recv] group offer missing participants tag; dropping'
            );
            return;
        }
        const wireRoster = participantsTag
            .slice(1)
            .map((h) => h.toLowerCase());
        if (wireRoster.length > GROUP_CALL_MAX_PARTICIPANTS) {
            console.warn(
                '[VoiceCall][Recv] group offer roster exceeds cap; dropping'
            );
            return;
        }

        // Group follow-gate: local DB must have this conversation,
        // local user must be a member, sender must be a member, wire
        // roster must equal local roster (set equality).
        const conv = await conversationRepo.getConversation(conversationId);
        if (!conv || !conv.isGroup) {
            console.warn(
                '[VoiceCall][Recv] group offer: unknown conversation; dropping'
            );
            return;
        }
        const selfNpub = get(currentUser)?.npub;
        if (!selfNpub) {
            console.warn(
                '[VoiceCall][Recv] group offer: no current user; dropping'
            );
            return;
        }
        const selfHex = (
            nip19.decode(selfNpub).data as string
        ).toLowerCase();
        if (!conv.participants.includes(selfNpub)) {
            console.warn(
                '[VoiceCall][Recv] group offer: local user not in conversation; dropping'
            );
            return;
        }
        // Build local hex roster set.
        const localRoster = conv.participants.map(
            (np) => (nip19.decode(np).data as string).toLowerCase()
        );
        const localSet = new Set(localRoster);
        if (!localSet.has(senderHex)) {
            console.warn(
                '[VoiceCall][Recv] group offer: sender not in local roster; dropping'
            );
            return;
        }
        // Set-equality of wire roster vs local roster.
        const wireSet = new Set(wireRoster);
        if (
            wireSet.size !== localSet.size ||
            [...wireSet].some((h) => !localSet.has(h))
        ) {
            console.warn(
                '[VoiceCall][Recv] group offer: roster set mismatch; dropping'
            );
            return;
        }
        if (!wireSet.has(selfHex)) {
            console.warn(
                '[VoiceCall][Recv] group offer: local user not in wire roster; dropping'
            );
            return;
        }

        // Concurrency: if we're in any other call, busy-reject.
        const oneToOneStatus = get(voiceCallState).status;
        const groupStatus = get(groupVoiceCallState).status;
        const inOtherCall =
            (oneToOneStatus !== 'idle' && oneToOneStatus !== 'ended') ||
            (this.currentGroupCallId !== null &&
                this.currentGroupCallId !== groupCallId);
        if (inOtherCall) {
            if (this.senders) {
                await this.tryCall(() =>
                    this.senders!.sendReject(senderNpub, callId, 'busy', {
                        group: { groupCallId, conversationId, initiatorHex }
                    })
                );
            }
            return;
        }

        // Authoritative-quadruple validation. First-arrival wins; any
        // later disagreement → drop.
        if (this.groupAuthoritativeQuad === null) {
            this.groupAuthoritativeQuad = {
                groupCallId,
                initiatorHex,
                conversationId,
                roster: [...wireRoster].sort()
            };
            this.groupSelfHex = selfHex;
            this.groupConversationId = conversationId;
            this.currentGroupCallId = groupCallId;
            this.groupIsInitiator = senderHex === selfHex; // false in receive path
        } else if (
            this.groupAuthoritativeQuad.groupCallId === groupCallId &&
            (this.groupAuthoritativeQuad.initiatorHex !== initiatorHex ||
                this.groupAuthoritativeQuad.conversationId !== conversationId)
        ) {
            console.warn(
                '[VoiceCall][Recv] group offer: tuple disagreement; dropping'
            );
            return;
        }

        // Branch on local group status.
        if (groupStatus === 'idle' || groupStatus === 'ended') {
            // First inbound offer for a new ringing session.
            this.groupPendingOffers.set(senderHex, inner);
            const seedRole: 'offerer' | 'answerer' =
                inner.content === '' ? 'offerer' : 'answerer';
            setGroupIncomingRinging(
                groupCallId,
                conversationId,
                initiatorHex,
                this.groupAuthoritativeQuad!.roster,
                {
                    pubkeyHex: senderHex,
                    callId,
                    role: seedRole,
                    pcStatus: 'ringing'
                }
            );
            return;
        }

        if (groupStatus === 'incoming-ringing') {
            // Buffer additional offers for the same call.
            if (this.groupPendingOffers.has(senderHex)) return; // dup
            this.groupPendingOffers.set(senderHex, inner);
            upsertGroupParticipant(senderHex, {
                callId,
                role: inner.content === '' ? 'offerer' : 'answerer',
                pcStatus: 'ringing'
            });
            return;
        }

        // Mesh formation: we're already in connecting/active for this
        // group. Apply the offer immediately.
        const isInvite =
            inner.tags.some(
                (t) => t[0] === ROLE_TAG && t[1] === ROLE_INVITE
            ) || inner.content === '';

        if (isInvite) {
            // We are the offerer for this edge. Build PC, send real-SDP
            // offer back.
            if (!this.groupLocalStream) return;
            const ourCallId = this.generateCallId();
            this.createGroupPeerConnection(senderHex, senderNpub, ourCallId);
            const session = this.groupPeerConnections.get(senderHex)!;
            this.groupLocalStream.getAudioTracks().forEach((t) => {
                session.pc.addTrack(t, this.groupLocalStream!);
            });
            try {
                const offer = await session.pc.createOffer();
                await session.pc.setLocalDescription(offer);
                if (this.senders && offer.sdp) {
                    await this.tryCall(() =>
                        this.senders!.sendOffer(
                            senderNpub,
                            ourCallId,
                            offer.sdp!,
                            {
                                callType: 'voice',
                                group: {
                                    groupCallId,
                                    conversationId,
                                    initiatorHex,
                                    participants: this.groupAuthoritativeQuad!.roster,
                                    roleInvite: false
                                }
                            }
                        )
                    );
                }
                upsertGroupParticipant(senderHex, {
                    callId: ourCallId,
                    role: 'offerer',
                    pcStatus: 'ringing'
                });
                this.armGroupOfferTimeout(senderHex);
            } catch (err) {
                console.error(
                    '[VoiceCall] mesh-formation invite-back offer failed',
                    err
                );
            }
        } else {
            // Real-SDP mesh-formation offer. We are the answerer.
            if (!this.groupLocalStream) return;
            this.createGroupPeerConnection(senderHex, senderNpub, callId);
            const session = this.groupPeerConnections.get(senderHex)!;
            this.groupLocalStream.getAudioTracks().forEach((t) => {
                session.pc.addTrack(t, this.groupLocalStream!);
            });
            try {
                await session.pc.setRemoteDescription(
                    new RTCSessionDescription({
                        type: 'offer',
                        sdp: inner.content
                    })
                );
                await this.flushGroupPerSessionIce(senderHex);
                const answer = await session.pc.createAnswer();
                await session.pc.setLocalDescription(answer);
                if (this.senders && answer.sdp) {
                    await this.tryCall(() =>
                        this.senders!.sendAnswer(
                            senderNpub,
                            callId,
                            answer.sdp!,
                            {
                                group: {
                                    groupCallId,
                                    conversationId,
                                    initiatorHex
                                }
                            }
                        )
                    );
                }
                upsertGroupParticipant(senderHex, {
                    callId,
                    role: 'answerer',
                    pcStatus: 'connecting'
                });
            } catch (err) {
                console.error(
                    '[VoiceCall] mesh-formation answer build failed',
                    err
                );
            }
        }
    }

    private async handleGroupAnswer(
        inner: NostrEvent,
        groupCallId: string
    ): Promise<void> {
        if (!this.groupValidateContext(inner, groupCallId)) return;
        const senderHex = inner.pubkey.toLowerCase();
        const session = this.groupPeerConnections.get(senderHex);
        if (!session) {
            console.warn(
                '[VoiceCall][Recv] group answer: no PC for sender; dropping'
            );
            return;
        }
        const callId = this.getTagValue(inner, 'call-id');
        if (!callId || callId !== session.callId) {
            console.warn(
                '[VoiceCall][Recv] group answer: call-id mismatch; dropping'
            );
            return;
        }
        try {
            await session.pc.setRemoteDescription(
                new RTCSessionDescription({
                    type: 'answer',
                    sdp: inner.content
                })
            );
            await this.flushGroupPerSessionIce(senderHex);
            setGroupParticipantStatus(senderHex, 'connecting');
            if (session.offerTimeoutId) {
                clearTimeout(session.offerTimeoutId);
                session.offerTimeoutId = null;
            }
        } catch (err) {
            console.error('[VoiceCall][Recv] group answer apply failed', err);
        }
    }

    private async handleGroupIceCandidate(
        inner: NostrEvent,
        groupCallId: string
    ): Promise<void> {
        if (!this.groupValidateContext(inner, groupCallId)) return;
        let payload: {
            candidate: string;
            sdpMid: string | null;
            sdpMLineIndex: number | null;
        };
        try {
            payload = JSON.parse(inner.content);
        } catch (err) {
            console.warn(
                '[VoiceCall][Recv] group ICE: malformed JSON content',
                err
            );
            return;
        }
        const init: RTCIceCandidateInit = {
            candidate: payload.candidate,
            sdpMid: payload.sdpMid ?? undefined,
            sdpMLineIndex: payload.sdpMLineIndex ?? undefined
        };
        const senderHex = inner.pubkey.toLowerCase();
        const session = this.groupPeerConnections.get(senderHex);
        if (!session) {
            // Buffer globally keyed by (groupCallId, senderHex).
            let byGroup = this.groupGlobalIceBuffer.get(groupCallId);
            if (!byGroup) {
                byGroup = new Map();
                this.groupGlobalIceBuffer.set(groupCallId, byGroup);
            }
            const list = byGroup.get(senderHex) ?? [];
            list.push(init);
            byGroup.set(senderHex, list);
            return;
        }
        if (!session.sessionRemoteDescriptionSet) {
            session.sessionPendingIce.push(init);
            return;
        }
        try {
            await session.pc.addIceCandidate(new RTCIceCandidate(init));
        } catch (err) {
            console.warn('[VoiceCall][Recv] group addIceCandidate failed', err);
        }
    }

    private async handleGroupHangup(
        inner: NostrEvent,
        groupCallId: string
    ): Promise<void> {
        if (!this.groupValidateContext(inner, groupCallId)) return;
        const senderHex = inner.pubkey.toLowerCase();
        const callId = this.getTagValue(inner, 'call-id');
        const session = this.groupPeerConnections.get(senderHex);
        if (!session || !callId || callId !== session.callId) {
            // No matching live PC; just mark the participant ended in
            // case the entry exists from the pending-offers buffer.
            setGroupParticipantStatus(senderHex, 'ended', 'hangup');
            this.groupPendingOffers.delete(senderHex);
            this.maybeFinalizeGroupCallEnd();
            return;
        }
        setGroupParticipantStatus(senderHex, 'ended', 'hangup');
        this.tearDownGroupPeer(senderHex);
        this.maybeFinalizeGroupCallEnd();
    }

    private handleGroupReject(inner: NostrEvent, groupCallId: string): void {
        if (!this.groupValidateContext(inner, groupCallId)) return;
        const senderHex = inner.pubkey.toLowerCase();
        const reason = inner.content;
        const endReason: VoiceCallEndReason =
            reason === 'busy' ? 'busy' : 'rejected';
        setGroupParticipantStatus(senderHex, 'ended', endReason);
        this.tearDownGroupPeer(senderHex);
        this.groupPendingOffers.delete(senderHex);
        this.maybeFinalizeGroupCallEnd();
    }

    /**
     * Verify that an inbound non-offer group inner event is consistent
     * with the cached authoritative quadruple. Returns false (and logs
     * a warning) on any mismatch — callers should drop on false.
     */
    private groupValidateContext(
        inner: NostrEvent,
        groupCallId: string
    ): boolean {
        const quad = this.groupAuthoritativeQuad;
        if (!quad || quad.groupCallId !== groupCallId) {
            console.warn(
                '[VoiceCall][Recv] group event: no active session matching group-call-id; dropping'
            );
            return false;
        }
        const wireInitiator = this.getTagValue(inner, INITIATOR_TAG)?.toLowerCase();
        const wireConversation = this.getTagValue(inner, CONVERSATION_ID_TAG);
        if (
            !wireInitiator ||
            wireInitiator !== quad.initiatorHex ||
            !wireConversation ||
            wireConversation !== quad.conversationId
        ) {
            console.warn(
                '[VoiceCall][Recv] group event: tuple disagreement; dropping'
            );
            return false;
        }
        const senderHex = inner.pubkey.toLowerCase();
        if (!quad.roster.includes(senderHex)) {
            console.warn(
                '[VoiceCall][Recv] group event: sender not in cached roster; dropping'
            );
            return false;
        }
        return true;
    }

    /** Author a group Kind-1405 call-history event (relay-published). */
    private async createGroupCallEvent(
        type: AuthoredCallEventType,
        duration: number | undefined,
        conversationId: string,
        participantNpubs: string[],
        groupCallId: string,
        initiatorNpub: string
    ): Promise<void> {
        if (!this.createGroupCallEventFn) return;
        try {
            await this.createGroupCallEventFn(
                conversationId,
                participantNpubs,
                type,
                groupCallId,
                initiatorNpub,
                duration,
                'voice'
            );
        } catch (err) {
            console.error(
                '[VoiceCall] Failed to create group call event:',
                err
            );
        }
    }

    /** Author a group Kind-1405 call-history event (local-only). */
    private async createLocalGroupCallEvent(
        type: AuthoredCallEventType,
        conversationId: string,
        groupCallId: string,
        initiatorHex: string
    ): Promise<void> {
        if (!this.createLocalGroupCallEventFn) return;
        const quad = this.groupAuthoritativeQuad;
        const otherNpubs =
            quad?.roster
                .filter((h) => h !== this.groupSelfHex)
                .map((h) => nip19.npubEncode(h)) ?? [];
        const initiatorNpub = nip19.npubEncode(initiatorHex);
        try {
            await this.createLocalGroupCallEventFn(
                conversationId,
                otherNpubs,
                type,
                groupCallId,
                initiatorNpub,
                'voice'
            );
        } catch (err) {
            console.error(
                '[VoiceCall] Failed to create local group call event:',
                err
            );
        }
    }

    /** Tear down all group-call resources. Mirrors the 1-on-1 `cleanup`. */
    private cleanupGroup(): void {
        for (const [peerHex, session] of this.groupPeerConnections) {
            if (session.offerTimeoutId) clearTimeout(session.offerTimeoutId);
            if (session.iceTimeoutId) clearTimeout(session.iceTimeoutId);
            try {
                session.pc.close();
            } catch (_) {
                /* ignore */
            }
            void peerHex;
        }
        this.groupPeerConnections.clear();

        for (const [, t] of this.groupInviteOnlyTimeouts) {
            clearTimeout(t);
        }
        this.groupInviteOnlyTimeouts.clear();

        this.groupPendingOffers.clear();
        this.groupGlobalIceBuffer.clear();
        this.groupAuthoritativeQuad = null;
        this.groupIsInitiator = false;
        this.groupSelfHex = null;
        this.groupConversationId = null;
        this.currentGroupCallId = null;

        if (this.groupDurationIntervalId) {
            clearInterval(this.groupDurationIntervalId);
            this.groupDurationIntervalId = null;
        }
        this.groupDurationStarted = false;

        if (this.groupLocalStream) {
            this.groupLocalStream.getTracks().forEach((t) => t.stop());
            this.groupLocalStream = null;
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
