package com.nospeak.app;

/**
 * Pure-Java decision policy for the native NIP-AC self-event filter.
 * Part of the {@code fix-android-nip-ac-compliance-gaps} OpenSpec
 * change.
 *
 * <p>NIP-AC §"Multi-Device Support" requires that when another device
 * of the same user accepts or rejects an incoming call, the local
 * device must dismiss its ringing UI so the user isn't bothered by a
 * call that has already been handled. The web build implements this
 * via the JS {@code Messaging.handleNipAcWrap} self-event filter
 * (lines 446-471). On Android, when the WebView is dead, the native
 * {@code NativeBackgroundMessagingService} must enforce the same
 * rule against the lockscreen FSI ringer and any active
 * {@link NativeVoiceCallManager} in {@code INCOMING_RINGING}.
 *
 * <p>This class encapsulates the kind-aware decision matrix so it
 * can be unit-tested without instantiating the messaging service —
 * same precedent as {@link CallHistoryDecision} and
 * {@link NativeBusyRejectDecision}.
 *
 * <h3>Decision matrix</h3>
 * <pre>
 *   kind 25050 (offer)        → DROP        (degenerate self-call echo)
 *   kind 25052 (ICE)          → DROP        (always; per NIP-AC self-filter)
 *   kind 25053 (hangup)       → DROP        (always; we already handled locally)
 *   kind 25055 (renegotiate)  → DROP        (always; mid-call only, our own send)
 *   kind 25051 (answer):
 *     - manager active &amp; status=INCOMING_RINGING &amp; matching call-id
 *         → END_MANAGER_ANSWERED
 *     - else if pending FSI prefs hold matching call-id
 *         → DISMISS_FSI
 *     - else
 *         → DROP
 *   kind 25054 (reject):
 *     - manager active &amp; status=INCOMING_RINGING &amp; matching call-id
 *         → END_MANAGER_REJECTED
 *     - else if pending FSI prefs hold matching call-id
 *         → DISMISS_FSI
 *     - else
 *         → DROP
 * </pre>
 */
public final class NativeSelfDismissDecision {

    /** What the receiver should do with this self-authored event. */
    public enum Action {
        /** Drop silently — no state change, no UI change. */
        DROP,
        /**
         * Cancel the lockscreen FSI notification and clear the
         * {@code nospeak_pending_incoming_call} SharedPreferences slot
         * via {@code handleRemoteCallCancellation(callId)}.
         */
        DISMISS_FSI,
        /**
         * End the {@link NativeVoiceCallManager} with reason
         * {@code "answered-elsewhere"} (and dismiss the FSI idempotently).
         */
        END_MANAGER_ANSWERED,
        /**
         * End the {@link NativeVoiceCallManager} with reason
         * {@code "rejected-elsewhere"} (and dismiss the FSI idempotently).
         */
        END_MANAGER_REJECTED
    }

    private NativeSelfDismissDecision() {}

    /**
     * Legacy 1-on-1 entry point. Preserved for callers that have not
     * yet been generalized to pass group context.
     */
    public static Action decide(
            int innerKind,
            String innerCallId,
            String pendingPrefsCallId,
            String managerCallId,
            String managerStatusName) {
        return decide(
            innerKind,
            innerCallId,
            null,
            pendingPrefsCallId,
            null,
            managerCallId,
            null,
            managerStatusName);
    }

    /**
     * Group-aware decision. Generalizes the matrix so kind-25051 and
     * kind-25054 self-events with a {@code group-call-id} are
     * dismissed against the active group call's
     * {@code group-call-id} (per the spec's modified self-event filter)
     * rather than the per-pair {@code call-id}. Per-pair {@code call-id}
     * dedup is preserved for 1-on-1 self-events (no
     * {@code group-call-id} on the inner event).
     *
     * @param innerKind                inner event kind (25050–25055)
     * @param innerCallId              the {@code call-id} tag value, may be null
     * @param innerGroupCallId         the {@code group-call-id} tag value,
     *                                 may be null for 1-on-1
     * @param pendingPrefsCallId       call-id stored in the FSI pending
     *                                 SharedPreferences slot, or null
     * @param pendingPrefsGroupCallId  group-call-id stored in the FSI
     *                                 pending SharedPreferences slot, or
     *                                 null when the pending entry is 1-on-1
     * @param managerCallId            active manager's per-pair call-id
     * @param managerGroupCallId       active manager's group-call-id, or
     *                                 null when the active call is 1-on-1
     * @param managerStatusName        active manager's
     *                                 {@code CallStatus#name()}; compared
     *                                 as {@code "INCOMING_RINGING"}
     */
    public static Action decide(
            int innerKind,
            String innerCallId,
            String innerGroupCallId,
            String pendingPrefsCallId,
            String pendingPrefsGroupCallId,
            String managerCallId,
            String managerGroupCallId,
            String managerStatusName) {

        // Kinds that are unconditionally dropped from self per the
        // NIP-AC self-event filter (matches the JS Messaging.ts
        // implementation; 25050 self-call degenerate case is also
        // dropped here).
        if (innerKind != 25051 && innerKind != 25054) {
            return Action.DROP;
        }

        boolean isGroup = innerGroupCallId != null && !innerGroupCallId.isEmpty();

        // For 1-on-1 self-events, dedup by per-pair call-id (existing
        // behavior). For group self-events, dedup by group-call-id —
        // call-id may differ between sender's per-pair edge and our
        // own inbound edge inside the same group call.
        if (!isGroup) {
            if (innerCallId == null || innerCallId.isEmpty()) {
                return Action.DROP;
            }
            boolean managerRingingForCall =
                managerCallId != null
                    && managerCallId.equals(innerCallId)
                    && managerGroupCallId == null
                    && "INCOMING_RINGING".equals(managerStatusName);
            if (managerRingingForCall) {
                return innerKind == 25051
                    ? Action.END_MANAGER_ANSWERED
                    : Action.END_MANAGER_REJECTED;
            }
            if (pendingPrefsCallId != null
                    && pendingPrefsCallId.equals(innerCallId)
                    && (pendingPrefsGroupCallId == null
                        || pendingPrefsGroupCallId.isEmpty())) {
                return Action.DISMISS_FSI;
            }
            return Action.DROP;
        }

        // Group self-event branch.
        boolean managerRingingForGroup =
            managerGroupCallId != null
                && managerGroupCallId.equals(innerGroupCallId)
                && "INCOMING_RINGING".equals(managerStatusName);
        if (managerRingingForGroup) {
            return innerKind == 25051
                ? Action.END_MANAGER_ANSWERED
                : Action.END_MANAGER_REJECTED;
        }
        if (pendingPrefsGroupCallId != null
                && pendingPrefsGroupCallId.equals(innerGroupCallId)) {
            return Action.DISMISS_FSI;
        }
        return Action.DROP;
    }
}
