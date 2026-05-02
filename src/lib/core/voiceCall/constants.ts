export const CALL_OFFER_TIMEOUT_MS = 60_000;
export const ICE_CONNECTION_TIMEOUT_MS = 30_000;
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
 * NIP-AC ephemeral gift-wrap kind. Per NIP-AC the kind range
 * 20000-29999 conveys ephemerality to relays. The ephemeral wrap has no
 * NIP-13 seal layer; the inner signaling event is signed by the sender's
 * real key and the wrap itself is signed by a fresh ephemeral key.
 */
export const NIP_AC_GIFT_WRAP_KIND = 21059;

/**
 * NIP-AC inner-event kinds. These are the kinds carried inside a kind
 * 21059 wrap. Each is signed by the sender's real key.
 */
export const NIP_AC_KIND_OFFER = 25050;
export const NIP_AC_KIND_ANSWER = 25051;
export const NIP_AC_KIND_ICE = 25052;
export const NIP_AC_KIND_HANGUP = 25053;
export const NIP_AC_KIND_REJECT = 25054;
/**
 * NIP-AC kind 25055 — Call Renegotiate. Sent during an active call to
 * change media (e.g., voice→video upgrade). Wire shape mirrors a kind
 * 25050 Call Offer EXCEPT it carries no `call-type` tag (the original
 * 25050 already established the call type) and is NOT self-wrapped.
 * The recipient responds with an ordinary kind 25051 Call Answer.
 */
export const NIP_AC_KIND_RENEGOTIATE = 25055;

/**
 * Outgoing-renegotiation timeout. If we publish a kind-25055 and the
 * matching kind-25051 answer does not arrive within this many
 * milliseconds, we roll back the local offer, remove the just-attached
 * media artifacts, and resume the underlying call as it was.
 */
export const RENEGOTIATION_TIMEOUT_MS = 30_000;

/**
 * Receive-path staleness window for NIP-AC inner signaling events.
 * Inner events whose `created_at` is more than this many seconds before
 * the current Unix time are dropped silently. This protects against
 * uncooperative relays that persist ephemeral events past their
 * usefulness.
 *
 * Set to 60s to match `CALL_OFFER_TIMEOUT_MS` rather than NIP-AC's draft
 * 20s default — community feedback on the NIP-AC PR notes 20s is too
 * aggressive for cold-start scenarios. Revisit if upstream consensus
 * settles on a different value.
 */
export const NIP_AC_STALENESS_SECONDS = 60;

/**
 * Capacity of the receive-path processed-event-ID dedup buffer. NIP-AC
 * mandates clients drop duplicate signaling events delivered by multiple
 * relays. A 256-entry FIFO Set is sized for typical session traffic
 * (~5 events per call × tens of calls per session).
 */
export const NIP_AC_PROCESSED_ID_CAPACITY = 256;

export const AUDIO_CONSTRAINTS: MediaStreamConstraints = {
    audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
    },
    video: false
};

/**
 * Media constraints for video calls. Audio constraints match
 * {@link AUDIO_CONSTRAINTS}. Video resolution targets a conservative
 * VGA (640×480) at 30 fps to keep CPU/battery/bandwidth low on mobile;
 * WebRTC's congestion control will scale further down on bad networks.
 * Initial facing mode is the front (user-facing) camera.
 */
export const VIDEO_MEDIA_CONSTRAINTS: MediaStreamConstraints = {
    audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
    },
    video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        frameRate: { ideal: 30, max: 30 },
        facingMode: 'user'
    }
};
