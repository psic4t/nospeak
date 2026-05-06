import type { NostrEvent } from 'nostr-tools';
import type {
    NIP_AC_KIND_OFFER,
    NIP_AC_KIND_ANSWER,
    NIP_AC_KIND_ICE,
    NIP_AC_KIND_HANGUP,
    NIP_AC_KIND_REJECT,
    NIP_AC_KIND_RENEGOTIATE
} from './constants';

/**
 * Media kind of a call. Fixed for the lifetime of a single call —
 * mid-call upgrade from voice to video is NOT supported in the current
 * implementation.
 */
export type CallKind = 'voice' | 'video';

/**
 * Optional group-call context attached to any NIP-AC inner signaling
 * event. When `groupCallId` is present, the event is part of a group
 * call (full-mesh, anchored to a group {@code Conversation}); when
 * absent, the event belongs to a 1-on-1 call. Receivers branch strictly
 * on `groupCallId` presence — there is no other discriminator.
 *
 * The `participants` and `roleInvite` fields are meaningful only on
 * kind-25050 (Call Offer); on other inner kinds they SHALL be
 * undefined. See
 * `openspec/changes/add-group-voice-calling/specs/voice-calling/spec.md`
 * for the authoritative wire-format requirements.
 */
export interface GroupCallContext {
    /** 32-byte hex identifier of the group call. */
    groupCallId: string;
    /** 16-character hex id of the local anchor group {@code Conversation}. */
    conversationId: string;
    /** Hex pubkey of the call initiator. Authoritative across the call. */
    initiatorHex: string;
    /**
     * Full roster of participant hex pubkeys (including the initiator)
     * in canonical sort order. Present only on kind-25050.
     */
    participants?: string[];
    /**
     * `true` when the kind-25050 offer is invite-only (empty SDP, the
     * recipient is the designated SDP offerer for the pair). Present
     * only on kind-25050.
     */
    roleInvite?: boolean;
}

/**
 * Parsed NIP-AC inner signaling event, discriminated by `kind`. Built by
 * the receive path from a verified inner event, or by the send path
 * before signing/wrapping.
 *
 * Every variant carries an optional `group` field. When present, the
 * event is part of a group voice call; when absent, it is a 1-on-1
 * call. Inner kind-25055 (Renegotiate) is voice-only and SHALL NOT
 * carry a group context — see the closed-roster decision in the group
 * design doc.
 */
export type VoiceCallSignal =
    | {
          kind: typeof NIP_AC_KIND_OFFER;
          callId: string;
          callType: CallKind;
          /** Raw SDP offer string. Empty when {@code group?.roleInvite === true}. */
          sdp: string;
          group?: GroupCallContext;
      }
    | {
          kind: typeof NIP_AC_KIND_ANSWER;
          callId: string;
          /** Raw SDP answer string. */
          sdp: string;
          group?: GroupCallContext;
      }
    | {
          kind: typeof NIP_AC_KIND_ICE;
          callId: string;
          candidate: string;
          sdpMid: string | null;
          sdpMLineIndex: number | null;
          group?: GroupCallContext;
      }
    | {
          kind: typeof NIP_AC_KIND_HANGUP;
          callId: string;
          /** Optional human-readable reason. */
          reason?: string;
          group?: GroupCallContext;
      }
    | {
          kind: typeof NIP_AC_KIND_REJECT;
          callId: string;
          /** `'busy'` for auto-reject from a non-idle state, otherwise optional reason. */
          reason?: string;
          group?: GroupCallContext;
      }
    | {
          kind: typeof NIP_AC_KIND_RENEGOTIATE;
          callId: string;
          /** Raw SDP offer string for a mid-call media change. */
          sdp: string;
      };

export type VoiceCallStatus =
    | 'idle'
    | 'outgoing-ringing'
    | 'incoming-ringing'
    | 'connecting'
    | 'active'
    | 'ended';

/**
 * Reason the call ended. `answered-elsewhere` and `rejected-elsewhere`
 * are NIP-AC multi-device signals: another device of the same user
 * accepted/rejected the call while this device was still ringing.
 */
export type VoiceCallEndReason =
    | 'hangup'
    | 'rejected'
    | 'busy'
    | 'timeout'
    | 'ice-failed'
    | 'error'
    | 'answered-elsewhere'
    | 'rejected-elsewhere';

