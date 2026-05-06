package com.nospeak.app;

import org.junit.Test;

import java.util.List;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertSame;
import static org.junit.Assert.assertTrue;

/**
 * Unit tests for {@link GlobalIceBuffer}. Part of the
 * {@code fix-android-nip-ac-compliance-gaps} OpenSpec change.
 *
 * <p>Covers NIP-AC §"ICE Candidate Buffering" test vectors that apply
 * to the no-PC-yet phase: B1 (single candidate buffered), B2 (multiple
 * buffered), B3 (drain on session creation), B8 (preserved across
 * ringing→accept), B9 (per-sender isolation), B10 (drain doesn't
 * affect other peers); plus eviction policy tests covering the
 * per-sender cap, total cap, and TTL.
 */
public class GlobalIceBufferTest {

    private static final String ALICE = "11111111111111111111111111111111111111111111111111111111111111aa";
    private static final String CAROL = "22222222222222222222222222222222222222222222222222222222222222cc";

    private static GlobalIceBuffer.IceCandidatePayload p(String c, long now) {
        return new GlobalIceBuffer.IceCandidatePayload(c, "0", 0, now);
    }

    // -------- B1: single candidate buffered --------

    @Test
    public void B1_singleCandidateBuffered() {
        GlobalIceBuffer buf = new GlobalIceBuffer();
        buf.add(ALICE, p("cand1", 1000), 1000);
        assertEquals(1, buf.candidateCountForSenderForTest(ALICE));
    }

    // -------- B2: multiple candidates buffered globally --------

    @Test
    public void B2_multipleBufferedInArrivalOrder() {
        GlobalIceBuffer buf = new GlobalIceBuffer();
        buf.add(ALICE, p("c1", 1000), 1000);
        buf.add(ALICE, p("c2", 1100), 1100);
        buf.add(ALICE, p("c3", 1200), 1200);
        List<GlobalIceBuffer.IceCandidatePayload> drained = buf.drain(ALICE, 1300);
        assertEquals(3, drained.size());
        assertEquals("c1", drained.get(0).candidate);
        assertEquals("c2", drained.get(1).candidate);
        assertEquals("c3", drained.get(2).candidate);
    }

    // -------- B3: drain returns and removes the bucket --------

    @Test
    public void B3_drainEmptiesBucket() {
        GlobalIceBuffer buf = new GlobalIceBuffer();
        buf.add(ALICE, p("c1", 1000), 1000);
        buf.add(ALICE, p("c2", 1100), 1100);
        buf.drain(ALICE, 1200);
        // Subsequent drain returns nothing — bucket is gone.
        assertTrue(buf.drain(ALICE, 1300).isEmpty());
        assertEquals(0, buf.candidateCountForSenderForTest(ALICE));
    }

    // -------- B8: candidates preserved across ringing→accept window --------

    @Test
    public void B8_preservedAcrossRingingToAccept() {
        GlobalIceBuffer buf = new GlobalIceBuffer();
        // Simulate three candidates trickling in during the FSI ringer
        // window over the course of a few seconds.
        buf.add(ALICE, p("c1", 1000), 1000);
        buf.add(ALICE, p("c2", 1500), 1500);
        buf.add(ALICE, p("c3", 2000), 2000);

        // User accepts at t=3000ms; FGS spins up NativeVoiceCallManager
        // which drains the buffer. All three candidates SHALL be
        // retrievable in arrival order.
        List<GlobalIceBuffer.IceCandidatePayload> drained = buf.drain(ALICE, 3000);
        assertEquals(3, drained.size());
        assertEquals("c1", drained.get(0).candidate);
        assertEquals("c2", drained.get(1).candidate);
        assertEquals("c3", drained.get(2).candidate);
    }

    // -------- B9: per-sender isolation --------

