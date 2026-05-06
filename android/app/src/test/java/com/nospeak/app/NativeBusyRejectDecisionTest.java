package com.nospeak.app;

import org.junit.Test;

import static org.junit.Assert.assertEquals;

/**
 * Unit tests for {@link NativeBusyRejectDecision#decide}. Part of the
 * {@code fix-android-nip-ac-compliance-gaps} OpenSpec change.
 *
 * <p>Covers every branch of the busy-decision matrix:
 * <ul>
 *   <li>No manager / idle manager → {@link NativeBusyRejectDecision.Action#NORMAL_FLOW}</li>
 *   <li>Busy manager, same call-id → {@link NativeBusyRejectDecision.Action#IGNORE_DUPLICATE}</li>
 *   <li>Busy manager, different call-id → {@link NativeBusyRejectDecision.Action#AUTO_REJECT_BUSY}</li>
 *   <li>Defensive: null/empty incomingCallId → {@link NativeBusyRejectDecision.Action#NORMAL_FLOW}</li>
 * </ul>
 */
public class NativeBusyRejectDecisionTest {

    private static final String CALL_X = "550e8400-e29b-41d4-a716-446655440000";
    private static final String CALL_Y = "660f9511-f3ac-52e5-b827-557766551111";

    @Test
    public void noManagerProducesNormalFlow() {
        // Caller passes managerCallId=null and managerIsBusy=false when
        // VoiceCallForegroundService.getNativeManager() returns null.
        NativeBusyRejectDecision.Action action =
            NativeBusyRejectDecision.decide(null, false, CALL_X);
        assertEquals(NativeBusyRejectDecision.Action.NORMAL_FLOW, action);
    }

    @Test
    public void idleManagerProducesNormalFlow() {
        // Manager exists but isBusy() returned false (status=IDLE or
        // status=ENDED). The new offer should be allowed to ring.
        NativeBusyRejectDecision.Action action =
            NativeBusyRejectDecision.decide(null, false, CALL_X);
        assertEquals(NativeBusyRejectDecision.Action.NORMAL_FLOW, action);
    }

    @Test
    public void busyManagerSameCallIdIsDuplicate() {
        // Same call-id as the active manager — duplicate redelivery,
        // silently drop without sending a reject.
        NativeBusyRejectDecision.Action action =
            NativeBusyRejectDecision.decide(CALL_X, true, CALL_X);
        assertEquals(NativeBusyRejectDecision.Action.IGNORE_DUPLICATE, action);
    }

    @Test
    public void busyManagerDifferentCallIdAutoRejectsBusy() {
        // Concurrent offer for a different call → NIP-AC busy auto-reject.
        NativeBusyRejectDecision.Action action =
            NativeBusyRejectDecision.decide(CALL_X, true, CALL_Y);
        assertEquals(NativeBusyRejectDecision.Action.AUTO_REJECT_BUSY, action);
    }

    @Test
    public void busyManagerWithNullManagerCallIdAutoRejects() {
        // Defensive: a busy manager that somehow has a null call-id (a
        // bug elsewhere) should still produce an auto-reject rather
        // than silently ignoring as a "duplicate".
        NativeBusyRejectDecision.Action action =
            NativeBusyRejectDecision.decide(null, true, CALL_Y);
        assertEquals(NativeBusyRejectDecision.Action.AUTO_REJECT_BUSY, action);
    }

    @Test
    public void nullIncomingCallIdIsNormalFlow() {
        // Defensive: callers should already have dropped offers with no
        // call-id tag (NativeBackgroundMessagingService:3306-3312), but
        // the helper must not crash if they don't.
        NativeBusyRejectDecision.Action action =
            NativeBusyRejectDecision.decide(CALL_X, true, null);
        assertEquals(NativeBusyRejectDecision.Action.NORMAL_FLOW, action);
    }

    @Test
    public void emptyIncomingCallIdIsNormalFlow() {
        NativeBusyRejectDecision.Action action =
            NativeBusyRejectDecision.decide(CALL_X, true, "");
        assertEquals(NativeBusyRejectDecision.Action.NORMAL_FLOW, action);
    }

    // ------------------------------------------------------------------
    //  Group-aware decision tests (add-group-voice-calling)
    // ------------------------------------------------------------------

    private static final String GROUP_G =
        "7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e";
    private static final String GROUP_H =
        "8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e";

    @Test
    public void groupSameGroupCallIdIsMeshFormation() {
        // Active group call with group-call-id G. Inbound offer for the
        // SAME group-call-id is mesh formation (an accepter offering to
        // another roster member), NOT a concurrent call.
        NativeBusyRejectDecision.Action action =
            NativeBusyRejectDecision.decide(
                CALL_X, GROUP_G, true, CALL_Y, GROUP_G);
        assertEquals(NativeBusyRejectDecision.Action.MESH_FORMATION, action);
    }

    @Test
    public void groupDifferentGroupCallIdIsBusy() {
        // Active group call with group-call-id G; inbound offer for a
        // different group-call-id H → busy.
        NativeBusyRejectDecision.Action action =
            NativeBusyRejectDecision.decide(
                CALL_X, GROUP_G, true, CALL_Y, GROUP_H);
        assertEquals(NativeBusyRejectDecision.Action.AUTO_REJECT_BUSY, action);
    }

    @Test
    public void oneToOneInboundDuringGroupCallIsBusy() {
        // Active group call with group-call-id G; inbound 1-on-1 offer
        // (no group-call-id) → busy.
        NativeBusyRejectDecision.Action action =
            NativeBusyRejectDecision.decide(
                CALL_X, GROUP_G, true, CALL_Y, null);
        assertEquals(NativeBusyRejectDecision.Action.AUTO_REJECT_BUSY, action);
    }

    @Test
    public void groupInboundDuring1on1CallIsBusy() {
        // Active 1-on-1 call (managerGroupCallId=null); inbound offer
        // carries group-call-id → busy.
        NativeBusyRejectDecision.Action action =
            NativeBusyRejectDecision.decide(
                CALL_X, null, true, CALL_Y, GROUP_G);
        assertEquals(NativeBusyRejectDecision.Action.AUTO_REJECT_BUSY, action);
    }

    @Test
    public void noActiveCallProducesNormalFlowEvenForGroupOffer() {
        // Manager idle (busy=false). Inbound group offer should
        // proceed to the normal group-dispatch path.
        NativeBusyRejectDecision.Action action =
            NativeBusyRejectDecision.decide(
                null, null, false, CALL_X, GROUP_G);
        assertEquals(NativeBusyRejectDecision.Action.NORMAL_FLOW, action);
    }

    @Test
    public void sameGroupSameCallIdAlsoMeshFormation() {
        // Edge case: same group-call-id AND same per-pair call-id
        // (e.g., true duplicate-redelivery of an accepter's offer
        // during mesh formation). The decision is MESH_FORMATION, not
        // IGNORE_DUPLICATE — the group dispatch path runs its own
        // dedup against the inner-event-id set upstream.
        NativeBusyRejectDecision.Action action =
            NativeBusyRejectDecision.decide(
                CALL_X, GROUP_G, true, CALL_X, GROUP_G);
        assertEquals(NativeBusyRejectDecision.Action.MESH_FORMATION, action);
    }
}
