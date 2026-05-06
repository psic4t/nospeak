package com.nospeak.app;

import org.junit.Test;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

/**
 * Unit tests for {@link ProximityLockPolicy#shouldHold}. Covers every
 * combination of {@link NativeVoiceCallManager.CallStatus} ×
 * {@link NativeVoiceCallManager.CallKind} so a future status/kind
 * addition that forgets to update the policy is caught by the suite.
 *
 * <p>The policy is a pure function of (status, kind) and depends on
 * no Android framework machinery, so this is a vanilla JUnit test.
 */
public class ProximityLockPolicyTest {

    @Test
    public void nullStatusDoesNotHold() {
        // Defensive: callers may pass null when no manager exists.
        assertFalse(ProximityLockPolicy.shouldHold(
            null, NativeVoiceCallManager.CallKind.VOICE));
        assertFalse(ProximityLockPolicy.shouldHold(
            null, NativeVoiceCallManager.CallKind.VIDEO));
        assertFalse(ProximityLockPolicy.shouldHold(null, null));
    }

    @Test
    public void idleDoesNotHold() {
        assertFalse(ProximityLockPolicy.shouldHold(
            NativeVoiceCallManager.CallStatus.IDLE,
            NativeVoiceCallManager.CallKind.VOICE));
        assertFalse(ProximityLockPolicy.shouldHold(
            NativeVoiceCallManager.CallStatus.IDLE,
            NativeVoiceCallManager.CallKind.VIDEO));
    }

    @Test
    public void endedDoesNotHold() {
        // ENDED is the post-call display window — the user is reading
        // the end-reason text. Proximity-off would cut that short.
        assertFalse(ProximityLockPolicy.shouldHold(
            NativeVoiceCallManager.CallStatus.ENDED,
            NativeVoiceCallManager.CallKind.VOICE));
        assertFalse(ProximityLockPolicy.shouldHold(
            NativeVoiceCallManager.CallStatus.ENDED,
            NativeVoiceCallManager.CallKind.VIDEO));
    }

    @Test
    public void voiceCallHoldsThroughEveryActiveStatus() {
        for (NativeVoiceCallManager.CallStatus s : new NativeVoiceCallManager.CallStatus[] {
                NativeVoiceCallManager.CallStatus.OUTGOING_RINGING,
                NativeVoiceCallManager.CallStatus.INCOMING_RINGING,
                NativeVoiceCallManager.CallStatus.CONNECTING,
                NativeVoiceCallManager.CallStatus.ACTIVE
        }) {
            assertTrue(
                "should hold on voice call in status " + s,
                ProximityLockPolicy.shouldHold(
                    s, NativeVoiceCallManager.CallKind.VOICE));
        }
    }

    @Test
    public void videoCallNeverHolds() {
        // Video must keep the screen on regardless of which active
        // status we're in — the user is looking at the remote video.
        for (NativeVoiceCallManager.CallStatus s : new NativeVoiceCallManager.CallStatus[] {
                NativeVoiceCallManager.CallStatus.OUTGOING_RINGING,
                NativeVoiceCallManager.CallStatus.INCOMING_RINGING,
                NativeVoiceCallManager.CallStatus.CONNECTING,
                NativeVoiceCallManager.CallStatus.ACTIVE
        }) {
            assertFalse(
                "should NOT hold on video call in status " + s,
                ProximityLockPolicy.shouldHold(
                    s, NativeVoiceCallManager.CallKind.VIDEO));
        }
    }

    @Test
    public void nullKindDefaultsToVoiceBehavior() {
        // Defensive: if a caller forgets to pass kind we default to
        // VOICE rather than crashing or refusing to hold the lock.
        assertTrue(ProximityLockPolicy.shouldHold(
            NativeVoiceCallManager.CallStatus.ACTIVE, null));
        assertTrue(ProximityLockPolicy.shouldHold(
            NativeVoiceCallManager.CallStatus.CONNECTING, null));
        assertFalse(ProximityLockPolicy.shouldHold(
            NativeVoiceCallManager.CallStatus.IDLE, null));
    }

    @Test
    public void voiceToVideoTransitionFlipsDecision() {
        // Models the kind-25055 upgrade path: while ACTIVE/voice we
        // hold; the moment promoteCallKindToVideo flips kind to VIDEO
        // we must release.
        assertTrue(ProximityLockPolicy.shouldHold(
            NativeVoiceCallManager.CallStatus.ACTIVE,
            NativeVoiceCallManager.CallKind.VOICE));
        assertFalse(ProximityLockPolicy.shouldHold(
            NativeVoiceCallManager.CallStatus.ACTIVE,
            NativeVoiceCallManager.CallKind.VIDEO));
    }
}
