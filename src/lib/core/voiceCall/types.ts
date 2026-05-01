import type { NostrEvent } from 'nostr-tools';
import type {
    NIP_AC_KIND_OFFER,
    NIP_AC_KIND_ANSWER,
    NIP_AC_KIND_ICE,
    NIP_AC_KIND_HANGUP,
    NIP_AC_KIND_REJECT
} from './constants';

/**
 * Parsed NIP-AC inner signaling event, discriminated by `kind`. Built by
 * the receive path from a verified inner event, or by the send path
 * before signing/wrapping.
 */
export type VoiceCallSignal =
    | {
          kind: typeof NIP_AC_KIND_OFFER;
          callId: string;
          callType: 'voice';
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

export interface VoiceCallState {
    status: VoiceCallStatus;
    peerNpub: string | null;
    callId: string | null;
    duration: number;
    isMuted: boolean;
    isSpeakerOn: boolean;
    endReason: VoiceCallEndReason | null;
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
    initiatorNpub?: string
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
    initiatorNpub?: string
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
    sendOffer: (recipientNpub: string, callId: string, sdp: string) => Promise<void>;
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
     * Initiate an outgoing call to {@code recipientNpub}. Resolves once
     * the offer has been sent (or the attempt has been aborted).
     */
    initiateCall(recipientNpub: string): Promise<void>;

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
}