    @Test
    public void B9_perSenderIsolation() {
        GlobalIceBuffer buf = new GlobalIceBuffer();
        buf.add(ALICE, p("a1", 1000), 1000);
        buf.add(CAROL, p("c1", 1010), 1010);
        buf.add(ALICE, p("a2", 1020), 1020);

        assertEquals(2, buf.candidateCountForSenderForTest(ALICE));
        assertEquals(1, buf.candidateCountForSenderForTest(CAROL));
        assertEquals(2, buf.senderCountForTest());
    }

    // -------- B10: drain for one peer doesn't affect another --------

    @Test
    public void B10_drainOneDoesNotAffectAnother() {
        GlobalIceBuffer buf = new GlobalIceBuffer();
        buf.add(ALICE, p("a1", 1000), 1000);
        buf.add(ALICE, p("a2", 1100), 1100);
        buf.add(CAROL, p("c1", 1010), 1010);

        buf.drain(ALICE, 1200);

        assertEquals(0, buf.candidateCountForSenderForTest(ALICE));
        assertEquals(1, buf.candidateCountForSenderForTest(CAROL));
        List<GlobalIceBuffer.IceCandidatePayload> carolDrained = buf.drain(CAROL, 1300);
        assertEquals(1, carolDrained.size());
        assertEquals("c1", carolDrained.get(0).candidate);
    }

    // -------- TTL eviction (60s NIP-AC staleness window) --------

    @Test
    public void evictStaleEntriesOnAdd() {
        GlobalIceBuffer buf = new GlobalIceBuffer();
        buf.add(ALICE, p("old", 0), 0); // very old
        // 65s later, add a fresh candidate. Stale entry should be evicted.
        buf.add(CAROL, p("fresh", 65_000), 65_000);
        assertEquals(0, buf.candidateCountForSenderForTest(ALICE));
        assertEquals(1, buf.candidateCountForSenderForTest(CAROL));
    }

    @Test
    public void drainEvictsStaleEntries() {
        GlobalIceBuffer buf = new GlobalIceBuffer();
        // Two candidates: one stale, one fresh.
        buf.add(ALICE, p("stale", 0), 0);
        // Force-add a fresh candidate without triggering a stale-eviction
        // sweep on add by using a now value before TTL elapses.
        buf.add(ALICE, p("fresh", 30_000), 30_000);
        // Drain at t=70_000: stale entry exceeds TTL, fresh one is fine.
        List<GlobalIceBuffer.IceCandidatePayload> drained = buf.drain(ALICE, 70_000);
        assertEquals(1, drained.size());
        assertEquals("fresh", drained.get(0).candidate);
    }

    // -------- Per-sender cap (drop oldest on overflow) --------

    @Test
    public void perSenderCapDropsOldest() {
        GlobalIceBuffer buf = new GlobalIceBuffer();
        long t = 1000;
        for (int i = 0; i < GlobalIceBuffer.PER_SENDER_CAP + 5; i++) {
            buf.add(ALICE, p("c" + i, t + i), t + i);
        }
        // Bucket holds at most PER_SENDER_CAP entries. The first 5 are evicted.
        assertEquals(GlobalIceBuffer.PER_SENDER_CAP,
            buf.candidateCountForSenderForTest(ALICE));
        List<GlobalIceBuffer.IceCandidatePayload> drained = buf.drain(ALICE, t + 100);
        assertEquals(GlobalIceBuffer.PER_SENDER_CAP, drained.size());
        // First retained candidate is c5 (the first 5 evicted are c0..c4).
        assertEquals("c5", drained.get(0).candidate);
    }

    // -------- Total-sender cap (drop LRU bucket on overflow) --------

