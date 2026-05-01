package com.nospeak.app;

import org.junit.Test;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;

import com.nospeak.app.NativeVoiceCallManager.CallStatus;

/**
 * Unit tests for {@link CallHistoryDecision#decide}. Phase 4 of the
 * {@code add-native-voice-calls} OpenSpec change.
 *
 * <p>Asserts that the call-history authoring decision tree matches
 * the JS {@code VoiceCallService} behaviour for every termination
 * scenario the spec defines. A regression here would cause the
 * conversation timeline to lose call entries (or worse, render the
 * wrong role-aware copy).
 */
public class CallHistoryDecisionTest {

    private static final String PEER = "peer1234abcd";

    @Test
    public void activeHangupAuthorsEndedAsCaller() {
        CallHistoryDecision d = CallHistoryDecision.decide(
            CallStatus.ACTIVE, "hangup", /* isInitiator= */ true, PEER, /* durationSec= */ 47);
        assertEquals(CallHistoryDecision.Kind.GIFT_WRAP, d.kind);
        assertEquals("ended", d.type);
        assertEquals(47, d.durationSec);
        // Caller is the initiator => initiatorHex is null (sender defaults
        // to the local user).
        assertNull(d.initiatorHex);
    }

    @Test
    public void activeHangupAuthorsEndedAsCallee() {
        CallHistoryDecision d = CallHistoryDecision.decide(
            CallStatus.ACTIVE, "hangup", /* isInitiator= */ false, PEER, 12);
        assertEquals(CallHistoryDecision.Kind.GIFT_WRAP, d.kind);
        assertEquals("ended", d.type);
        assertEquals(12, d.durationSec);
        // Callee — the peer is the initiator.
        assertEquals(PEER, d.initiatorHex);
    }

    @Test
    public void outgoingRingingHangupIsLocalOnlyCancelled() {
        CallHistoryDecision d = CallHistoryDecision.decide(
            CallStatus.OUTGOING_RINGING, "hangup", true, PEER, 0);
        assertEquals(CallHistoryDecision.Kind.LOCAL_ONLY, d.kind);
        assertEquals("cancelled", d.type);
        // No initiator on cancelled — it's caller-local-only and the
        // local user IS the initiator (the caller).
        assertNull(d.initiatorHex);
        assertEquals(-1, d.durationSec);
    }

    @Test
    public void incomingRingingHangupIsLocalOnlyMissed() {
        CallHistoryDecision d = CallHistoryDecision.decide(
            CallStatus.INCOMING_RINGING, "hangup", false, PEER, 0);
        assertEquals(CallHistoryDecision.Kind.LOCAL_ONLY, d.kind);
        assertEquals("missed", d.type);
        // Missed is callee-local-only — the PEER initiated.
        assertEquals(PEER, d.initiatorHex);
    }

    @Test
    public void timeoutAsCallerAuthorsNoAnswer() {
        CallHistoryDecision d = CallHistoryDecision.decide(
            CallStatus.OUTGOING_RINGING, "timeout", true, PEER, 0);
        assertEquals(CallHistoryDecision.Kind.GIFT_WRAP, d.kind);
        assertEquals("no-answer", d.type);
        assertEquals(-1, d.durationSec);
        assertNull(d.initiatorHex);
    }

    @Test
    public void timeoutAsCalleeAuthorsNothing() {
        // Pathological — callee shouldn't see the offer-timeout — but
        // the rule is: only the initiator authors no-answer.
        CallHistoryDecision d = CallHistoryDecision.decide(
            CallStatus.OUTGOING_RINGING, "timeout", false, PEER, 0);
        assertEquals(CallHistoryDecision.Kind.NONE, d.kind);
    }

    @Test
    public void iceFailedAsCallerAuthorsFailed() {
        CallHistoryDecision d = CallHistoryDecision.decide(
            CallStatus.CONNECTING, "ice-failed", true, PEER, 0);
        assertEquals(CallHistoryDecision.Kind.GIFT_WRAP, d.kind);
        assertEquals("failed", d.type);
        assertNull(d.initiatorHex);
    }

