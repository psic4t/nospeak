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
}