    @Test
    public void totalSenderCapDropsLeastRecentlyUsed() {
        GlobalIceBuffer buf = new GlobalIceBuffer();
        long now = 1_000_000L; // far enough in the future that t=0 entries don't expire
        // Fill to capacity with TOTAL_SENDER_CAP distinct senders, all
        // close enough in time that none expires.
        for (int i = 0; i < GlobalIceBuffer.TOTAL_SENDER_CAP; i++) {
            String hex = String.format("%064d", i);
            // Stagger times so we have a deterministic LRU ordering.
            buf.add(hex, p("c", now + i), now + i);
        }
        assertEquals(GlobalIceBuffer.TOTAL_SENDER_CAP, buf.senderCountForTest());

        // Add one more sender — the oldest (sender index 0) bucket is evicted.
        String overflow = String.format("%064d", GlobalIceBuffer.TOTAL_SENDER_CAP);
        buf.add(overflow, p("c", now + GlobalIceBuffer.TOTAL_SENDER_CAP),
            now + GlobalIceBuffer.TOTAL_SENDER_CAP);

        assertEquals(GlobalIceBuffer.TOTAL_SENDER_CAP, buf.senderCountForTest());
        // Sender index 0 should be gone.
        String evicted = String.format("%064d", 0);
        assertEquals(0, buf.candidateCountForSenderForTest(evicted));
        // Overflow sender is present.
        assertEquals(1, buf.candidateCountForSenderForTest(overflow));
    }

    // -------- clearAll() --------

    @Test
    public void clearAllDropsEverything() {
        GlobalIceBuffer buf = new GlobalIceBuffer();
        buf.add(ALICE, p("a1", 1000), 1000);
        buf.add(CAROL, p("c1", 1010), 1010);
        buf.clearAll();
        assertEquals(0, buf.senderCountForTest());
        assertTrue(buf.drain(ALICE, 1100).isEmpty());
        assertTrue(buf.drain(CAROL, 1100).isEmpty());
    }

    // -------- Defensive: null/empty inputs --------

    @Test
    public void nullSenderIsNoOp() {
        GlobalIceBuffer buf = new GlobalIceBuffer();
        buf.add(null, p("c", 1000), 1000);
        assertEquals(0, buf.senderCountForTest());
    }

    @Test
    public void nullPayloadIsNoOp() {
        GlobalIceBuffer buf = new GlobalIceBuffer();
        buf.add(ALICE, null, 1000);
        assertEquals(0, buf.senderCountForTest());
    }

    @Test
    public void drainNullSenderReturnsEmpty() {
        GlobalIceBuffer buf = new GlobalIceBuffer();
        buf.add(ALICE, p("c", 1000), 1000);
        assertTrue(buf.drain(null, 1100).isEmpty());
        // Original bucket is untouched.
        assertEquals(1, buf.candidateCountForSenderForTest(ALICE));
    }

    @Test
    public void senderHexIsCaseInsensitive() {
        GlobalIceBuffer buf = new GlobalIceBuffer();
        String hex = "AABBCCDD11223344AABBCCDD11223344AABBCCDD11223344AABBCCDD11223344";
        buf.add(hex, p("c1", 1000), 1000);
        // Drain with the same value but different case must find the bucket.
        List<GlobalIceBuffer.IceCandidatePayload> drained = buf.drain(hex.toLowerCase(), 1100);
        assertEquals(1, drained.size());
    }

    // -------- Reference identity preserved through drain (sanity) --------

    @Test
    public void drainReturnsSamePayloadInstances() {
        GlobalIceBuffer buf = new GlobalIceBuffer();
        GlobalIceBuffer.IceCandidatePayload c = p("c", 1000);
        buf.add(ALICE, c, 1000);
        List<GlobalIceBuffer.IceCandidatePayload> drained = buf.drain(ALICE, 1100);
        assertEquals(1, drained.size());
        assertSame(c, drained.get(0));
    }

    // ------------------------------------------------------------------
    //  Group-aware buffering (add-group-voice-calling).
    //  Buckets are keyed by `(senderHex, groupCallId | null)`. Two
    //  group-call-ids from the same sender MUST NOT collide; 1-on-1
    //  candidates (groupCallId=null) MUST be isolated from group
    //  candidates from the same sender.
    // ------------------------------------------------------------------

