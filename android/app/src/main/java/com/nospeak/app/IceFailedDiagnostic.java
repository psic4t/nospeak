package com.nospeak.app;

import android.util.Log;

import org.webrtc.RTCStats;
import org.webrtc.RTCStatsReport;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * ICE-failed diagnostic dump for the Android native call manager.
 * Symmetric with the JS-side {@code iceFailedDiagnostic.ts}: emits
 * one {@code [VoiceCallIceFailed]} log line per
 * {@code RTCIceCandidatePair} with redacted local/remote addresses so
 * support reports include the NAT-traversal context needed to
 * diagnose connection failures.
 *
 * <p>Wire-equivalent log schema (JS and Android emit byte-comparable
 * JSON content for the same input):
 *
 * <pre>
 * [VoiceCallIceFailed] {"pairId":"...","state":"failed","nominated":false,
 *   "local":{"type":"host","address":"192.168.1.0/24"},
 *   "remote":{"type":"srflx","address":"203.0.113.0/24"}}
 * </pre>
 *
 * <p>Addresses redacted to IPv4 /24 or IPv6 /64. Hostnames /
 * mDNS-style identifiers / unparseable input become the literal
 * {@code "unknown"} so log uploads don't leak user IPs while
 * preserving the diagnostic value of "host vs srflx vs prflx vs relay".
 *
 * <p>Pure-Java parsing functions are public/static for unit testing
 * via {@code IceFailedDiagnosticTest}.
 *
 * <p>Part of {@code fix-android-ice-servers-from-runtime-config}.
 */
public final class IceFailedDiagnostic {

    public static final String LOG_TAG = "VoiceCallIceFailed";
    public static final String ERR_TAG = "VoiceCallIceFailedDumpErr";

    private IceFailedDiagnostic() {
        // Static utility class.
    }

    /**
     * Holder for a single candidate-pair record after candidate joins
     * are resolved.
     */
    public static final class PairRecord {
        public final String pairId;
        public final String state;
        public final boolean nominated;
        public final String localType;
        public final String localAddress;
        public final String remoteType;
        public final String remoteAddress;

        public PairRecord(String pairId, String state, boolean nominated,
                String localType, String localAddress,
                String remoteType, String remoteAddress) {
            this.pairId = pairId;
            this.state = state;
            this.nominated = nominated;
            this.localType = localType;
            this.localAddress = localAddress;
            this.remoteType = remoteType;
            this.remoteAddress = remoteAddress;
        }

        /**
         * Serialize to the {@code [VoiceCallIceFailed]} log-line
         * payload. The output is a hand-built JSON string (no
         * {@code org.json} dependency) so this method works
         * unmodified inside JVM unit tests where
         * {@code returnDefaultValues = true} stubs out
         * {@code org.json}.
         */
        public String toLogPayload() {
            StringBuilder sb = new StringBuilder(160);
            sb.append("{\"pairId\":");
            appendJsonString(sb, pairId);
            sb.append(",\"state\":");
            appendJsonString(sb, state);
            sb.append(",\"nominated\":").append(nominated);
            sb.append(",\"local\":{\"type\":");
            appendJsonString(sb, localType);
            sb.append(",\"address\":");
            appendJsonString(sb, localAddress);
            sb.append("},\"remote\":{\"type\":");
            appendJsonString(sb, remoteType);
            sb.append(",\"address\":");
            appendJsonString(sb, remoteAddress);
            sb.append("}}");
            return sb.toString();
        }

        private static void appendJsonString(StringBuilder sb, String value) {
            if (value == null) {
                sb.append("null");
                return;
            }
            sb.append('"');
            for (int i = 0; i < value.length(); i++) {
                char c = value.charAt(i);
                switch (c) {
                    case '\\': sb.append("\\\\"); break;
                    case '"':  sb.append("\\\""); break;
                    case '\n': sb.append("\\n"); break;
                    case '\r': sb.append("\\r"); break;
                    case '\t': sb.append("\\t"); break;
                    default:
                        if (c < 0x20) {
                            sb.append(String.format("\\u%04x", (int) c));
                        } else {
                            sb.append(c);
                        }
                }
            }
            sb.append('"');
        }
    }

