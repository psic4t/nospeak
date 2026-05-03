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
     * Decide what to do with a self-authored NIP-AC inner event.
     *
     * @param innerKind            the inner event kind (25050–25055)
     * @param innerCallId          the {@code call-id} tag value, may be null
     * @param pendingPrefsCallId   the call-id stored in
     *                             {@code nospeak_pending_incoming_call}
     *                             SharedPreferences, or null
     * @param managerCallId        {@link NativeVoiceCallManager#getCallId()},
     *                             or null when no manager exists
     * @param managerStatusName    {@link NativeVoiceCallManager.CallStatus#name()}
     *                             for the current manager status, or null
     *                             when no manager exists. Compared as
     *                             {@code "INCOMING_RINGING"}.
     */
    public static Action decide(
            int innerKind,
            String innerCallId,
            String pendingPrefsCallId,
            String managerCallId,
            String managerStatusName) {

        // Kinds that are unconditionally dropped from self per the
        // NIP-AC self-event filter (matches Messaging.ts:447-453 plus
        // 25050 self-call degenerate case at :469-470).
        if (innerKind != 25051 && innerKind != 25054) {
            return Action.DROP;
        }

        // No call-id → can't match anything → drop.
        if (innerCallId == null || innerCallId.isEmpty()) {
            return Action.DROP;
        }

        // Check the active-manager case first; an in-flight
        // INCOMING_RINGING manager owns the dismissal authoritatively.
        boolean managerRingingForCall =
            managerCallId != null
                && managerCallId.equals(innerCallId)
                && "INCOMING_RINGING".equals(managerStatusName);

        if (managerRingingForCall) {
            return innerKind == 25051
                ? Action.END_MANAGER_ANSWERED
                : Action.END_MANAGER_REJECTED;
        }

        // Fall back to the lockscreen FSI dismissal when the pending
        // SharedPreferences slot matches.
        if (pendingPrefsCallId != null && pendingPrefsCallId.equals(innerCallId)) {
            return Action.DISMISS_FSI;
        }

        // No matching pending state — stale or out-of-band echo, drop.
        return Action.DROP;
    }
}
