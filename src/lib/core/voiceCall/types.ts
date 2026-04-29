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