/**
 * State of any in-flight NIP-AC kind-25055 (Call Renegotiate)
 * exchange. Mid-call SDP changes never alter the call's `status` —
 * `connecting` / `active` is preserved — but they do alter what the
 * "Add video" button is allowed to do, and tests need a stable handle
 * on the lifecycle. Resets to `'idle'` on every call-status reset
 * and on every successful or failed renegotiation completion.
 *
 * - `'idle'`: no renegotiation in flight.
 * - `'outgoing'`: we sent a kind 25055 and are awaiting the peer's
 *   matching kind 25051.
 * - `'incoming'`: we are processing a kind 25055 received from the
 *   peer (or have just dispatched its kind-25051 answer).
 * - `'glare'`: transient on the *winning* side of glare resolution
 *   (we kept our outgoing offer; the loser is rolling back).
 */
export type RenegotiationState = 'idle' | 'outgoing' | 'incoming' | 'glare';

export interface VoiceCallState {
    status: VoiceCallStatus;
    peerNpub: string | null;
    callId: string | null;
    duration: number;
    isMuted: boolean;
    isSpeakerOn: boolean;
    endReason: VoiceCallEndReason | null;
    /**
     * Media kind of the active or last call. Defaults to `'voice'` when
     * idle. Fixed for the lifetime of a single call.
     */
    callKind: CallKind;
    /** Whether the local video track is currently disabled (video calls only). */
    isCameraOff: boolean;
    /** True while a front/back camera swap is in flight. */
    isCameraFlipping: boolean;
    /** Currently active camera facing mode. Meaningful only on video calls. */
    facingMode: 'user' | 'environment';
    /**
     * State of any in-flight NIP-AC kind-25055 renegotiation. See
     * {@link RenegotiationState}. Always `'idle'` while the call's
     * `status` is `'idle'` or `'ended'`.
     */
    renegotiationState: RenegotiationState;
}

/**
 * Persisted call-event types authored on terminal call transitions. Mirrors
 * the union in {@code Messaging.createCallEventMessage} and the renderer in
 * {@code CallEventMessage.svelte}. Legacy values 'outgoing'/'incoming' are
 * NOT in this set — new code SHALL NOT author them.
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
 * Implemented by Messaging.createCallEventMessage — gift-wraps the rumor
 * to the peer and self-wraps for the sender.
 */
export type CallEventCreator = (
    recipientNpub: string,
    type: AuthoredCallEventType,
    duration?: number,
    callId?: string,
    initiatorNpub?: string,
    callMediaType?: CallKind
) => Promise<void>;

/**
 * Authoring callback for call-event types that are LOCAL-ONLY (`missed`,
 * `cancelled`). Implemented by Messaging.createLocalCallEventMessage —
 * saves to the local DB without any relay publish.
 */
export type LocalCallEventCreator = (
    recipientNpub: string,
    type: AuthoredCallEventType,
    callId?: string,
    initiatorNpub?: string,
    callMediaType?: CallKind
) => Promise<void>;

/**
 * Authoring callback for GROUP call-history rumors that should appear
 * in every participant's chat history (`ended`, `no-answer`,
 * `declined`, `busy`, `failed`). Implemented by
 * {@code Messaging.createGroupCallEventMessage}. Publishes one Kind
 * 1405 rumor through the existing 3-layer NIP-17 group pipeline
 * (multi-recipient + self-wrap), distinct from the NIP-AC kind-21059
 * signaling pipeline.
 *
 * @param conversationId Local 16-character hex id of the anchor group
 *     conversation.
 * @param participantNpubs Other roster members (excluding self).
 * @param type Authored call-event type.
 * @param groupCallId 32-byte hex group-call id (correlation tag).
 * @param initiatorNpub Initiator's npub.
 * @param duration Optional duration in seconds for {@code 'ended'}.
 * @param callMediaType Always {@code 'voice'} in v1.
 */
export type GroupCallEventCreator = (
    conversationId: string,
    participantNpubs: string[],
    type: AuthoredCallEventType,
    groupCallId: string,
    initiatorNpub: string,
    duration?: number,
    callMediaType?: CallKind
) => Promise<void>;

/**
 * LOCAL-ONLY group call-history authoring callback. Used for
 * {@code 'missed'} (no answer locally) and {@code 'cancelled'}
 * (initiator hung up before any peer connected). Persists a Kind 1405
 * rumor directly to the local message database with no relay publish.
 */
export type LocalGroupCallEventCreator = (
    conversationId: string,
    participantNpubs: string[],
    type: AuthoredCallEventType,
    groupCallId: string,
    initiatorNpub: string,
    callMediaType?: CallKind
) => Promise<void>;

/**
 * Typed NIP-AC senders registered by {@code Messaging.ts}. One per
 * inner-event kind. Each helper signs the inner event with the user's
 * signer, wraps it in a kind-21059 ephemeral gift wrap, and publishes
 * to connected relays. {@code sendAnswer} and {@code sendReject}
 * additionally publish a self-wrap for multi-device "answered/rejected
 * elsewhere".
 */
