import { describe, expect, it } from 'vitest';

import {
    buildFallbackPeaks,
    clamp01,
    computePeaksFromAudioBuffer,
    downsamplePeaks,
} from './Waveform';

/** Helper to create a fake AudioBuffer from raw sample arrays (one per channel). */
function fakeAudioBuffer(channels: Float32Array[]): AudioBuffer {
    const length = channels[0]?.length ?? 0;
    return {
        numberOfChannels: channels.length,
        length,
        getChannelData(c: number) {
            return channels[c] ?? new Float32Array(0);
        },
    } as unknown as AudioBuffer;
}

describe('Waveform', () => {
    it('clamp01 clamps values', () => {
        expect(clamp01(-1)).toBe(0);
        expect(clamp01(0.5)).toBe(0.5);
        expect(clamp01(2)).toBe(1);
    });

    it('downsamplePeaks returns max per bucket', () => {
        const peaks = [0.1, 0.9, 0.2, 0.3];
        expect(downsamplePeaks(peaks, 2)).toEqual([0.9, 0.3]);
    });

    it('downsamplePeaks upsamples via nearest-neighbour when fewer peaks than bars', () => {
        // 3 peaks → 6 bars: each peak should appear twice
        const peaks = [0.2, 0.8, 0.4];
        const result = downsamplePeaks(peaks, 6);
        expect(result).toHaveLength(6);
        // No bar should be zero — every bar maps to a real peak
        for (const v of result) {
            expect(v).toBeGreaterThan(0);
        }
        // First and last should match source endpoints
        expect(result[0]).toBeCloseTo(0.2, 4);
        expect(result[5]).toBeCloseTo(0.4, 4);
    });

    it('buildFallbackPeaks is deterministic', () => {
        const a = buildFallbackPeaks('seed', 5);
        const b = buildFallbackPeaks('seed', 5);
        const c = buildFallbackPeaks('seed2', 5);

        expect(a).toEqual(b);
        expect(a).not.toEqual(c);
        expect(a).toHaveLength(5);
    });

    describe('computePeaksFromAudioBuffer', () => {
        it('returns empty array for zero targetCount', () => {
            const buf = fakeAudioBuffer([new Float32Array([0.5, 0.5])]);
            expect(computePeaksFromAudioBuffer(buf, 0)).toEqual([]);
        });

        it('bucket with highest peak normalizes to 1.0', () => {
            // 4 samples → 2 bars of 2 samples each.
            // Bar 0: [1.0, 0.8] → max = 1.0
            // Bar 1: [0.3, 0.1] → max = 0.3
            // globalMax = 1.0, bar1 normalized = 0.3 → lifted ≈ 0.356
            const samples = new Float32Array([1.0, 0.8, 0.3, 0.1]);
            const buf = fakeAudioBuffer([samples]);
            const peaks = computePeaksFromAudioBuffer(buf, 2);

            expect(peaks).toHaveLength(2);
            // Loudest bucket always maps to 1.0 after normalization
            expect(peaks[0]).toBeCloseTo(1.0, 4);
            // Quieter bucket should be significantly lower
            expect(peaks[1]).toBeLessThan(0.4);
            expect(peaks[0]).toBeGreaterThan(peaks[1]!);
        });

        it('uniform amplitude produces uniform bars', () => {
            // All samples identical → every bucket has same max → all bars = 1.0
            const samples = new Float32Array([0.5, 0.5, 0.5, 0.5]);
            const buf = fakeAudioBuffer([samples]);
            const peaks = computePeaksFromAudioBuffer(buf, 2);

            expect(peaks[0]).toBeCloseTo(1.0, 4);
            expect(peaks[1]).toBeCloseTo(1.0, 4);
        });

        it('loud vs quiet buckets show clear visual contrast', () => {
            // Simulate loud speech vs near-silence.
            // Bar 0: loud samples → high peak
            // Bar 1: quiet samples → low peak
            const samples = new Float32Array([0.9, 0.8, 0.85, 0.95, 0.05, 0.03, 0.02, 0.04]);
            const buf = fakeAudioBuffer([samples]);
            const peaks = computePeaksFromAudioBuffer(buf, 2);

            expect(peaks[0]).toBeCloseTo(1.0, 4);
            // Quiet bucket max = 0.05, loud max = 0.95 → ratio ≈ 0.053
            // lifted ≈ 0.08 + 0.053 * 0.92 ≈ 0.129
            expect(peaks[1]).toBeLessThan(0.2);
        });

        it('silence produces the floor value', () => {
            const samples = new Float32Array([0, 0, 0, 0]);
            const buf = fakeAudioBuffer([samples]);
            const peaks = computePeaksFromAudioBuffer(buf, 2);

            // globalMax is 0, normalized is 0 → 0.08
            expect(peaks[0]).toBeCloseTo(0.08, 5);
            expect(peaks[1]).toBeCloseTo(0.08, 5);
        });

        it('max-peak matches recording-time waveform algorithm', () => {
            // 8 samples → 4 bars of 2 samples each.
            // Bar 0: [0.5, 0.5] → max = 0.5
            // Bar 1: [1.0, 0.0] → max = 1.0 (spike dominates, matching recording)
            // Bar 2: [0.2, 0.2] → max = 0.2
            // Bar 3: [0.4, 0.4] → max = 0.4
            const samples = new Float32Array([0.5, 0.5, 1.0, 0.0, 0.2, 0.2, 0.4, 0.4]);
            const buf = fakeAudioBuffer([samples]);
            const peaks = computePeaksFromAudioBuffer(buf, 4);

            expect(peaks).toHaveLength(4);
            // Bar 1 (spike) has highest max → 1.0
            expect(peaks[1]).toBeCloseTo(1.0, 4);
            // Bar 0 (0.5): normalized = 0.5 → lifted = 0.08 + 0.5*0.92 = 0.54
            expect(peaks[0]).toBeCloseTo(0.54, 2);
            // Bar 3 (0.4): normalized = 0.4 → lifted = 0.08 + 0.4*0.92 = 0.448
            expect(peaks[3]).toBeCloseTo(0.448, 2);
            // Bar 2 (0.2): lowest non-zero
            expect(peaks[2]).toBeLessThan(peaks[0]!);
        });

        it('all peaks are between floor (0.08) and ceiling (1.0)', () => {
            const samples = new Float32Array(100);
            for (let i = 0; i < 100; i++) {
                samples[i] = Math.random();
            }
            const buf = fakeAudioBuffer([samples]);
            const peaks = computePeaksFromAudioBuffer(buf, 10);

            for (const p of peaks) {
                expect(p).toBeGreaterThanOrEqual(0.08);
                expect(p).toBeLessThanOrEqual(1.0);
            }
        });
    });
});