    /**
     * Redact an IP address to its network prefix.
     * <ul>
     *   <li>IPv4 → /24 (e.g. {@code 192.168.1.42} → {@code 192.168.1.0/24})</li>
     *   <li>IPv6 → /64 (first 4 hextets, zero-expanded)</li>
     *   <li>null / empty / hostnames / unparseable → {@code "unknown"}</li>
     * </ul>
     */
    public static String redactAddress(String addr) {
        if (addr == null || addr.isEmpty()) {
            return "unknown";
        }
        if (addr.indexOf(':') < 0) {
            // Possibly IPv4.
            if (!addr.matches("^\\d{1,3}(\\.\\d{1,3}){3}$")) {
                return "unknown";
            }
            String[] parts = addr.split("\\.");
            try {
                for (String p : parts) {
                    int v = Integer.parseInt(p);
                    if (v < 0 || v > 255) return "unknown";
                }
            } catch (NumberFormatException e) {
                return "unknown";
            }
            return parts[0] + "." + parts[1] + "." + parts[2] + ".0/24";
        }

        // IPv6.
        int doubleColon = addr.indexOf("::");
        String leftRaw, rightRaw;
        if (doubleColon >= 0) {
            leftRaw = addr.substring(0, doubleColon);
            rightRaw = addr.substring(doubleColon + 2);
        } else {
            leftRaw = addr;
            rightRaw = "";
        }
        String[] left = leftRaw.isEmpty() ? new String[0] : leftRaw.split(":");
        String[] right = rightRaw.isEmpty() ? new String[0] : rightRaw.split(":");
        if (left.length + right.length == 0) {
            return "unknown";
        }
        for (String h : left) {
            if (!h.matches("^[0-9a-fA-F]{1,4}$")) return "unknown";
        }
        for (String h : right) {
            if (!h.matches("^[0-9a-fA-F]{1,4}$")) return "unknown";
        }
        // First 4 hextets, with zero-compression expanded.
        int totalHextets = 8;
        int missing = totalHextets - left.length - right.length;
        if (missing < 0) return "unknown";
        List<String> prefix = new ArrayList<>(4);
        int idx = 0;
        while (prefix.size() < 4 && idx < left.length) {
            prefix.add(left[idx]);
            idx++;
        }
        for (int i = 0; i < missing && prefix.size() < 4; i++) {
            prefix.add("0");
        }
        int rIdx = 0;
        while (prefix.size() < 4 && rIdx < right.length) {
            prefix.add(right[rIdx]);
            rIdx++;
        }
        while (prefix.size() < 4) prefix.add("0");
        StringBuilder out = new StringBuilder();
        for (int i = 0; i < prefix.size(); i++) {
            if (i > 0) out.append(':');
            out.append(prefix.get(i));
        }
        out.append("::/64");
        return out.toString();
    }

    /**
     * Build the candidate-pair records list from an
     * {@link RTCStatsReport}. Sorted with nominated pairs first.
     *
     * <p>The stats keys ({@code "id"}, {@code "type"}, {@code "state"},
     * {@code "nominated"}, {@code "localCandidateId"},
     * {@code "remoteCandidateId"}, {@code "candidateType"},
     * {@code "address"}) match the
     * {@link RTCStats#getMembers()} attribute names emitted by
     * {@code stream-webrtc-android} for the
     * {@code "candidate-pair" / "local-candidate" / "remote-candidate"}
     * types, which themselves mirror the W3C WebRTC stats spec.
     */
    public static List<PairRecord> buildRecords(RTCStatsReport report) {
        if (report == null) {
            return Collections.emptyList();
        }
        Map<String, RTCStats> all = report.getStatsMap();
        if (all == null || all.isEmpty()) {
            return Collections.emptyList();
        }
        List<RTCStats> pairs = new ArrayList<>();
        Map<String, RTCStats> candidates = new HashMap<>();
        for (RTCStats s : all.values()) {
            String t = s.getType();
            if ("candidate-pair".equals(t)) {
                pairs.add(s);
            } else if ("local-candidate".equals(t) || "remote-candidate".equals(t)) {
                candidates.put(s.getId(), s);
            }
        }
        // Sort nominated first (descending nominated flag).
        pairs.sort((a, b) -> {
            boolean an = boolValue(a.getMembers().get("nominated"));
            boolean bn = boolValue(b.getMembers().get("nominated"));
            return Boolean.compare(bn, an);
        });
        List<PairRecord> out = new ArrayList<>(pairs.size());
        for (RTCStats pair : pairs) {
            Map<String, Object> m = pair.getMembers();
            String pairId = pair.getId();
            String state = stringValue(m.get("state"), "unknown");
            boolean nominated = boolValue(m.get("nominated"));
            String localId = stringValue(m.get("localCandidateId"), null);
            String remoteId = stringValue(m.get("remoteCandidateId"), null);

            RTCStats local = localId != null ? candidates.get(localId) : null;
            RTCStats remote = remoteId != null ? candidates.get(remoteId) : null;

            String localType = local != null
                ? stringValue(local.getMembers().get("candidateType"), "unknown")
                : "unknown";
            String localAddress = local != null
                ? redactAddress(stringValue(local.getMembers().get("address"), null))
                : "unknown";
            String remoteType = remote != null
                ? stringValue(remote.getMembers().get("candidateType"), "unknown")
                : "unknown";
            String remoteAddress = remote != null
                ? redactAddress(stringValue(remote.getMembers().get("address"), null))
                : "unknown";

            out.add(new PairRecord(pairId, state, nominated,
                localType, localAddress, remoteType, remoteAddress));
        }
        return out;
    }

    /**
     * Dump the records to {@code Log.i(LOG_TAG, ...)}, one line per
     * pair. Errors are caught and logged under {@code ERR_TAG} so they
     * never propagate to the caller.
     */
    public static void dump(RTCStatsReport report) {
        try {
            List<PairRecord> records = buildRecords(report);
            if (records.isEmpty()) {
                Log.i(LOG_TAG, "{\"pairs\":0}");
                return;
            }
            for (PairRecord r : records) {
                Log.i(LOG_TAG, r.toLogPayload());
            }
        } catch (Throwable t) {
            Log.w(ERR_TAG, "dump failed", t);
        }
    }

    private static String stringValue(Object obj, String fallback) {
        if (obj == null) return fallback;
        if (obj instanceof String) return (String) obj;
        return obj.toString();
    }

    private static boolean boolValue(Object obj) {
        if (obj instanceof Boolean) return (Boolean) obj;
        return false;
    }
}
