export function clamp01(value: number): number {
    if (!isFinite(value)) {
        return 0;
    }
    return Math.min(1, Math.max(0, value));
}

export function downsamplePeaks(peaks: number[], targetCount: number): number[] {
    if (targetCount <= 0) {
        return [];
    }

    if (peaks.length === 0) {
        return [];
    }

    if (peaks.length === targetCount) {
        return peaks.map(clamp01);
    }

    // When there are fewer peaks than bars, use nearest-neighbour interpolation
    // so every bar gets a real value instead of zero.
    if (peaks.length < targetCount) {
        const result: number[] = [];
        for (let i = 0; i < targetCount; i++) {
            const srcIndex = Math.min(
                peaks.length - 1,
                Math.round((i * (peaks.length - 1)) / (targetCount - 1))
            );
            result.push(clamp01(peaks[srcIndex] ?? 0));
        }
        return result;
    }

    // Downsample: take max per bucket.
    const bucketSize = peaks.length / targetCount;
    const result: number[] = [];

    for (let i = 0; i < targetCount; i++) {
        const start = Math.floor(i * bucketSize);
        const end = Math.min(peaks.length, Math.floor((i + 1) * bucketSize));

        let max = 0;
        for (let j = start; j < end; j++) {
            max = Math.max(max, peaks[j] ?? 0);
        }

        result.push(clamp01(max));
    }

    return result;
}

export function computePeaksFromAudioBuffer(buffer: AudioBuffer, targetCount: number): number[] {
    const channelCount = Math.max(1, buffer.numberOfChannels);
    const totalSamples = buffer.length;

    if (targetCount <= 0 || totalSamples <= 0) {
        return [];
    }

    const samplesPerBar = Math.max(1, Math.floor(totalSamples / targetCount));
    const rawPeaks: number[] = [];

    // First pass: compute max absolute amplitude per bucket.
    // This matches the recording-time algorithm (samplePeakFromAnalyser /
    // NativeAudioRecorder) so the sent-message waveform looks the same as
    // the waveform the user saw while recording.
    for (let i = 0; i < targetCount; i++) {
        const start = i * samplesPerBar;
        const end = Math.min(totalSamples, start + samplesPerBar);

        let maxAbs = 0;
        for (let c = 0; c < channelCount; c++) {
            const data = buffer.getChannelData(c);
            for (let s = start; s < end; s++) {
                const v = Math.abs(data[s] ?? 0);
                if (v > maxAbs) {
                    maxAbs = v;
                }
            }
        }

        rawPeaks.push(maxAbs);
    }

    // Second pass: normalize against global max so loud recordings
    // still show visual contrast between quieter and louder moments.
    const globalMax = Math.max(...rawPeaks);
    const peaks: number[] = [];

    for (let i = 0; i < targetCount; i++) {
        const normalized = globalMax > 0 ? (rawPeaks[i] ?? 0) / globalMax : 0;
        // Floor of 0.08 ensures silence still renders visible bars.
        const lifted = 0.08 + normalized * 0.92;
        peaks.push(clamp01(lifted));
    }

    return peaks;
}

export function buildFallbackPeaks(seed: string, targetCount: number): number[] {
    if (targetCount <= 0) {
        return [];
    }

    let hash = 2166136261;
    for (let i = 0; i < seed.length; i++) {
        hash ^= seed.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }

    let x = hash >>> 0;
    const peaks: number[] = [];
    for (let i = 0; i < targetCount; i++) {
        // xorshift32
        x ^= x << 13;
        x ^= x >>> 17;
        x ^= x << 5;
        const r = (x >>> 0) / 0xffffffff;
        peaks.push(0.15 + r * 0.75);
    }

    // light smoothing pass
    const smoothed: number[] = [];
    for (let i = 0; i < targetCount; i++) {
        const prev = peaks[Math.max(0, i - 1)] ?? 0;
        const cur = peaks[i] ?? 0;
        const next = peaks[Math.min(targetCount - 1, i + 1)] ?? 0;
        smoothed.push(clamp01((prev + cur + next) / 3));
    }

    return smoothed;
}