/**
 * Common group-call context option block that may be passed to any
 * NIP-AC sender below. When present, the sender SHALL emit the four
 * group tags (`group-call-id`, `conversation-id`, `initiator`,
 * plus `participants` on kind-25050) on the inner event in the order
 * fixed by the wire-parity fixture.
 *
 * The {@code roleInvite} flag is meaningful only on kind-25050. When
 * `true`, the sender emits an additional `['role','invite']` tag and
 * the SDP {@code content} SHALL be empty.
 */
export interface NipAcGroupSendContext {
    groupCallId: string;
    conversationId: string;
    initiatorHex: string;
    /** Required on kind-25050; ignored on other kinds. */
    participants?: string[];
    /** Meaningful only on kind-25050. */
    roleInvite?: boolean;
}

export interface NipAcSenders {
    sendOffer: (
        recipientNpub: string,
        callId: string,
        sdp: string,
        opts?: { callType?: CallKind; group?: NipAcGroupSendContext }
    ) => Promise<void>;
    sendAnswer: (
        recipientNpub: string,
        callId: string,
        sdp: string,
        opts?: { group?: NipAcGroupSendContext }
    ) => Promise<void>;
    sendIceCandidate: (
        recipientNpub: string,
        callId: string,
        candidate: string,
        sdpMid: string | null,
        sdpMLineIndex: number | null,
        opts?: { group?: NipAcGroupSendContext }
    ) => Promise<void>;
    sendHangup: (
        recipientNpub: string,
        callId: string,
        reason?: string,
        opts?: { group?: NipAcGroupSendContext }
    ) => Promise<void>;
    sendReject: (
        recipientNpub: string,
        callId: string,
        reason?: string,
        opts?: { group?: NipAcGroupSendContext }
    ) => Promise<void>;
    /**
     * Publish a kind-25055 Call Renegotiate. Wire shape mirrors the
     * Call Offer (kind 25050) helper EXCEPT no `call-type` tag is
     * attached and no self-wrap is published. The peer responds with
     * an ordinary kind-25051 Call Answer.
     *
     * Group calls do NOT renegotiate in v1 (mid-call media-kind change
     * is only defined for 1-on-1 voice→video upgrade); this sender
     * therefore does NOT accept a group context.
     */
    sendRenegotiate: (recipientNpub: string, callId: string, sdp: string) => Promise<void>;
}

/**
 * Public surface of a voice-call backend implementation. Two
 * implementations exist:
 *
 * <ul>
 *   <li>{@link VoiceCallServiceWeb} — JavaScript {@code RTCPeerConnection}
 *       + Messaging.ts NIP-AC senders. Used on web/PWA.</li>
 *   <li>{@code VoiceCallServiceNative} — thin proxy that forwards calls
 *       to the {@code AndroidVoiceCall} Capacitor plugin and mirrors
 *       native call state into the existing {@code voiceCallState}
 *       Svelte store. Used on Android.</li>
 * </ul>
 *
 * UI components consume a single {@code voiceCallService} reference and
 * the same {@code voiceCallState} store on both platforms; no platform
 * branching at the call site.
 */
export interface VoiceCallBackend {
    /** Register the JS-side NIP-AC senders (web only — native impl ignores). */
    registerNipAcSenders(senders: NipAcSenders): void;

    /** Register the gift-wrapped call-history rumor author (web only). */
    registerCallEventCreator(fn: CallEventCreator): void;

    /** Register the local-only call-history rumor author (web only). */
    registerLocalCallEventCreator(fn: LocalCallEventCreator): void;

    /**
     * Register the gift-wrapped GROUP call-history rumor author. May be
     * registered as a no-op if the platform does not support group
     * calls in this build.
     */
    registerGroupCallEventCreator?(fn: GroupCallEventCreator): void;

    /** Register the local-only GROUP call-history rumor author. */
    registerLocalGroupCallEventCreator?(fn: LocalGroupCallEventCreator): void;

    /** Generate a fresh callId. Used by Messaging when authoring local rumors. */
    generateCallId(): string;

    /**
     * Initiate an outgoing GROUP voice call anchored to an existing
     * group conversation (16-character hex `conversationId`).
     * Voice-only in v1. Resolves once initial offers have been sent.
     */
    initiateGroupCall?(conversationId: string): Promise<void>;

    /** Accept the in-progress incoming group call. */
    acceptGroupCall?(): Promise<void>;

