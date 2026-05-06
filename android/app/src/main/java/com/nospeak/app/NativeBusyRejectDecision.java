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
        AUTO_REJECT_BUSY,
        /**
         * Inbound offer carries the SAME {@code group-call-id} as the
         * active group call. Per the
         * {@code add-group-voice-calling} spec, this is mesh formation
         * (an accepter offering to another roster member), not a
         * concurrent call — DO NOT busy-reject. The caller should
         * route the offer through the normal group dispatch path.
         */
        MESH_FORMATION
    }

    private NativeBusyRejectDecision() {}

    /**
     * Legacy 1-on-1 decision entry point. Preserved for callers that
     * have not yet been generalized to pass group context.
     *
     * @param managerCallId   {@code NativeVoiceCallManager.getCallId()},
     *                        or {@code null} if no manager exists.
     * @param managerIsBusy   {@code NativeVoiceCallManager.isBusy()},
     *                        or {@code false} if no manager exists.
     * @param incomingCallId  the {@code call-id} tag value from the
     *                        inbound inner event.
     */
    public static Action decide(
            String managerCallId,
            boolean managerIsBusy,
            String incomingCallId) {
        return decide(managerCallId, null, managerIsBusy, incomingCallId, null);
    }

    /**
     * Group-aware decision. Captures the spec rule that an inbound
     * kind-25050 carrying the same {@code group-call-id} as the active
     * group call is mesh formation (accept-and-dispatch), while a
     * different {@code group-call-id} (or any 1-on-1 inbound while we
     * are in a group call, or vice versa) is a concurrent call and
     * SHALL be busy-rejected.
     *
     * <p>The matrix:
     * <pre>
     *   manager idle/ended (busy=false)                    → NORMAL_FLOW
     *   manager busy in 1-on-1 call:
     *     incoming has groupCallId                         → AUTO_REJECT_BUSY
     *     incoming callId == manager callId                → IGNORE_DUPLICATE
     *     otherwise                                        → AUTO_REJECT_BUSY
     *   manager busy in group call (managerGroupCallId set):
     *     incoming groupCallId == manager groupCallId      → MESH_FORMATION
     *     otherwise                                        → AUTO_REJECT_BUSY
     * </pre>
     *
     * @param managerCallId         active call's per-pair call-id, or null
     * @param managerGroupCallId    active call's group-call-id, or null
     *                              when the active call is 1-on-1
     * @param managerIsBusy         {@code NativeVoiceCallManager.isBusy()}
     * @param incomingCallId        per-pair call-id from the inbound offer
     * @param incomingGroupCallId   group-call-id from the inbound offer,
     *                              or null when inbound is a 1-on-1 offer
     */
    public static Action decide(
            String managerCallId,
            String managerGroupCallId,
            boolean managerIsBusy,
            String incomingCallId,
            String incomingGroupCallId) {
        if (incomingCallId == null || incomingCallId.isEmpty()) {
            // Defensive: callers already drop tag-less offers, but keep
            // the helper safe for unit tests that pass nulls.
            return Action.NORMAL_FLOW;
        }
        if (!managerIsBusy) {
            // No active call — let the inbound offer proceed to the
            // normal dispatch / follow-gate / FSI ringer path.
            return Action.NORMAL_FLOW;
        }
        // Manager IS busy. Branch on whether we are currently in a
        // group call vs a 1-on-1 call.
        if (managerGroupCallId != null && !managerGroupCallId.isEmpty()) {
            // Active group call. Same group-call-id → mesh formation.
            if (incomingGroupCallId != null
                    && managerGroupCallId.equals(incomingGroupCallId)) {
                return Action.MESH_FORMATION;
            }
            // Different group-call-id, OR a 1-on-1 offer (no group-call-id):
            // concurrent call → busy.
            return Action.AUTO_REJECT_BUSY;
        }
        // Active 1-on-1 call.
        if (incomingGroupCallId != null && !incomingGroupCallId.isEmpty()) {
            // Group offer arriving while we hold a 1-on-1 → busy.
            return Action.AUTO_REJECT_BUSY;
        }
        if (managerCallId != null && managerCallId.equals(incomingCallId)) {
            // Duplicate redelivery of the same 1-on-1 offer — silently drop.
            return Action.IGNORE_DUPLICATE;
        }
        // Concurrent 1-on-1 offer for a different call — busy auto-reject.
        return Action.AUTO_REJECT_BUSY;
    }
}
