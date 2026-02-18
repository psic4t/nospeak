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
    const rawRms: number[] = [];

    // First pass: compute RMS (root mean square) per bucket.
    // RMS represents average energy which varies much more than peak amplitude
    // across speech segments, giving visually distinct bar heights.
    for (let i = 0; i < targetCount; i++) {
        const start = i * samplesPerBar;
        const end = Math.min(totalSamples, start + samplesPerBar);
        const count = (end - start) * channelCount;

        let sumSq = 0;
        for (let c = 0; c < channelCount; c++) {
            const data = buffer.getChannelData(c);
            for (let s = start; s < end; s++) {
                const v = data[s] ?? 0;
                sumSq += v * v;
            }
        }

        rawRms.push(count > 0 ? Math.sqrt(sumSq / count) : 0);
    }

    // Second pass: normalize against global max so loud recordings
    // still show visual contrast between quieter and louder moments.
    const globalMax = Math.max(...rawRms);
    const peaks: number[] = [];

    for (let i = 0; i < targetCount; i++) {
        const normalized = globalMax > 0 ? (rawRms[i] ?? 0) / globalMax : 0;
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