    /** Decline the in-progress incoming group call. */
    declineGroupCall?(): void;

    /**
     * Hang up / leave the active group call. Remaining participants
     * stay connected to each other.
     */
    hangupGroupCall?(): void;

    /** Toggle local microphone mute across all peers in the group mesh. */
    toggleGroupMute?(): void;

    /**
     * Snapshot of remote {@code MediaStream}s for the active group
     * call, keyed by peer hex pubkey. UI components bind one hidden
     * {@code <audio>} per entry so the browser mixes audio across all
     * peers automatically. Native backends return an empty map (the
     * native AudioDeviceModule routes audio out-of-band).
     */
    getGroupRemoteStreams?(): Map<string, MediaStream>;

    /**
     * Initiate an outgoing call to {@code recipientNpub}. The optional
     * {@code kind} parameter selects voice (default) or video. Resolves
     * once the offer has been sent (or the attempt has been aborted).
     */
    initiateCall(recipientNpub: string, kind?: CallKind): Promise<void>;

    /**
     * Dispatch a verified NIP-AC inner event from Messaging's receive
     * path. Web only — on Android with native voice calling enabled,
     * Messaging.ts is expected to skip dispatching to this method
     * entirely.
     */
    handleNipAcEvent(inner: NostrEvent): Promise<void>;

    /**
     * NIP-AC self-event handler for kind-25051 (answer) seen during
     * incoming-ringing — multi-device "answered elsewhere".
     */
    handleSelfAnswer(inner: NostrEvent): Promise<void>;

    /**
     * NIP-AC self-event handler for kind-25054 (reject) seen during
     * incoming-ringing — multi-device "rejected elsewhere".
     */
    handleSelfReject(inner: NostrEvent): Promise<void>;

    /** Accept the in-progress incoming call. */
    acceptCall(): Promise<void>;

    /** Decline the in-progress incoming call. */
    declineCall(): void;

    /** Hang up the active or in-progress call. */
    hangup(): void;

    /** Toggle local microphone mute. */
    toggleMute(): void;

    /**
     * Toggle speakerphone routing. No-op in {@link VoiceCallServiceWeb}
     * (browsers do not expose a speakerphone switch); meaningful only
     * in the native Android implementation, which calls
     * {@code AudioManager.setSpeakerphoneOn}.
     */
    toggleSpeaker?(): void;

    /**
     * Returns the active remote {@code MediaStream} for binding to a
     * hidden {@code <audio>} element on web. Returns {@code null} on the
     * native implementation, which routes remote audio through the
     * native {@code AudioDeviceModule} directly.
     */
    getRemoteStream(): MediaStream | null;

    /**
     * Returns the kind of the active or most recently active call.
     * Returns {@code 'voice'} when idle.
     */
    getCallKind(): CallKind;

    /**
     * Returns the local capture {@code MediaStream} for binding to a
     * picture-in-picture self-view {@code <video>} element on web.
     * Returns {@code null} on the native implementation, which renders
     * the local self-view via a native {@code SurfaceViewRenderer}
     * subscribed directly to the local {@code VideoTrack}.
     */
    getLocalStream(): MediaStream | null;

    /**
     * Toggles the local video track's {@code enabled} flag. No-op on
     * voice calls. Does NOT renegotiate SDP, remove the track, or stop
     * the camera capturer; the peer simply receives black/empty frames
     * while the camera is off.
     */
    toggleCamera(): Promise<void>;

    /**
     * Switches between the front-facing and back-facing camera during
     * an active video call. No-op on voice calls. On web this performs
     * a {@code getUserMedia} + {@code RTCRtpSender.replaceTrack}; on
     * Android this calls {@code CameraVideoCapturer.switchCamera}. Does
     * NOT renegotiate SDP.
     */
    flipCamera(): Promise<void>;

    /**
     * Whether the local video track is currently disabled. Always
     * {@code false} on voice calls.
     */
    isCameraOff(): boolean;

    /**
     * User-facing entry point for the voice→video mid-call upgrade.
     * Acquires camera permission, attaches a local video track to the
     * existing peer connection, creates a new SDP offer, and publishes
     * it as kind 25055 (Call Renegotiate). The peer responds with a
     * kind-25051 Call Answer; on receipt the local {@code callKind}
     * flips to {@code 'video'}.
     *
     * Guarded — callers MAY invoke this freely; the implementation
     * silently no-ops when the call is not eligible
     * ({@code status !== 'active'}, {@code callKind !== 'voice'}, or
     * {@code renegotiationState !== 'idle'}).
     */
    requestVideoUpgrade(): Promise<void>;

