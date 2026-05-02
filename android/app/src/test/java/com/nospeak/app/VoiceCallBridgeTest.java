package com.nospeak.app;

import org.junit.Test;

import java.util.ArrayList;
import java.util.List;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

/**
 * Bridge-boundary regression tests for the
 * {@link NativeVoiceCallManager.MessagingBridge} produced by
 * {@link VoiceCallForegroundService#buildBridge}.
 *
 * <p>These tests exist specifically to prevent recurrence of the
 * Android &rarr; Web video-call downgrade bug shipped briefly during
 * the {@code add-video-calling} OpenSpec change: the bridge's
 * {@code sendOffer} method was 3-arg and dropped the call kind, so
 * the underlying NIP-AC helper hard-coded {@code call-type=voice}
 * regardless of what the manager intended. Wire-format fixture
 * tests {@link NativeNipAcSenderTest} could not catch it because they
 * bypass the bridge entirely and hand-construct the {@code extraTags}
 * list.
 *
 * <p>The contract verified here: every {@code MessagingBridge} method
 * forwards every argument to the corresponding {@link
 * VoiceCallForegroundService.NipAcSender} method, byte-for-byte.
 */
public class VoiceCallBridgeTest {

    /**
     * Records every sender invocation along with all of its arguments
     * so the assertions can compare against the values passed to the
     * bridge call.
     */
    private static final class RecordingSender
            implements VoiceCallForegroundService.NipAcSender {
        final List<Object[]> offers = new ArrayList<>();
        final List<Object[]> answers = new ArrayList<>();
        final List<Object[]> ices = new ArrayList<>();
        final List<Object[]> hangups = new ArrayList<>();
        final List<Object[]> rejects = new ArrayList<>();
        final List<Object[]> renegotiates = new ArrayList<>();
        final List<Object[]> historyRumors = new ArrayList<>();

        @Override
        public void sendVoiceCallOffer(
                String recipientHex, String callId, String sdp, String callKind) {
            offers.add(new Object[] { recipientHex, callId, sdp, callKind });
        }
        @Override
        public void sendVoiceCallAnswer(
                String recipientHex, String callId, String sdp) {
            answers.add(new Object[] { recipientHex, callId, sdp });
        }
        @Override
        public void sendVoiceCallIce(
                String recipientHex, String callId,
                String candidate, String sdpMid, Integer sdpMLineIndex) {
            ices.add(new Object[] {
                recipientHex, callId, candidate, sdpMid, sdpMLineIndex });
        }
        @Override
        public void sendVoiceCallHangup(
                String recipientHex, String callId, String reason) {
            hangups.add(new Object[] { recipientHex, callId, reason });
        }
        @Override
        public void sendVoiceCallReject(String recipientHex, String callId) {
            rejects.add(new Object[] { recipientHex, callId });
        }
        @Override
        public void sendVoiceCallRenegotiate(
                String recipientHex, String callId, String sdp) {
            renegotiates.add(new Object[] { recipientHex, callId, sdp });
        }
        @Override
        public void sendVoiceCallHistoryRumor(
                String recipientHex,
                String type,
                int durationSec,
                String callId,
                String initiatorHex,
                String callMediaType) {
            historyRumors.add(new Object[] {
                recipientHex, type, durationSec, callId, initiatorHex, callMediaType });
        }
    }

    @Test
    public void sendOffer_forwardsVideoCallKindToSender() {
        // This is the regression test for the bug described in the
        // class doc: an Android-originated *video* call must reach the
        // sender as kind="video" so that the resulting NIP-AC inner
        // event tags the call correctly.
        RecordingSender sender = new RecordingSender();
        NativeVoiceCallManager.MessagingBridge bridge =
            VoiceCallForegroundService.buildBridge(sender);

        bridge.sendOffer(
            "recipient_hex_lower",
            "call-id-1",
            "v=0\r\n",
            "video"
        );

        assertEquals(1, sender.offers.size());
        Object[] args = sender.offers.get(0);
        assertEquals("recipient_hex_lower", args[0]);
        assertEquals("call-id-1", args[1]);
        assertEquals("v=0\r\n", args[2]);
        assertEquals("video", args[3]);
    }

    @Test
    public void sendOffer_forwardsVoiceCallKindToSender() {
        RecordingSender sender = new RecordingSender();
        NativeVoiceCallManager.MessagingBridge bridge =
            VoiceCallForegroundService.buildBridge(sender);

        bridge.sendOffer(
            "recipient_hex_lower",
            "call-id-2",
            "v=0\r\n",
            "voice"
        );

        assertEquals(1, sender.offers.size());
        Object[] args = sender.offers.get(0);
        assertEquals("voice", args[3]);
    }

