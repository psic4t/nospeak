export const CALL_OFFER_TIMEOUT_MS = 60_000;
export const ICE_CONNECTION_TIMEOUT_MS = 30_000;
export const CALL_SIGNAL_TYPE = 'voice-call' as const;
export const CALL_END_DISPLAY_MS = 2_000;
/**
 * NIP-40 expiration window for voice-call signaling gift wraps.
 * Sized to match CALL_OFFER_TIMEOUT_MS — past 60s the call attempt has
 * timed out anyway, so any lingering signal is useless. Cooperating relays
 * SHOULD drop expired events; receivers also drop them defensively.
 */
export const CALL_SIGNAL_EXPIRATION_SECONDS = 60;
export const AUDIO_CONSTRAINTS: MediaStreamConstraints = {
    audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
    },
    video: false
};
