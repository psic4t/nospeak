package com.nospeak.app;

import java.util.Objects;

/**
 * Pure-data record describing what call-history rumor (if any) should
 * be authored when a voice call ends. Phase 4 of the
 * {@code add-native-voice-calls} OpenSpec change — extracted from
 * {@link NativeVoiceCallManager#authorHistoryEvent} as a static
 * function so the safety-critical decision tree can be unit-tested
 * without dragging in Android framework dependencies.
 *
 * <p>The decision is computed once per call termination and translated
 * by {@code NativeVoiceCallManager} into either:
 * <ul>
 *   <li>A native gift-wrapped publish via the {@code MessagingBridge}
 *       (for the {@link Kind#GIFT_WRAP} variants), OR</li>
 *   <li>A {@code callHistoryWriteRequested} plugin event so the JS
 *       layer can persist a local-only DB row (for the
 *       {@link Kind#LOCAL_ONLY} variants), OR</li>
 *   <li>{@link Kind#NONE} — nothing to author (e.g. the rejected case
 *       where the OTHER side has already authored a 'declined'
 *       rumor that will reach us via gift-wrap).</li>
 * </ul>
 */
public final class CallHistoryDecision {

    /** Whether to publish a gift-wrap, write locally, or do nothing. */
    public enum Kind {
        /** Publish a NIP-17 gift-wrapped kind-1405 rumor to BOTH peers. */
        GIFT_WRAP,
        /**
         * Persist a local-only kind-1405 row in the local message DB.
         * No relay publish, no gift-wrap.
         */
        LOCAL_ONLY,
        /** No history rumor for this call termination. */
        NONE
    }

    public final Kind kind;
    /** Call-event-type tag value. {@code null} when {@link #kind} == NONE. */
    public final String type;
    /**
     * For {@link Kind#GIFT_WRAP}: pubkey of the original WebRTC call
     * initiator. May be {@code null} to indicate "the local user is the
     * initiator" — the native sender then defaults to
     * {@code currentPubkeyHex}.
     *
     * <p>For {@link Kind#LOCAL_ONLY}: the JS bridge's
     * {@code initiatorHex} payload field. {@code null} when the local
     * user is the initiator.
     */
    public final String initiatorHex;
    /**
     * Call duration in seconds. {@code -1} means no duration tag should
     * be emitted (only the {@code 'ended'} type carries a duration).
     */
    public final int durationSec;

    private static final CallHistoryDecision NONE = new CallHistoryDecision(
        Kind.NONE, null, null, -1);

    public static CallHistoryDecision none() { return NONE; }

    public static CallHistoryDecision giftWrap(
            String type, int durationSec, String initiatorHex) {
        return new CallHistoryDecision(Kind.GIFT_WRAP, type, initiatorHex, durationSec);
    }

    public static CallHistoryDecision localOnly(String type, String initiatorHex) {
        return new CallHistoryDecision(Kind.LOCAL_ONLY, type, initiatorHex, -1);
    }

    private CallHistoryDecision(Kind kind, String type, String initiatorHex, int durationSec) {
        this.kind = kind;
        this.type = type;
        this.initiatorHex = initiatorHex;
        this.durationSec = durationSec;
    }

    /**
     * Decide what call-history event (if any) to author given the call
     * state at the moment of termination. The mapping mirrors the JS
     * {@code VoiceCallService} authoring decisions and the
     * {@code voice-calling} spec's "Call History via Kind 1405 Events"
     * requirement.
     *
     * <p>Inputs come from {@code NativeVoiceCallManager}'s state at
     * the moment {@code finishCall} runs.
     *
     * @param prevStatus     the call status BEFORE the transition to ENDED
     * @param reason         end-reason string (hangup / timeout / ice-failed
     *                       / rejected / busy / error / answered-elsewhere
     *                       / rejected-elsewhere)
     * @param isInitiator    true iff the local user started this call
     * @param peerHex        remote peer's pubkey hex
     * @param durationSec    call duration in seconds (only meaningful when
     *                       prevStatus == ACTIVE)
     */
    public static CallHistoryDecision decide(
            NativeVoiceCallManager.CallStatus prevStatus,
            String reason,
            boolean isInitiator,
            String peerHex,
            int durationSec) {
        if (prevStatus == null || peerHex == null) return NONE;
        // initiator hex: caller for caller-authored events; for ended
        // events, the peer is the initiator iff we are NOT the initiator.
        // Leaving as null means "default to local user" in the bridge.
        String initiatorHex = isInitiator ? null : peerHex;

        if (prevStatus == NativeVoiceCallManager.CallStatus.ACTIVE
                && "hangup".equals(reason)) {
            // 'ended': gift-wrapped to both peers, includes duration.
            return giftWrap("ended", durationSec, initiatorHex);
        }
        if (prevStatus == NativeVoiceCallManager.CallStatus.OUTGOING_RINGING
                && "hangup".equals(reason)) {
            // 'cancelled': caller-local-only.
            return localOnly("cancelled", /* initiatorHex= */ null);
        }
        if (prevStatus == NativeVoiceCallManager.CallStatus.INCOMING_RINGING
                && "hangup".equals(reason)) {
            // 'missed': callee-local-only. The PEER is the initiator.
            return localOnly("missed", peerHex);
        }
        if ("timeout".equals(reason)) {
            if (isInitiator) {
                // 'no-answer': caller-side gift-wrapped.
                return giftWrap("no-answer", -1, /* initiatorHex= */ null);
            }
            return NONE;
        }
        if ("ice-failed".equals(reason)) {
            if (isInitiator) {
                // 'failed': caller-side gift-wrapped.
                return giftWrap("failed", -1, /* initiatorHex= */ null);
            }
            return NONE;
        }
        if ("busy".equals(reason) && isInitiator) {
            // 'busy': caller-side gift-wrapped.
            return giftWrap("busy", -1, /* initiatorHex= */ null);
        }
        // 'rejected' is authored by the callee in decline() (which
        // calls sendVoiceCallReject + emits a 'declined' rumor); the
        // caller's 'rejected' transition therefore needs no rumor —
        // the gift-wrapped 'declined' from the callee will reach the
        // caller via NIP-17 self-wrap. Same for answered-elsewhere /
        // rejected-elsewhere / error.
        return NONE;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof CallHistoryDecision)) return false;
        CallHistoryDecision that = (CallHistoryDecision) o;
        return durationSec == that.durationSec
            && kind == that.kind
            && Objects.equals(type, that.type)
            && Objects.equals(initiatorHex, that.initiatorHex);
    }

    @Override
    public int hashCode() {
        return Objects.hash(kind, type, initiatorHex, durationSec);
    }

    @Override
    public String toString() {
        return "CallHistoryDecision{kind=" + kind
            + ", type='" + type + '\''
            + ", initiatorHex='" + initiatorHex + '\''
            + ", durationSec=" + durationSec + '}';
    }
}
