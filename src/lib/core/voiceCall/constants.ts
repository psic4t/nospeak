export const CALL_OFFER_TIMEOUT_MS = 60_000;
export const ICE_CONNECTION_TIMEOUT_MS = 30_000;
export const CALL_SIGNAL_TYPE = 'voice-call' as const;
export const CALL_END_DISPLAY_MS = 2_000;
export const AUDIO_CONSTRAINTS: MediaStreamConstraints = {
    audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
    },
    video: false
};
