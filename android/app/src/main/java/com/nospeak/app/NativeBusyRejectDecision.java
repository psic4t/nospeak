package com.nospeak.app;

/**
 * Pure-Java decision policy for the native NIP-AC busy auto-reject.
 * Part of the {@code fix-android-nip-ac-compliance-gaps} OpenSpec
 * change.
 *
 * <p>NIP-AC §"Busy Rejection" says: <em>"If a client receives a Call
 * Offer while already in an active call (any state other than Idle),
 * it SHOULD automatically send a CallReject (kind 25054) with content
 * 'busy' and remain in the current call."</em>
 *
 * <p>On Android, when the WebView is dead, the JS path's busy
 * detection cannot run; the native messaging service must make this
 * decision instead. This class encapsulates the decision so it can be
 * unit-tested without instantiating
 * {@link NativeBackgroundMessagingService} or any Android framework
 * machinery — same precedent as {@link CallHistoryDecision}.
 *
 * <p>The decision is also responsible for distinguishing a
 * <em>duplicate</em> offer (same call-id as the active call — must be
 * silently ignored per the existing
 * {@code voice-calling/spec.md:328-332} requirement) from a
 * <em>concurrent</em> offer (different call-id — must be auto-rejected
 * with {@code "busy"}).
 */
public final class NativeBusyRejectDecision {

    /** What the messaging service should do with the inbound offer. */
    public enum Action {
        /**
         * No active call (or manager is idle/ended). Fall through to
         * the normal follow-gate / FSI ringer path.
         */
        NORMAL_FLOW,
        /**
         * The inbound offer's call-id matches the active call's
         * call-id — this is a duplicate redelivery, silently drop.
         */
        IGNORE_DUPLICATE,
        /**
         * Different call-id, manager is busy — send a kind-25054
         * Call Reject with {@code content="busy"} and self-wrap.
         */
        AUTO_REJECT_BUSY
    }

    private NativeBusyRejectDecision() {}

    /**
     * Decide what to do with an inbound kind-25050 Call Offer.
     *
     * @param managerCallId   {@code NativeVoiceCallManager.getCallId()},
     *                        or {@code null} if no manager exists.
     * @param managerIsBusy   {@code NativeVoiceCallManager.isBusy()},
     *                        or {@code false} if no manager exists.
     * @param incomingCallId  the {@code call-id} tag value from the
     *                        inbound inner event. MUST be non-null —
     *                        callers should drop the offer earlier if
     *                        the tag is absent.
     */
    public static Action decide(
            String managerCallId,
            boolean managerIsBusy,
            String incomingCallId) {
        if (incomingCallId == null || incomingCallId.isEmpty()) {
            // Defensive: callers already drop tag-less offers, but keep
            // the helper safe for unit tests that pass nulls.
            return Action.NORMAL_FLOW;
        }
        if (!managerIsBusy) {
            // No active call — let the inbound offer proceed to the
            // follow-gate / FSI ringer / persisted-prefs path.
            return Action.NORMAL_FLOW;
        }
        if (managerCallId != null && managerCallId.equals(incomingCallId)) {
            // Duplicate redelivery of the same offer — silently drop.
            return Action.IGNORE_DUPLICATE;
        }
        // Concurrent offer for a different call — busy auto-reject.
        return Action.AUTO_REJECT_BUSY;
    }
}
