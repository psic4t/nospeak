package com.nospeak.app;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Pure-Java pre-session ICE candidate buffer for the native NIP-AC
 * receive path. Part of the {@code fix-android-nip-ac-compliance-gaps}
 * OpenSpec change.
 *
 * <p>NIP-AC §"ICE Candidate Buffering" requires two layers of
 * buffering. The web build implements both in
 * {@code VoiceCallService.ts}. The Android native build implements
 * the per-session buffer inside {@code NativeVoiceCallManager}; this
 * class is the missing global buffer keyed by sender pubkey, used
 * when no {@code NativeVoiceCallManager} exists yet for a peer
 * (typically: an offer is ringing on the lockscreen and the user
 * has not yet accepted, so trickle ICE candidates from the caller
 * arrive with nowhere to go).
 *
 * <h3>Capacity policy</h3>
 * <ul>
 *   <li>Per-sender FIFO cap: {@link #PER_SENDER_CAP}. On overflow,
 *       the oldest candidate for that sender is evicted.</li>
 *   <li>Total sender cap: {@link #TOTAL_SENDER_CAP}. On overflow,
 *       the least-recently-used sender bucket is dropped wholesale.</li>
 *   <li>TTL: {@link #TTL_MS} milliseconds, matching
 *       {@code NIP_AC_STALENESS_SECONDS}. Stale entries are evicted
 *       opportunistically on {@link #add} and {@link #drain}.</li>
 * </ul>
 *
 * <h3>Threading</h3>
 * The Android receive path and the FGS bootstrap path can call into
 * this class concurrently from different threads. All mutating
 * methods are {@code synchronized} on the instance. The lock is held
 * only for in-memory work and is uncontended in practice.
 */
public final class GlobalIceBuffer {

    /** Per-sender FIFO cap. ICE trickle for one peer rarely exceeds 10–15. */
    public static final int PER_SENDER_CAP = 32;
    /** Total cap on distinct sender pubkeys. Bounds memory under attack. */
    public static final int TOTAL_SENDER_CAP = 256;
    /** Per-entry TTL in milliseconds, matching the NIP-AC staleness window. */
    public static final long TTL_MS = 60_000L;

    /**
     * One ICE candidate the receive path has decoded but cannot yet
     * apply because no {@link NativeVoiceCallManager} exists.
     */
    public static final class IceCandidatePayload {
        public final String candidate;
        public final String sdpMid;
        public final Integer sdpMLineIndex;
        public final long receivedAtMs;

        public IceCandidatePayload(
                String candidate,
                String sdpMid,
                Integer sdpMLineIndex,
                long receivedAtMs) {
            this.candidate = candidate;
            this.sdpMid = sdpMid;
            this.sdpMLineIndex = sdpMLineIndex;
            this.receivedAtMs = receivedAtMs;
        }
    }

    /**
     * Per-sender FIFO buckets. {@link LinkedHashMap} with access-order
     * iteration so the LRU bucket is at the head when total-sender cap
     * is exceeded. Keys are lowercase hex pubkeys.
     */
    private final LinkedHashMap<String, Deque<IceCandidatePayload>> bySender =
        new LinkedHashMap<>(16, 0.75f, /* accessOrder= */ true);

    /**
     * Append an ICE candidate to the per-sender FIFO. Evicts stale
     * entries (older than {@link #TTL_MS}) before insertion. If the
     * per-sender FIFO would exceed {@link #PER_SENDER_CAP}, drops the
     * oldest entry. If insertion would push the total sender count
     * over {@link #TOTAL_SENDER_CAP}, drops the least-recently-used
     * sender bucket entirely.
     *
     * @param senderHex  lowercase hex pubkey of the inner-event author
     * @param payload    decoded candidate
     * @param nowMs      current wall-clock time in ms (caller-supplied
     *                   for testability; production passes
     *                   {@code System.currentTimeMillis()})
     */
    public synchronized void add(String senderHex, IceCandidatePayload payload, long nowMs) {
        if (senderHex == null || senderHex.isEmpty() || payload == null) return;
        String key = senderHex.toLowerCase();

        // Opportunistic stale eviction across all buckets. Cheap when
        // buffers are small; bounded by TOTAL_SENDER_CAP × PER_SENDER_CAP.
        evictStale(nowMs);

        Deque<IceCandidatePayload> bucket = bySender.get(key);
        if (bucket == null) {
            // Total-sender cap: evict LRU bucket if necessary BEFORE
            // creating the new one, so we never briefly exceed the cap.
            if (bySender.size() >= TOTAL_SENDER_CAP) {
                Iterator<Map.Entry<String, Deque<IceCandidatePayload>>> it =
                    bySender.entrySet().iterator();
                if (it.hasNext()) {
                    it.next();
                    it.remove();
                }
            }
            bucket = new ArrayDeque<>();
            bySender.put(key, bucket);
        }

        // Per-sender cap: drop oldest if we'd exceed.
        while (bucket.size() >= PER_SENDER_CAP) {
            bucket.pollFirst();
        }
        bucket.addLast(payload);
    }

    /**
     * Drain and remove the per-sender bucket for {@code senderHex}.
     * Stale entries (older than {@link #TTL_MS}) are silently dropped
     * during the drain. Returned list preserves insertion (FIFO)
     * order. Returns an empty list when no bucket exists.
     */
    public synchronized List<IceCandidatePayload> drain(String senderHex, long nowMs) {
        if (senderHex == null || senderHex.isEmpty()) return new ArrayList<>();
        Deque<IceCandidatePayload> bucket = bySender.remove(senderHex.toLowerCase());
        if (bucket == null) return new ArrayList<>();
        List<IceCandidatePayload> out = new ArrayList<>(bucket.size());
        for (IceCandidatePayload p : bucket) {
            if (nowMs - p.receivedAtMs <= TTL_MS) {
                out.add(p);
            }
        }
        return out;
    }

    /**
     * Drop all buffered candidates. Called when the messaging service
     * shuts down so a long-running app doesn't leak buffer entries
     * across messaging-service restarts.
     */
    public synchronized void clearAll() {
        bySender.clear();
    }

    /**
     * Test-only accessor: number of distinct sender buckets currently
     * held. Not part of the production API.
     */
    public synchronized int senderCountForTest() {
        return bySender.size();
    }

    /**
     * Test-only accessor: number of candidates buffered for a given
     * sender (or 0 if no bucket exists).
     */
    public synchronized int candidateCountForSenderForTest(String senderHex) {
        if (senderHex == null) return 0;
        Deque<IceCandidatePayload> bucket = bySender.get(senderHex.toLowerCase());
        return bucket == null ? 0 : bucket.size();
    }

    /** Drop entries whose age exceeds {@link #TTL_MS}. */
    private void evictStale(long nowMs) {
        Iterator<Map.Entry<String, Deque<IceCandidatePayload>>> it =
            bySender.entrySet().iterator();
        while (it.hasNext()) {
            Map.Entry<String, Deque<IceCandidatePayload>> entry = it.next();
            Deque<IceCandidatePayload> bucket = entry.getValue();
            // Drop stale entries from the front (oldest).
            while (!bucket.isEmpty()) {
                IceCandidatePayload head = bucket.peekFirst();
                if (head == null || nowMs - head.receivedAtMs > TTL_MS) {
                    bucket.pollFirst();
                } else {
                    break;
                }
            }
            if (bucket.isEmpty()) {
                it.remove();
            }
        }
    }
}
