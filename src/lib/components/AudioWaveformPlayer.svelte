<script lang="ts">
    import WaveformBars from '$lib/components/WaveformBars.svelte';
    import { buildFallbackPeaks, clamp01, computePeaksFromAudioBuffer } from '$lib/core/Waveform';

    let { url, isOwn = false } = $props<{ url: string; isOwn?: boolean }>();

    const BAR_COUNT = 40;

    const waveformCache = new Map<string, number[]>();
    const waveformPromises = new Map<string, Promise<number[]>>();

    let audioElement: HTMLAudioElement | null = null;
    let duration = $state(0);
    let currentTime = $state(0);
    let isPlaying = $state(false);
    let isLoading = $state(true);

    let peaks = $state<number[]>([]);
    let isWaveformLoading = $state(true);

    const progress = $derived(duration > 0 ? clamp01(currentTime / duration) : 0);

    async function loadWaveformPeaks(targetUrl: string): Promise<number[]> {
        if (waveformCache.has(targetUrl)) {
            return waveformCache.get(targetUrl)!;
        }

        if (waveformPromises.has(targetUrl)) {
            return waveformPromises.get(targetUrl)!;
        }

        const promise = (async () => {
            try {
                const response = await fetch(targetUrl);
                if (!response.ok) {
                    throw new Error(`Failed to fetch audio (${response.status})`);
                }

                const arrayBuffer = await response.arrayBuffer();
                const AudioContextCtor =
                    (window as any).AudioContext || (window as any).webkitAudioContext;

                if (!AudioContextCtor) {
                    throw new Error('AudioContext not available');
                }

                const context = new AudioContextCtor() as AudioContext;
                try {
                    const decoded = await context.decodeAudioData(arrayBuffer.slice(0));
                    const computed = computePeaksFromAudioBuffer(decoded, BAR_COUNT);
                    waveformCache.set(targetUrl, computed);
                    return computed;
                } finally {
                    try {
                        await context.close();
                    } catch {
                        // ignore
                    }
                }
            } catch {
                const fallback = buildFallbackPeaks(targetUrl, BAR_COUNT);
                waveformCache.set(targetUrl, fallback);
                return fallback;
            } finally {
                waveformPromises.delete(targetUrl);
            }
        })();

        waveformPromises.set(targetUrl, promise);
        return promise;
    }

    $effect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        isWaveformLoading = true;
        peaks = buildFallbackPeaks(url, BAR_COUNT);

        void loadWaveformPeaks(url).then((value) => {
            peaks = value;
            isWaveformLoading = false;
        });
    });

    function togglePlay() {
        if (!audioElement) {
            return;
        }

        if (audioElement.paused) {
            audioElement
                .play()
                .then(() => {
                    isPlaying = true;
                })
                .catch((e) => {
                    console.error('Failed to play audio', e);
                });
        } else {
            audioElement.pause();
        }
    }

    function handleLoadedMetadata() {
        if (!audioElement) {
            return;
        }
        duration = audioElement.duration || 0;
        isLoading = false;
    }

    function handleTimeUpdate() {
        if (!audioElement) {
            return;
        }
        currentTime = audioElement.currentTime || 0;
    }

    function handlePlay() {
        isPlaying = true;
    }

    function handlePause() {
        isPlaying = false;
    }

    function handleEnded() {
        isPlaying = false;
        if (audioElement) {
            currentTime = audioElement.duration || 0;
        }
    }

    function handleSeek(nextProgress: number): void {
        if (!audioElement || duration <= 0) {
            return;
        }

        const clamped = clamp01(nextProgress);
        audioElement.currentTime = clamped * duration;
        currentTime = audioElement.currentTime;
    }

    function formatTime(seconds: number): string {
        if (!isFinite(seconds) || seconds <= 0) {
            return '0:00';
        }
        const totalSeconds = Math.floor(seconds);
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        const padded = secs < 10 ? `0${secs}` : `${secs}`;
        return `${mins}:${padded}`;
    }
</script>

<div
    class={`flex items-center gap-3 px-3 py-1.5 rounded-xl border text-[11px] min-w-[160px] max-w-full bg-white/20 dark:bg-slate-800/50 md:bg-white/10 md:dark:bg-slate-800/30 md:backdrop-blur-sm border-gray-200/50 dark:border-slate-700/50 transition-colors ${
        isOwn ? 'text-blue-50' : 'text-gray-900 dark:text-slate-100'
    }`}
>
    <button
        type="button"
        onclick={togglePlay}
        class="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center bg-blue-500 text-white shadow-sm hover:bg-blue-600 disabled:opacity-60"
        aria-label={isPlaying ? 'Pause audio' : 'Play audio'}
        disabled={isLoading}
    >
        {#if isPlaying}
            <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
            >
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
            </svg>
        {:else}
            <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
            >
                <polygon points="8 5 19 12 8 19 8 5" />
            </svg>
        {/if}
    </button>

    <div class="flex-1 flex flex-col gap-1 min-w-0">
        <WaveformBars
            peaks={peaks}
            barCount={BAR_COUNT}
            heightPx={32}
            progress={progress}
            seekable={!isLoading}
            onSeek={handleSeek}
            playedClass="bg-blue-500/90 dark:bg-blue-400/90"
            unplayedClass="bg-blue-300/50 dark:bg-blue-200/40"
        />

        {#if isWaveformLoading}
            <div class="typ-meta text-[10px] text-gray-500 dark:text-slate-400">Loading waveform…</div>
        {/if}
    </div>

    <div class="flex-shrink-0 text-[10px] tabular-nums text-right min-w-[56px]">
        {formatTime(currentTime)} / {formatTime(duration)}
    </div>
</div>

<!-- svelte-ignore a11y_media_has_caption -->
<audio
    bind:this={audioElement}
    src={url}
    onloadedmetadata={handleLoadedMetadata}
    ontimeupdate={handleTimeUpdate}
    onplay={handlePlay}
    onpause={handlePause}
    onended={handleEnded}
    class="hidden"
    style="display: none !important; position: absolute; width: 0; height: 0;"
></audio>
