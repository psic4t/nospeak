package com.nospeak.app;

import org.junit.Test;

import static org.junit.Assert.assertEquals;

/**
 * Unit tests for {@link NativeSelfDismissDecision#decide}. Part of the
 * {@code fix-android-nip-ac-compliance-gaps} OpenSpec change.
 *
 * <p>Covers every branch of the decision matrix: the four
 * always-dropped self kinds, the answer/reject matching-callId paths
 * (manager INCOMING_RINGING, prefs only, neither), and defensive
 * null/empty inputs.
 */
public class NativeSelfDismissDecisionTest {

    private static final String CALL_X = "550e8400-e29b-41d4-a716-446655440000";
    private static final String CALL_Y = "660f9511-f3ac-52e5-b827-557766551111";
    private static final String RINGING = "INCOMING_RINGING";
    private static final String IDLE = "IDLE";
    private static final String ACTIVE = "ACTIVE";

    // ---- Kinds that are always dropped from self ----

    @Test
    public void selfOfferAlwaysDropped() {
        assertEquals(NativeSelfDismissDecision.Action.DROP,
            NativeSelfDismissDecision.decide(25050, CALL_X, CALL_X, CALL_X, RINGING));
    }

    @Test
    public void selfIceAlwaysDropped() {
        assertEquals(NativeSelfDismissDecision.Action.DROP,
            NativeSelfDismissDecision.decide(25052, CALL_X, CALL_X, CALL_X, RINGING));
    }

    @Test
    public void selfHangupAlwaysDropped() {
        assertEquals(NativeSelfDismissDecision.Action.DROP,
            NativeSelfDismissDecision.decide(25053, CALL_X, CALL_X, CALL_X, ACTIVE));
    }

    @Test
    public void selfRenegotiateAlwaysDropped() {
        assertEquals(NativeSelfDismissDecision.Action.DROP,
            NativeSelfDismissDecision.decide(25055, CALL_X, CALL_X, CALL_X, ACTIVE));
    }

    // ---- 25051 (Answer) self-event ----

    @Test
    public void selfAnswerWithRingingManagerEndsManagerAsAnswered() {
        assertEquals(NativeSelfDismissDecision.Action.END_MANAGER_ANSWERED,
            NativeSelfDismissDecision.decide(25051, CALL_X, CALL_X, CALL_X, RINGING));
    }

    @Test
    public void selfAnswerWithPendingPrefsOnlyDismissesFsi() {
        // No manager yet (e.g. user hasn't tapped Accept on D1; D2
        // accepts and the self-wrap echoes back to D1). The FSI is
        // showing because the offer was persisted.
        assertEquals(NativeSelfDismissDecision.Action.DISMISS_FSI,
            NativeSelfDismissDecision.decide(25051, CALL_X, CALL_X, null, null));
    }

    @Test
    public void selfAnswerWithNoMatchingStateDropped() {
        // Neither prefs nor manager hold the call-id — stale echo.
        assertEquals(NativeSelfDismissDecision.Action.DROP,
            NativeSelfDismissDecision.decide(25051, CALL_X, null, null, null));
    }

    @Test
    public void selfAnswerWithMismatchedPrefsCallIdDropped() {
        assertEquals(NativeSelfDismissDecision.Action.DROP,
            NativeSelfDismissDecision.decide(25051, CALL_X, CALL_Y, null, null));
    }

    @Test
    public void selfAnswerWithMismatchedManagerCallIdDropped() {
        // Manager is ringing for a DIFFERENT call than the self-event.
        assertEquals(NativeSelfDismissDecision.Action.DROP,
            NativeSelfDismissDecision.decide(25051, CALL_X, null, CALL_Y, RINGING));
    }

    @Test
    public void selfAnswerWithManagerNotRingingFallsBackToFsi() {
        // Manager exists but is not in INCOMING_RINGING (e.g. ACTIVE
        // for a different call we've already accepted) — manager-end
        // path doesn't apply, fall back to FSI dismissal if prefs match.
        assertEquals(NativeSelfDismissDecision.Action.DISMISS_FSI,
            NativeSelfDismissDecision.decide(25051, CALL_X, CALL_X, CALL_Y, ACTIVE));
    }

    @Test
    public void selfAnswerWithIdleManagerAndMatchingPrefsDismissesFsi() {
        // Manager status is IDLE → not authoritative. FSI prefs match → dismiss FSI.
        assertEquals(NativeSelfDismissDecision.Action.DISMISS_FSI,
            NativeSelfDismissDecision.decide(25051, CALL_X, CALL_X, null, IDLE));
    }

    // ---- 25054 (Reject) self-event ----

    @Test
    public void selfRejectWithRingingManagerEndsManagerAsRejected() {
        assertEquals(NativeSelfDismissDecision.Action.END_MANAGER_REJECTED,
            NativeSelfDismissDecision.decide(25054, CALL_X, CALL_X, CALL_X, RINGING));
    }

    @Test
    public void selfRejectWithPendingPrefsOnlyDismissesFsi() {
        assertEquals(NativeSelfDismissDecision.Action.DISMISS_FSI,
            NativeSelfDismissDecision.decide(25054, CALL_X, CALL_X, null, null));
    }

    @Test
    public void selfRejectWithNoMatchingStateDropped() {
        assertEquals(NativeSelfDismissDecision.Action.DROP,
            NativeSelfDismissDecision.decide(25054, CALL_X, null, null, null));
    }