    private static final String GROUP_G =
        "7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e";
    private static final String GROUP_H =
        "8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e";

    @Test
    public void groupBucketsForDifferentGroupCallIdsDoNotCollide() {
        GlobalIceBuffer buf = new GlobalIceBuffer();
        buf.add(ALICE, GROUP_G, p("g1c1", 1000), 1000);
        buf.add(ALICE, GROUP_G, p("g1c2", 1001), 1001);
        buf.add(ALICE, GROUP_H, p("g2c1", 1002), 1002);

        assertEquals(2, buf.candidateCountForSenderForTest(ALICE, GROUP_G));
        assertEquals(1, buf.candidateCountForSenderForTest(ALICE, GROUP_H));

        List<GlobalIceBuffer.IceCandidatePayload> drainedG =
            buf.drain(ALICE, GROUP_G, 1100);
        assertEquals(2, drainedG.size());
        assertEquals("g1c1", drainedG.get(0).candidate);
        assertEquals("g1c2", drainedG.get(1).candidate);

        // The G2 bucket is unaffected.
        assertEquals(1, buf.candidateCountForSenderForTest(ALICE, GROUP_H));
        List<GlobalIceBuffer.IceCandidatePayload> drainedH =
            buf.drain(ALICE, GROUP_H, 1100);
        assertEquals(1, drainedH.size());
        assertEquals("g2c1", drainedH.get(0).candidate);
    }

    @Test
    public void oneToOneAndGroupBucketsForSameSenderDoNotCollide() {
        GlobalIceBuffer buf = new GlobalIceBuffer();
        buf.add(ALICE, p("dm1", 1000), 1000); // 1-on-1 (legacy overload)
        buf.add(ALICE, GROUP_G, p("grp1", 1001), 1001);

        // Each is independently drainable.
        assertEquals(1, buf.candidateCountForSenderForTest(ALICE)); // 1-on-1
        assertEquals(1, buf.candidateCountForSenderForTest(ALICE, GROUP_G));

        List<GlobalIceBuffer.IceCandidatePayload> oneOnOne =
            buf.drain(ALICE, 1100);
        assertEquals(1, oneOnOne.size());
        assertEquals("dm1", oneOnOne.get(0).candidate);

        // 1-on-1 drain did not consume the group bucket.
        assertEquals(1, buf.candidateCountForSenderForTest(ALICE, GROUP_G));
        List<GlobalIceBuffer.IceCandidatePayload> grp =
            buf.drain(ALICE, GROUP_G, 1100);
        assertEquals(1, grp.size());
        assertEquals("grp1", grp.get(0).candidate);
    }

    @Test
    public void drainWithMismatchedGroupCallIdReturnsEmpty() {
        GlobalIceBuffer buf = new GlobalIceBuffer();
        buf.add(ALICE, GROUP_G, p("c1", 1000), 1000);
        assertTrue(buf.drain(ALICE, GROUP_H, 1100).isEmpty());
        // Original bucket is untouched.
        assertEquals(1, buf.candidateCountForSenderForTest(ALICE, GROUP_G));
    }

    @Test
    public void groupTtlEvictionIndependentPerBucket() {
        GlobalIceBuffer buf = new GlobalIceBuffer();
        buf.add(ALICE, GROUP_G, p("old", 1000), 1000);
        // Add a fresh candidate well past the TTL window for the older
        // entry; the eviction-on-add scan should drop the stale entry.
        long now = 1000 + GlobalIceBuffer.TTL_MS + 100;
        buf.add(ALICE, GROUP_G, p("fresh", now), now);
        List<GlobalIceBuffer.IceCandidatePayload> drained =
            buf.drain(ALICE, GROUP_G, now);
        assertEquals(1, drained.size());
        assertEquals("fresh", drained.get(0).candidate);
    }
}