    /**
     * Returns the current renegotiation state. Used by UI gating and
     * by tests. Always {@code 'idle'} on a backend that has no active
     * call.
     */
    getRenegotiationState(): RenegotiationState;
}

/* ------------------------------------------------------------------ *
 * Group voice-call state types                                       *
 * ------------------------------------------------------------------ */

/**
 * Per-pair PeerConnection lifecycle status inside a group call. Each
 * other roster member has exactly one {@link ParticipantState} entry
 * with a {@code pcStatus} value drawn from this union; the per-call
 * aggregate {@link VoiceCallStatus} is *derived* from the participants
 * map (see the spec's "Group Voice Call Lifecycle" requirement) and
 * SHALL NOT be stored independently.
 *
 * <ul>
 *   <li>{@code 'pending'} — no signaling yet exchanged with this peer
 *       (e.g., we are an accepter and have not yet sent our
 *       mesh-formation offer to a lex-higher peer).</li>
 *   <li>{@code 'ringing'} — an offer has been sent or received but the
 *       peer's answer has not arrived.</li>
 *   <li>{@code 'connecting'} — answer exchanged, ICE establishment in
 *       progress.</li>
 *   <li>{@code 'active'} — peer connection is up; remote audio is
 *       flowing.</li>
 *   <li>{@code 'ended'} — peer connection closed (hangup, timeout,
 *       ice-failed, rejected, etc.).</li>
 * </ul>
 */
export type ParticipantPcStatus =
    | 'pending'
    | 'ringing'
    | 'connecting'
    | 'active'
    | 'ended';

/**
 * Role of the local user with respect to one edge in a group call's
 * full mesh, computed from the deterministic-pair offerer rule (the
 * participant with the lex-lower lowercase-hex pubkey is the offerer
 * for the pair). Stored per-participant so the state machine can pick
 * the right send/receive branch without re-running the lex compare.
 */
export type ParticipantRole = 'offerer' | 'answerer';

/**
 * State of a single edge in a group call's full mesh. One entry per
 * other roster member, keyed by their hex pubkey in the
 * {@link GroupVoiceCallState.participants} map.
 */
export interface ParticipantState {
    /** Other participant's hex pubkey. */
    pubkeyHex: string;
    /** Per-pair UUID `call-id` for this edge (distinct from `groupCallId`). */
    callId: string;
    /** Local user's role on this edge (see {@link ParticipantRole}). */
    role: ParticipantRole;
    /** Per-pair PeerConnection lifecycle status. */
    pcStatus: ParticipantPcStatus;
    /** End reason once {@code pcStatus === 'ended'}; null otherwise. */
    endReason: VoiceCallEndReason | null;
}

/**
 * State of a group voice call, parallel to the existing flat
 * {@link VoiceCallState} for 1-on-1. UI components branch on
 * {@code groupCallId !== null} to choose between the two stores. The
 * "one call total" invariant guarantees that at most one of
 * {@code voiceCallState} or {@code groupVoiceCallState} is non-idle at
 * any moment.
 *
 * The aggregate {@code status} is derived from the participants map
 * and is recomputed by the state-machine reducer on every change; it
 * is held in the store only so subscribers can read it without
 * duplicating the derivation logic.
 */
export interface GroupVoiceCallState {
    /** 32-byte hex group-call id; null while idle. */
    groupCallId: string | null;
    /** 16-character hex anchor conversation id; null while idle. */
    conversationId: string | null;
    /** Initiator's hex pubkey; null while idle. */
    initiatorHex: string | null;
    /**
     * Full roster of participant hex pubkeys (including the local
     * user) in canonical sort order. Authoritative; cached from the
     * first kind-25050 received for this {@code groupCallId}.
     */
    roster: string[];
    /**
     * Per-other-roster-member edge state, keyed by peer hex pubkey.
     * Does NOT contain an entry for the local user.
     */
    participants: Record<string, ParticipantState>;
    /** Aggregate per-call status, derived from {@code participants}. */
    status: VoiceCallStatus;
    /** Aggregate end reason once {@code status === 'ended'}; null otherwise. */
    endReason: VoiceCallEndReason | null;
    /** Seconds since the first per-participant {@code pcStatus} reached {@code 'active'}. */
    duration: number;
    /** Local microphone mute state (shared across all peer connections). */
    isMuted: boolean;
    /** Local speakerphone state (Android-meaningful, web no-op). */
    isSpeakerOn: boolean;
    /**
     * Media kind of the call. Fixed to {@code 'voice'} in v1 — group
     * video calls are deferred to a follow-up change.
     */
    callKind: CallKind;
}
