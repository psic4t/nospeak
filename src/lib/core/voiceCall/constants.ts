export const CALL_OFFER_TIMEOUT_MS = 60_000;
export const ICE_CONNECTION_TIMEOUT_MS = 30_000;
export const CALL_SIGNAL_TYPE = 'voice-call' as const;
export const CALL_END_DISPLAY_MS = 2_000;
/**
 * NIP-17 sealed-rumor kind for persistent call-history events
 * (`ended`, `missed`, `declined`, `no-answer`, `busy`, `failed`,
 * `cancelled`).
 *
 * Selected as an unassigned regular-range kind adjacent to NIP-17's
 * kinds 14 (chat) and 15 (file message), reflecting that call-history
 * rumors share the same persistence semantics as other NIP-17 sealed
 * rumors. Kind 16 (NIP-18 "Generic Repost") MUST NOT be used; it has
 * unrelated public semantics and was the previous, incorrect choice.
 */
export const CALL_HISTORY_KIND = 1405;
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