    @Test
    public void iceFailedAsCalleeAuthorsNothing() {
        CallHistoryDecision d = CallHistoryDecision.decide(
            CallStatus.CONNECTING, "ice-failed", false, PEER, 0);
        assertEquals(CallHistoryDecision.Kind.NONE, d.kind);
    }

    @Test
    public void busyAsCallerAuthorsBusy() {
        CallHistoryDecision d = CallHistoryDecision.decide(
            CallStatus.OUTGOING_RINGING, "busy", true, PEER, 0);
        assertEquals(CallHistoryDecision.Kind.GIFT_WRAP, d.kind);
        assertEquals("busy", d.type);
        assertNull(d.initiatorHex);
    }

    @Test
    public void busyAsCalleeAuthorsNothing() {
        CallHistoryDecision d = CallHistoryDecision.decide(
            CallStatus.OUTGOING_RINGING, "busy", false, PEER, 0);
        assertEquals(CallHistoryDecision.Kind.NONE, d.kind);
    }

    @Test
    public void rejectedAuthorsNothing() {
        // The decline path authors a 'declined' rumor explicitly via
        // sendVoiceCallReject + sendVoiceCallDeclinedEvent before
        // finishCall is reached. The caller's 'rejected' transition
        // gets the gift-wrapped 'declined' from the callee.
        CallHistoryDecision d = CallHistoryDecision.decide(
            CallStatus.INCOMING_RINGING, "rejected", false, PEER, 0);
        assertEquals(CallHistoryDecision.Kind.NONE, d.kind);
    }

    @Test
    public void answeredElsewhereAuthorsNothing() {
        CallHistoryDecision d = CallHistoryDecision.decide(
            CallStatus.INCOMING_RINGING, "answered-elsewhere", false, PEER, 0);
        assertEquals(CallHistoryDecision.Kind.NONE, d.kind);
    }

    @Test
    public void rejectedElsewhereAuthorsNothing() {
        CallHistoryDecision d = CallHistoryDecision.decide(
            CallStatus.INCOMING_RINGING, "rejected-elsewhere", false, PEER, 0);
        assertEquals(CallHistoryDecision.Kind.NONE, d.kind);
    }

    @Test
    public void errorAuthorsNothing() {
        CallHistoryDecision d = CallHistoryDecision.decide(
            CallStatus.CONNECTING, "error", true, PEER, 0);
        assertEquals(CallHistoryDecision.Kind.NONE, d.kind);
    }

    @Test
    public void nullPeerYieldsNone() {
        CallHistoryDecision d = CallHistoryDecision.decide(
            CallStatus.ACTIVE, "hangup", true, null, 10);
        assertEquals(CallHistoryDecision.Kind.NONE, d.kind);
    }

    @Test
    public void nullStatusYieldsNone() {
        CallHistoryDecision d = CallHistoryDecision.decide(
            null, "hangup", true, PEER, 10);
        assertEquals(CallHistoryDecision.Kind.NONE, d.kind);
    }

    @Test
    public void wireNamesMatchJsContract() {
        // CallStatus.wireName() values must match the kebab-case
        // strings VoiceCallStatus uses on the JS side; the JS
        // VoiceCallServiceNative.applyStatus() switch keys off these
        // exact strings. Any drift desyncs UI state from native state.
        assertEquals("idle", CallStatus.IDLE.wireName());
        assertEquals("outgoing-ringing", CallStatus.OUTGOING_RINGING.wireName());
        assertEquals("incoming-ringing", CallStatus.INCOMING_RINGING.wireName());
        assertEquals("connecting", CallStatus.CONNECTING.wireName());
        assertEquals("active", CallStatus.ACTIVE.wireName());
        assertEquals("ended", CallStatus.ENDED.wireName());
    }
}
