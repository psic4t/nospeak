package com.nospeak.app;

import org.junit.Test;
import org.webrtc.RTCStats;
import org.webrtc.RTCStatsReport;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

/**
 * Unit tests for {@link IceFailedDiagnostic}. Validates the redaction
 * logic and the candidate-pair join + sort, and confirms that the
 * payload serializer produces JSON byte-compatible with the JS-side
 * {@code iceFailedDiagnostic.ts} for the same logical inputs.
 *
 * <p>Part of the {@code fix-android-ice-servers-from-runtime-config}
 * OpenSpec change.
 */
public class IceFailedDiagnosticTest {

    // -----------------------------------------------------------------
    //  redactAddress
    // -----------------------------------------------------------------

    @Test
    public void redactsIPv4To24() {
        assertEquals("192.168.1.0/24", IceFailedDiagnostic.redactAddress("192.168.1.42"));
        assertEquals("10.0.0.0/24", IceFailedDiagnostic.redactAddress("10.0.0.1"));
        assertEquals("203.0.113.0/24", IceFailedDiagnostic.redactAddress("203.0.113.255"));
    }

    @Test
    public void redactsFullIPv6To64() {
        assertEquals(
            "2001:db8:abcd:1234::/64",
            IceFailedDiagnostic.redactAddress("2001:db8:abcd:1234:5678:90ab:cdef:1234")
        );
    }

    @Test
    public void redactsCompressedIPv6To64() {
        assertEquals("2001:db8:0:0::/64", IceFailedDiagnostic.redactAddress("2001:db8::1"));
        assertEquals("fe80:0:0:0::/64", IceFailedDiagnostic.redactAddress("fe80::1234"));
    }

    @Test
    public void unknownForNullOrEmpty() {
        assertEquals("unknown", IceFailedDiagnostic.redactAddress(null));
        assertEquals("unknown", IceFailedDiagnostic.redactAddress(""));
    }

    @Test
    public void unknownForHostnameOrGarbage() {
        assertEquals("unknown", IceFailedDiagnostic.redactAddress("foo.local"));
        assertEquals("unknown", IceFailedDiagnostic.redactAddress("garbage"));
        assertEquals("unknown", IceFailedDiagnostic.redactAddress("999.999.999.999"));
    }

    // -----------------------------------------------------------------
    //  buildRecords
    // -----------------------------------------------------------------

    private static RTCStats makeCandidate(
            String id, String type, String candidateType, String address) {
        Map<String, Object> members = new HashMap<>();
        members.put("candidateType", candidateType);
        members.put("address", address);
        return new RTCStats(0L, type, id, members);
    }

    private static RTCStats makePair(
            String id, String state, boolean nominated,
            String localId, String remoteId) {
        Map<String, Object> members = new HashMap<>();
        members.put("state", state);
        members.put("nominated", nominated);
        if (localId != null) members.put("localCandidateId", localId);
        if (remoteId != null) members.put("remoteCandidateId", remoteId);
        return new RTCStats(0L, "candidate-pair", id, members);
    }

    private static RTCStatsReport makeReport(RTCStats... stats) {
        // LinkedHashMap to keep iteration order stable across JDKs.
        Map<String, RTCStats> map = new LinkedHashMap<>();
        for (RTCStats s : stats) {
            map.put(s.getId(), s);
        }
        return new RTCStatsReport(0L, map);
    }

    @Test
    public void joinsCandidatePairsWithCandidates() {
        RTCStatsReport report = makeReport(
            makeCandidate("local-host", "local-candidate", "host", "192.168.1.42"),
            makeCandidate("remote-srflx", "remote-candidate", "srflx", "203.0.113.7"),
            makePair("pair-1", "failed", false, "local-host", "remote-srflx")
        );
        List<IceFailedDiagnostic.PairRecord> recs = IceFailedDiagnostic.buildRecords(report);
        assertEquals(1, recs.size());
        IceFailedDiagnostic.PairRecord r = recs.get(0);
        assertEquals("pair-1", r.pairId);
        assertEquals("failed", r.state);
        assertFalse(r.nominated);
        assertEquals("host", r.localType);
        assertEquals("192.168.1.0/24", r.localAddress);
        assertEquals("srflx", r.remoteType);
        assertEquals("203.0.113.0/24", r.remoteAddress);
    }

    @Test
    public void nominatedPairsAppearFirst() {
        RTCStatsReport report = makeReport(
            makePair("pair-not-nominated", "in-progress", false, null, null),
            makePair("pair-nominated", "failed", true, null, null)
        );
        List<IceFailedDiagnostic.PairRecord> recs = IceFailedDiagnostic.buildRecords(report);
        assertEquals(2, recs.size());
        assertEquals("pair-nominated", recs.get(0).pairId);
        assertEquals("pair-not-nominated", recs.get(1).pairId);
    }

    @Test
    public void unknownWhenCandidatesMissing() {
        RTCStatsReport report = makeReport(
            makePair("orphan", "failed", false, "missing-local", "missing-remote")
        );
        List<IceFailedDiagnostic.PairRecord> recs = IceFailedDiagnostic.buildRecords(report);
        assertEquals(1, recs.size());
        IceFailedDiagnostic.PairRecord r = recs.get(0);
        assertEquals("unknown", r.localType);
        assertEquals("unknown", r.localAddress);
        assertEquals("unknown", r.remoteType);
        assertEquals("unknown", r.remoteAddress);
    }

    @Test
    public void emptyReportProducesEmptyList() {
        RTCStatsReport report = makeReport();
        assertTrue(IceFailedDiagnostic.buildRecords(report).isEmpty());
    }

    @Test
    public void nullReportProducesEmptyList() {
        assertTrue(IceFailedDiagnostic.buildRecords(null).isEmpty());
    }

    // -----------------------------------------------------------------
    //  toLogPayload — verify JSON serialization stays compatible with
    //  the JS diagnostic format.
    // -----------------------------------------------------------------

    @Test
    public void logPayloadShapeMatchesSpec() {
        IceFailedDiagnostic.PairRecord r = new IceFailedDiagnostic.PairRecord(
            "pair-1",
            "failed",
            true,
            "host",
            "192.168.1.0/24",
            "relay",
            "203.0.113.0/24"
        );
        String payload = r.toLogPayload();
        // Byte-equivalent shape to the JS-side schema documented in
        // iceFailedDiagnostic.ts.
        assertEquals(
            "{\"pairId\":\"pair-1\",\"state\":\"failed\",\"nominated\":true,"
            + "\"local\":{\"type\":\"host\",\"address\":\"192.168.1.0/24\"},"
            + "\"remote\":{\"type\":\"relay\",\"address\":\"203.0.113.0/24\"}}",
            payload
        );
    }

    @Test
    public void logPayloadEscapesQuotesAndBackslashes() {
        IceFailedDiagnostic.PairRecord r = new IceFailedDiagnostic.PairRecord(
            "id-with-\"quotes\"-and-\\back",
            "ok",
            false,
            "host",
            "0.0.0.0/24",
            "host",
            "0.0.0.0/24"
        );
        String payload = r.toLogPayload();
        // The pairId is the only field that can contain user-shaped
        // content; assert it round-trips through JSON-string escaping.
        assertTrue(payload.contains("\\\"quotes\\\""));
        assertTrue(payload.contains("\\\\back"));
    }
}
