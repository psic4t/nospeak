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
 * Parsed NIP-AC inner signaling event, discriminated by `kind`. Built by
 * the receive path from a verified inner event, or by the send path
 * before signing/wrapping.
 */
export type VoiceCallSignal =
    | {
          kind: typeof NIP_AC_KIND_OFFER;
          callId: string;
          callType: CallKind;
          /** Raw SDP offer string. */
          sdp: string;
      }
    | {
          kind: typeof NIP_AC_KIND_ANSWER;
          callId: string;
          /** Raw SDP answer string. */
          sdp: string;
      }
    | {
          kind: typeof NIP_AC_KIND_ICE;
          callId: string;
          candidate: string;
          sdpMid: string | null;
          sdpMLineIndex: number | null;
      }
    | {
          kind: typeof NIP_AC_KIND_HANGUP;
          callId: string;
          /** Optional human-readable reason. */
          reason?: string;
      }
    | {
          kind: typeof NIP_AC_KIND_REJECT;
          callId: string;
          /** `'busy'` for auto-reject from a non-idle state, otherwise optional reason. */
          reason?: string;
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
 * Typed NIP-AC senders registered by {@code Messaging.ts}. One per
 * inner-event kind. Each helper signs the inner event with the user's
 * signer, wraps it in a kind-21059 ephemeral gift wrap, and publishes
 * to connected relays. {@code sendAnswer} and {@code sendReject}
 * additionally publish a self-wrap for multi-device "answered/rejected
 * elsewhere".
 */
export interface NipAcSenders {
    sendOffer: (
        recipientNpub: string,
        callId: string,
        sdp: string,
        opts?: { callType?: CallKind }
    ) => Promise<void>;
    sendAnswer: (recipientNpub: string, callId: string, sdp: string) => Promise<void>;
    sendIceCandidate: (
        recipientNpub: string,
        callId: string,
        candidate: string,
        sdpMid: string | null,
        sdpMLineIndex: number | null
    ) => Promise<void>;
    sendHangup: (recipientNpub: string, callId: string, reason?: string) => Promise<void>;
    sendReject: (recipientNpub: string, callId: string, reason?: string) => Promise<void>;
    /**
     * Publish a kind-25055 Call Renegotiate. Wire shape mirrors the
     * Call Offer (kind 25050) helper EXCEPT no `call-type` tag is
     * attached and no self-wrap is published. The peer responds with
     * an ordinary kind-25051 Call Answer.
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

    /** Generate a fresh callId. Used by Messaging when authoring local rumors. */
    generateCallId(): string;

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
