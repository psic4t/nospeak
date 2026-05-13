/**
 * ICE-failed diagnostic dump. Invoked when a voice or video call
 * transitions to {@code ended} with reason {@code ice-failed} so that
 * support reports include the candidate-pair statistics needed to
 * diagnose NAT / TURN issues without requiring a remote debug session.
 *
 * Emits one structured log line per candidate pair under the
 * {@code VoiceCallIceFailed} log tag. Schema:
 *
 * <pre>
 * [VoiceCallIceFailed] {"pairId":"...","state":"failed","nominated":false,
 *   "local":{"type":"host","address":"192.168.1.0/24"},
 *   "remote":{"type":"srflx","address":"203.0.113.0/24"}}
 * </pre>
 *
 * Addresses are redacted to IPv4 /24 or IPv6 /64 to avoid leaking user
 * IPs in support logs while preserving the diagnostic value of
 * "host vs srflx vs prflx vs relay" routing.
 *
 * Best-effort: every operation is wrapped in try/catch so a failure in
 * the diagnostic path NEVER affects call teardown.
 *
 * Part of {@code fix-android-ice-servers-from-runtime-config}.
 */

export interface IceFailedPairRecord {
    pairId: string;
    state: string;
    nominated: boolean;
    local: {
        type: string;
        address: string;
    };
    remote: {
        type: string;
        address: string;
    };
}

const LOG_TAG = '[VoiceCallIceFailed]';

/**
 * Redact a candidate IP address to its network prefix
 * (IPv4 /24, IPv6 /64). Returns the literal string {@code "unknown"}
 * for null / empty / unparseable input.
 *
 * Exported for unit tests.
 */
export function redactAddress(addr: string | null | undefined): string {
    if (!addr || typeof addr !== 'string' || addr.length === 0) {
        return 'unknown';
    }
    // IPv4 detection: 4 dot-separated decimal octets, no colons. Each
    // octet is bounded to 0-255 so we reject "999.999.999.999" rather
    // than report a bogus /24.
    if (!addr.includes(':') && /^\d{1,3}(\.\d{1,3}){3}$/.test(addr)) {
        const parts = addr.split('.');
        if (parts.every((p) => Number(p) >= 0 && Number(p) <= 255)) {
            return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
        }
        return 'unknown';
    }
    // IPv6 detection: contains at least one colon. Normalize by
    // expanding the first 64 bits and dropping the rest. We keep the
    // first 4 hextets (16 bits each = 64 bits total).
    if (addr.includes(':')) {
        // Split on '::' to handle the zero-compressed form. Both sides
        // are arrays of hextets.
        const [leftRaw, rightRaw] = addr.includes('::')
            ? addr.split('::')
            : [addr, ''];
        const left = leftRaw.length > 0 ? leftRaw.split(':') : [];
        const right = rightRaw.length > 0 ? rightRaw.split(':') : [];
        // Reject obvious garbage (no hextets at all, or a hextet that
        // isn't valid hex).
        const allHextets = [...left, ...right];
        if (allHextets.length === 0) return 'unknown';
        for (const h of allHextets) {
            if (!/^[0-9a-fA-F]{1,4}$/.test(h)) return 'unknown';
        }
        // We only need the first 4 hextets; the zero-compression rule
        // means missing hextets on the left are zeros.
        const totalHextets = 8;
        const missing = totalHextets - left.length - right.length;
        const prefixHextets: string[] = [];
        let idx = 0;
        while (prefixHextets.length < 4 && idx < left.length) {
            prefixHextets.push(left[idx]);
            idx++;
        }
        for (let i = 0; i < missing && prefixHextets.length < 4; i++) {
            prefixHextets.push('0');
        }
        let rIdx = 0;
        while (prefixHextets.length < 4 && rIdx < right.length) {
            prefixHextets.push(right[rIdx]);
            rIdx++;
        }
        while (prefixHextets.length < 4) prefixHextets.push('0');
        return `${prefixHextets.join(':')}::/64`;
    }
    // Unknown shape; do not log the literal (it might be a hostname /
    // mDNS .local or other identifying string).
    return 'unknown';
}

/**
 * Convert an {@link RTCStatsReport} into one log entry per ICE
 * candidate pair, sorted by nominated-first to put the diagnostically
 * most-interesting pair first.
 *
 * Exported for unit tests.
 */
// Local structural types for the stats we care about. The TS DOM
// lib's RTCIceCandidatePairStats / RTCIceCandidateStats names are
// inconsistent across lib versions (Node test runners may not have
// them at all), so we use minimal structural aliases here.
interface PairStat {
    id: string;
    type: string;
    state?: string;
    nominated?: boolean;
    localCandidateId?: string;
    remoteCandidateId?: string;
}
interface CandidateStat {
    id: string;
    type: string;
    candidateType?: string;
    address?: string;
}

export function buildIceFailedRecords(report: RTCStatsReport): IceFailedPairRecord[] {
    const pairs: PairStat[] = [];
    const candidatesById = new Map<string, CandidateStat>();
    report.forEach((stat) => {
        const t = (stat as { type?: string }).type;
        if (t === 'candidate-pair') {
            pairs.push(stat as PairStat);
        } else if (t === 'local-candidate' || t === 'remote-candidate') {
            const c = stat as CandidateStat;
            candidatesById.set(c.id, c);
        }
    });
    pairs.sort((a, b) => {
        const aNom = a.nominated ? 1 : 0;
        const bNom = b.nominated ? 1 : 0;
        return bNom - aNom;
    });
    return pairs.map((pair) => {
        const local = pair.localCandidateId
            ? candidatesById.get(pair.localCandidateId)
            : undefined;
        const remote = pair.remoteCandidateId
            ? candidatesById.get(pair.remoteCandidateId)
            : undefined;
        return {
            pairId: pair.id,
            state: String(pair.state ?? 'unknown'),
            nominated: !!pair.nominated,
            local: {
                type: String(local?.candidateType ?? 'unknown'),
                address: redactAddress(local?.address ?? null)
            },
            remote: {
                type: String(remote?.candidateType ?? 'unknown'),
                address: redactAddress(remote?.address ?? null)
            }
        };
    });
}

/**
 * Dump {@code peerConnection.getStats()} as one log line per ICE
 * candidate pair under the {@code VoiceCallIceFailed} tag.
 *
 * <p>Caller owns the peer connection — typically invoked in
 * {@code VoiceCallService.handleIceFailure()} before {@code cleanup()}
 * closes the peer connection. Safe to call after the connection has
 * been closed (the {@code getStats} call may resolve with an empty
 * report).
 *
 * <p>Best-effort. All failures are caught and logged at warn level
 * with a non-{@code VoiceCallIceFailed} tag so they don't pollute
 * the diagnostic stream.
 */
export async function dumpIceFailedStats(
    peerConnection: RTCPeerConnection | null | undefined
): Promise<void> {
    if (!peerConnection) {
        console.info(LOG_TAG, '{"pairs":0,"note":"no peer connection"}');
        return;
    }
    try {
        const report = await peerConnection.getStats();
        const records = buildIceFailedRecords(report);
        if (records.length === 0) {
            console.info(LOG_TAG, '{"pairs":0}');
            return;
        }
        for (const r of records) {
            console.info(LOG_TAG, JSON.stringify(r));
        }
    } catch (err) {
        console.warn('[VoiceCallIceFailedDumpError]', err);
    }
}
