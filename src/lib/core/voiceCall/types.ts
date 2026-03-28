export interface VoiceCallSignal {
    type: 'voice-call';
    action: 'offer' | 'answer' | 'ice-candidate' | 'hangup' | 'reject' | 'busy';
    callId: string;
    sdp?: string;
    candidate?: RTCIceCandidateInit;
}

export type VoiceCallStatus =
    | 'idle'
    | 'outgoing-ringing'
    | 'incoming-ringing'
    | 'connecting'
    | 'active'
    | 'ended';

export type VoiceCallEndReason =
    | 'hangup'
    | 'rejected'
    | 'busy'
    | 'timeout'
    | 'ice-failed'
    | 'error';

export interface VoiceCallState {
    status: VoiceCallStatus;
    peerNpub: string | null;
    callId: string | null;
    duration: number;
    isMuted: boolean;
    isSpeakerOn: boolean;
    endReason: VoiceCallEndReason | null;
}
