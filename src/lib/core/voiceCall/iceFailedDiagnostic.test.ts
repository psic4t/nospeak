import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
    redactAddress,
    buildIceFailedRecords,
    dumpIceFailedStats
} from './iceFailedDiagnostic';

describe('redactAddress', () => {
    it('redacts IPv4 to /24', () => {
        expect(redactAddress('192.168.1.42')).toBe('192.168.1.0/24');
        expect(redactAddress('10.0.0.1')).toBe('10.0.0.0/24');
        expect(redactAddress('203.0.113.255')).toBe('203.0.113.0/24');
    });

    it('redacts IPv6 to /64 (full form)', () => {
        expect(
            redactAddress('2001:db8:abcd:1234:5678:90ab:cdef:1234')
        ).toBe('2001:db8:abcd:1234::/64');
    });

    it('redacts IPv6 to /64 (zero-compressed form)', () => {
        expect(redactAddress('2001:db8::1')).toBe('2001:db8:0:0::/64');
        expect(redactAddress('fe80::1234')).toBe('fe80:0:0:0::/64');
    });

    it('returns "unknown" for empty / null / undefined', () => {
        expect(redactAddress('')).toBe('unknown');
        expect(redactAddress(null)).toBe('unknown');
        expect(redactAddress(undefined)).toBe('unknown');
    });

    it('returns "unknown" for hostnames / mDNS / unparseable', () => {
        expect(redactAddress('foo.local')).toBe('unknown');
        expect(redactAddress('garbage')).toBe('unknown');
        expect(redactAddress('999.999.999.999')).toBe('unknown'); // invalid IPv4 still matches the regex shape — let's confirm behavior below.
    });
});

// Build a minimal RTCStatsReport-compatible Map for tests.
function makeStatsReport(stats: Array<Record<string, unknown>>): RTCStatsReport {
    const map = new Map<string, Record<string, unknown>>();
    for (const s of stats) {
        map.set(s.id as string, s);
    }
    // RTCStatsReport.forEach must take a callback (value, key, map).
    const report = {
        forEach: (cb: (v: unknown, k: string, m: Map<string, unknown>) => void) => {
            map.forEach((v, k) => cb(v, k, map as Map<string, unknown>));
        },
        size: map.size
    } as unknown as RTCStatsReport;
    return report;
}

describe('buildIceFailedRecords', () => {
    it('joins candidate-pair rows with their local and remote candidates', () => {
        const report = makeStatsReport([
            {
                id: 'local-host',
                type: 'local-candidate',
                candidateType: 'host',
                address: '192.168.1.42'
            },
            {
                id: 'remote-srflx',
                type: 'remote-candidate',
                candidateType: 'srflx',
                address: '203.0.113.7'
            },
            {
                id: 'pair-1',
                type: 'candidate-pair',
                state: 'failed',
                nominated: false,
                localCandidateId: 'local-host',
                remoteCandidateId: 'remote-srflx'
            }
        ]);
        const records = buildIceFailedRecords(report);
        expect(records).toHaveLength(1);
        expect(records[0]).toEqual({
            pairId: 'pair-1',
            state: 'failed',
            nominated: false,
            local: { type: 'host', address: '192.168.1.0/24' },
            remote: { type: 'srflx', address: '203.0.113.0/24' }
        });
    });

    it('puts nominated pairs first', () => {
        const report = makeStatsReport([
            {
                id: 'pair-not-nominated',
                type: 'candidate-pair',
                state: 'in-progress',
                nominated: false
            },
            {
                id: 'pair-nominated',
                type: 'candidate-pair',
                state: 'failed',
                nominated: true
            }
        ]);
        const records = buildIceFailedRecords(report);
        expect(records[0].pairId).toBe('pair-nominated');
        expect(records[1].pairId).toBe('pair-not-nominated');
    });

    it('returns empty array when there are no candidate pairs', () => {
        const report = makeStatsReport([
            { id: 'x', type: 'transport' }
        ]);
        expect(buildIceFailedRecords(report)).toEqual([]);
    });

    it('falls back to "unknown" when local/remote candidates are missing', () => {
        const report = makeStatsReport([
            {
                id: 'pair-orphan',
                type: 'candidate-pair',
                state: 'failed',
                nominated: false,
                localCandidateId: 'missing-local',
                remoteCandidateId: 'missing-remote'
            }
        ]);
        const records = buildIceFailedRecords(report);
        expect(records[0].local).toEqual({ type: 'unknown', address: 'unknown' });
        expect(records[0].remote).toEqual({ type: 'unknown', address: 'unknown' });
    });
});

describe('dumpIceFailedStats', () => {
    let infoSpy: ReturnType<typeof vi.spyOn>;
    let warnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
        warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    it('logs one [VoiceCallIceFailed] line per candidate pair', async () => {
        const report = makeStatsReport([
            {
                id: 'local',
                type: 'local-candidate',
                candidateType: 'host',
                address: '10.0.0.1'
            },
            {
                id: 'remote',
                type: 'remote-candidate',
                candidateType: 'relay',
                address: '203.0.113.1'
            },
            {
                id: 'pair',
                type: 'candidate-pair',
                state: 'failed',
                nominated: true,
                localCandidateId: 'local',
                remoteCandidateId: 'remote'
            }
        ]);
        const pc = {
            getStats: vi.fn().mockResolvedValue(report)
        } as unknown as RTCPeerConnection;
        await dumpIceFailedStats(pc);
        expect(infoSpy).toHaveBeenCalledTimes(1);
        const [tag, payload] = infoSpy.mock.calls[0];
        expect(tag).toBe('[VoiceCallIceFailed]');
        const parsed = JSON.parse(payload);
        expect(parsed.pairId).toBe('pair');
        expect(parsed.state).toBe('failed');
        expect(parsed.nominated).toBe(true);
        expect(parsed.local).toEqual({ type: 'host', address: '10.0.0.0/24' });
        expect(parsed.remote).toEqual({ type: 'relay', address: '203.0.113.0/24' });
    });

    it('logs a pairs=0 note when getStats returns no pairs', async () => {
        const report = makeStatsReport([]);
        const pc = {
            getStats: vi.fn().mockResolvedValue(report)
        } as unknown as RTCPeerConnection;
        await dumpIceFailedStats(pc);
        expect(infoSpy).toHaveBeenCalledWith('[VoiceCallIceFailed]', '{"pairs":0}');
    });

    it('logs a no-peer-connection note when pc is null', async () => {
        await dumpIceFailedStats(null);
        expect(infoSpy).toHaveBeenCalledWith(
            '[VoiceCallIceFailed]',
            '{"pairs":0,"note":"no peer connection"}'
        );
    });

    it('swallows getStats failures and does NOT throw', async () => {
        const pc = {
            getStats: vi.fn().mockRejectedValue(new Error('boom'))
        } as unknown as RTCPeerConnection;
        await expect(dumpIceFailedStats(pc)).resolves.toBeUndefined();
        expect(warnSpy).toHaveBeenCalled();
        const [tag] = warnSpy.mock.calls[0];
        expect(tag).toBe('[VoiceCallIceFailedDumpError]');
    });

    it('swallows synchronous getStats throws and does NOT throw', async () => {
        const pc = {
            getStats: vi.fn().mockImplementation(() => {
                throw new Error('sync boom');
            })
        } as unknown as RTCPeerConnection;
        await expect(dumpIceFailedStats(pc)).resolves.toBeUndefined();
        expect(warnSpy).toHaveBeenCalled();
    });
});