    @Test
    public void selfRejectWithMismatchedPrefsCallIdDropped() {
        assertEquals(NativeSelfDismissDecision.Action.DROP,
            NativeSelfDismissDecision.decide(25054, CALL_X, CALL_Y, null, null));
    }

    // ---- Defensive: null / empty inputs ----

    @Test
    public void nullInnerCallIdDropped() {
        assertEquals(NativeSelfDismissDecision.Action.DROP,
            NativeSelfDismissDecision.decide(25051, null, CALL_X, CALL_X, RINGING));
    }

    @Test
    public void emptyInnerCallIdDropped() {
        assertEquals(NativeSelfDismissDecision.Action.DROP,
            NativeSelfDismissDecision.decide(25054, "", CALL_X, CALL_X, RINGING));
    }

    @Test
    public void unknownKindDropped() {
        // Defensive: any kind outside the NIP-AC range should drop.
        assertEquals(NativeSelfDismissDecision.Action.DROP,
            NativeSelfDismissDecision.decide(1, CALL_X, CALL_X, CALL_X, RINGING));
    }

    // ------------------------------------------------------------------
    //  Group-aware self-dismiss tests (add-group-voice-calling).
    //  When the inner event carries a group-call-id, dedup is by
    //  group-call-id rather than per-pair call-id. Per-pair call-id
    //  may differ between sender's outbound edge and our incoming edge.
    // ------------------------------------------------------------------

    private static final String GROUP_G =
        "7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e";
    private static final String GROUP_H =
        "8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e";

    @Test
    public void groupSelfAnswerWhileRingingEndsManager() {
        // Manager ringing for group-call-id G; self-25051 for the same
        // G arrives → END_MANAGER_ANSWERED. Per-pair call-ids differ,
        // which is fine because group dedup keys on group-call-id.
        assertEquals(NativeSelfDismissDecision.Action.END_MANAGER_ANSWERED,
            NativeSelfDismissDecision.decide(
                25051,
                "any-pair-cid",
                GROUP_G,
                /* pendingPrefsCallId= */ null,
                /* pendingPrefsGroupCallId= */ null,
                /* managerCallId= */ "any-other-pair-cid",
                /* managerGroupCallId= */ GROUP_G,
                RINGING));
    }

    @Test
    public void groupSelfRejectWhileRingingEndsManager() {
        assertEquals(NativeSelfDismissDecision.Action.END_MANAGER_REJECTED,
            NativeSelfDismissDecision.decide(
                25054, "any-pair-cid", GROUP_G,
                null, null,
                "any-other-pair-cid", GROUP_G, RINGING));
    }

    @Test
    public void groupSelfAnswerWithMismatchedGroupCallIdDropped() {
        // Manager ringing for G; self-25051 carries H → DROP.
        assertEquals(NativeSelfDismissDecision.Action.DROP,
            NativeSelfDismissDecision.decide(
                25051, "pair-cid", GROUP_H,
                null, null,
                "pair-cid", GROUP_G, RINGING));
    }

    @Test
    public void groupSelfAnswerWhileFsiPendingDismissesFsi() {
        // No manager; FSI pending slot has matching groupCallId →
        // DISMISS_FSI.
        assertEquals(NativeSelfDismissDecision.Action.DISMISS_FSI,
            NativeSelfDismissDecision.decide(
                25051, "pair-cid", GROUP_G,
                /* pendingPrefsCallId= */ null,
                /* pendingPrefsGroupCallId= */ GROUP_G,
                /* managerCallId= */ null,
                /* managerGroupCallId= */ null,
                /* managerStatusName= */ null));
    }

    @Test
    public void groupSelfAnswerWhileFsiPendingMismatchedGroupDropped() {
        assertEquals(NativeSelfDismissDecision.Action.DROP,
            NativeSelfDismissDecision.decide(
                25051, "pair-cid", GROUP_G,
                null, GROUP_H,
                null, null, null));
    }

    @Test
    public void oneToOneSelfAnswerDoesNotMatchGroupManager() {
        // Manager is in a GROUP call (managerGroupCallId=G) but the
        // inbound self-25051 is a 1-on-1 event (no group-call-id).
        // The 1-on-1 dedup branch requires managerGroupCallId == null,
        // so the call-id match alone MUST NOT trigger
        // END_MANAGER_ANSWERED here.
        assertEquals(NativeSelfDismissDecision.Action.DROP,
            NativeSelfDismissDecision.decide(
                25051,
                CALL_X,
                /* innerGroupCallId= */ null,
                null, null,
                CALL_X,
                /* managerGroupCallId= */ GROUP_G,
                RINGING));
    }

    @Test
    public void groupSelfHangupAlwaysDropped() {
        // Self-25053 is always dropped — group calls don't change this.
        assertEquals(NativeSelfDismissDecision.Action.DROP,
            NativeSelfDismissDecision.decide(
                25053, "pair-cid", GROUP_G,
                null, null,
                "pair-cid", GROUP_G, ACTIVE));
    }

    @Test
    public void groupSelfIceAlwaysDropped() {
        assertEquals(NativeSelfDismissDecision.Action.DROP,
            NativeSelfDismissDecision.decide(
                25052, "pair-cid", GROUP_G,
                null, null,
                "pair-cid", GROUP_G, ACTIVE));
    }
}