    @Test
    public void sendOffer_doesNotConfuseCallKindWithCallId() {
        // Defensive: argument-order regressions in the bridge would
        // most commonly swap callId and callKind. Build a record where
        // the values are deliberately distinguishable strings so a
        // shuffle would fail loudly here even if the wireName-to-tag
        // path stayed silent.
        RecordingSender sender = new RecordingSender();
        NativeVoiceCallManager.MessagingBridge bridge =
            VoiceCallForegroundService.buildBridge(sender);

        bridge.sendOffer(
            "recipient",
            "CALLID-DISTINCT",
            "SDP-DISTINCT",
            "video"
        );

        Object[] args = sender.offers.get(0);
        assertEquals("recipient", args[0]);
        assertEquals("CALLID-DISTINCT", args[1]);
        assertEquals("SDP-DISTINCT", args[2]);
        assertEquals("video", args[3]);
    }

    @Test
    public void sendAnswer_forwardsArgumentsToSender() {
        RecordingSender sender = new RecordingSender();
        NativeVoiceCallManager.MessagingBridge bridge =
            VoiceCallForegroundService.buildBridge(sender);

        bridge.sendAnswer("recipient", "cid", "sdp");
        assertEquals(1, sender.answers.size());
        assertEquals("recipient", sender.answers.get(0)[0]);
        assertEquals("cid", sender.answers.get(0)[1]);
        assertEquals("sdp", sender.answers.get(0)[2]);
    }

    @Test
    public void sendIce_forwardsAllFiveArgumentsToSender() {
        RecordingSender sender = new RecordingSender();
        NativeVoiceCallManager.MessagingBridge bridge =
            VoiceCallForegroundService.buildBridge(sender);

        bridge.sendIce("recipient", "cid", "candidate-line", "audio", 0);
        assertEquals(1, sender.ices.size());
        Object[] args = sender.ices.get(0);
        assertEquals("recipient", args[0]);
        assertEquals("cid", args[1]);
        assertEquals("candidate-line", args[2]);
        assertEquals("audio", args[3]);
        assertEquals(Integer.valueOf(0), args[4]);
    }

    @Test
    public void sendHangup_forwardsArgumentsToSender() {
        RecordingSender sender = new RecordingSender();
        NativeVoiceCallManager.MessagingBridge bridge =
            VoiceCallForegroundService.buildBridge(sender);

        bridge.sendHangup("recipient", "cid", "user-ended");
        assertEquals(1, sender.hangups.size());
        assertEquals("user-ended", sender.hangups.get(0)[2]);
    }

    @Test
    public void sendReject_forwardsArgumentsToSender() {
        RecordingSender sender = new RecordingSender();
        NativeVoiceCallManager.MessagingBridge bridge =
            VoiceCallForegroundService.buildBridge(sender);

        bridge.sendReject("recipient", "cid");
        assertEquals(1, sender.rejects.size());
        assertEquals("recipient", sender.rejects.get(0)[0]);
        assertEquals("cid", sender.rejects.get(0)[1]);
    }

    @Test
    public void sendRenegotiate_forwardsArgumentsToSender() {
        RecordingSender sender = new RecordingSender();
        NativeVoiceCallManager.MessagingBridge bridge =
            VoiceCallForegroundService.buildBridge(sender);

        bridge.sendRenegotiate("recipient", "cid", "v=0\r\n");
        assertEquals(1, sender.renegotiates.size());
        Object[] args = sender.renegotiates.get(0);
        assertEquals("recipient", args[0]);
        assertEquals("cid", args[1]);
        assertEquals("v=0\r\n", args[2]);
    }

    @Test
    public void sendCallHistoryRumor_forwardsAllSixArgumentsToSender() {
        // sendCallHistoryRumor was already correct (it has carried
        // callMediaType since it landed) — this assertion locks the
        // contract in place so a future refactor of buildBridge can't
        // silently drop it the same way sendOffer did.
        RecordingSender sender = new RecordingSender();
        NativeVoiceCallManager.MessagingBridge bridge =
            VoiceCallForegroundService.buildBridge(sender);

        bridge.sendCallHistoryRumor(
            "recipient", "ended", 42, "cid", "initiator", "video");
        assertEquals(1, sender.historyRumors.size());
        Object[] args = sender.historyRumors.get(0);
        assertEquals("recipient", args[0]);
        assertEquals("ended", args[1]);
        assertEquals(42, args[2]);
        assertEquals("cid", args[3]);
        assertEquals("initiator", args[4]);
        assertEquals("video", args[5]);
    }

    @Test
    public void buildBridge_returnsNonNullBridge() {
        // Cheap sanity check: the factory should always produce a
        // bridge, even if the sender is a no-op. Useful as a smoke
        // test for refactors of buildBridge itself.
        NativeVoiceCallManager.MessagingBridge bridge =
            VoiceCallForegroundService.buildBridge(new RecordingSender());
        assertNotNull(bridge);
        // And every method should be safe to call without throwing
        // (no method on the bridge does anything other than forward).
        bridge.sendOffer("a", "b", "c", "voice");
        bridge.sendAnswer("a", "b", "c");
        bridge.sendIce("a", "b", "c", "d", 1);
        bridge.sendHangup("a", "b", "c");
        bridge.sendReject("a", "b");
        bridge.sendRenegotiate("a", "b", "c");
        bridge.sendCallHistoryRumor("a", "b", 0, "c", "d", "voice");
        assertTrue(true); // reached without exception
    }
}
