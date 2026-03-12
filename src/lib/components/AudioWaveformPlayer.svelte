<script lang="ts">
    import WaveformBars from '$lib/components/WaveformBars.svelte';
    import { buildFallbackPeaks, clamp01, computePeaksFromAudioBuffer } from '$lib/core/Waveform';

    let { url, isOwn = false } = $props<{ url: string; isOwn?: boolean }>();

    const BAR_COUNT = 56;

    const waveformCache = new Map<string, number[]>();
    const durationCache = new Map<string, number>();
    const waveformPromises = new Map<string, Promise<number[]>>();

    // Concurrency limiter for waveform decoding – at most 2 simultaneous
    // decodeAudioData() calls to avoid CPU spikes when many voice messages
    // become visible at once.
    const MAX_CONCURRENT_DECODES = 2;
    let activeDecodes = 0;
    let decodeQueue: Array<() => void> = [];

    function acquireDecodeSlot(): Promise<void> {
        if (activeDecodes < MAX_CONCURRENT_DECODES) {
            activeDecodes++;
            return Promise.resolve();
        }
        return new Promise<void>((resolve) => {
            decodeQueue.push(() => {
                activeDecodes++;
                resolve();
            });
        });
    }

    function releaseDecodeSlot(): void {
        activeDecodes--;
        const next = decodeQueue.shift();
        if (next) {
            next();
        }
    }

    const SPEEDS = [1, 1.5, 2] as const;

    let audioElement: HTMLAudioElement | null = null;
    let duration = $state(0);
    let currentTime = $state(0);
    let isPlaying = $state(false);
    let isLoading = $state(true);
    let pendingSeekTime = $state<number | null>(null);
    let playbackRate = $state(1);

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

                // Use OfflineAudioContext instead of AudioContext so that
                // waveform computation never initialises the audio output
                // hardware.  On Android WebView, creating multiple real
                // AudioContext instances simultaneously causes audible
                // speaker crackling as the audio subsystem is repeatedly
                // acquired / released.
                const OfflineCtx =
                    (window as any).OfflineAudioContext ||
                    (window as any).webkitOfflineAudioContext;

                if (!OfflineCtx) {
                    throw new Error('OfflineAudioContext not available');
                }

                // Wait for a decode slot before creating the context to
                // limit concurrent CPU-heavy decodeAudioData() calls.
                await acquireDecodeSlot();
                try {
                    // Minimal context – we only need decodeAudioData(), not
                    // startRendering().  1 channel, 1 sample, 44100 Hz.
                    const context = new OfflineCtx(1, 1, 44100) as OfflineAudioContext;
                    const decoded = await context.decodeAudioData(arrayBuffer.slice(0));
                    const computed = computePeaksFromAudioBuffer(decoded, BAR_COUNT);
                    waveformCache.set(targetUrl, computed);
                    durationCache.set(targetUrl, decoded.duration);
                    return computed;
                } finally {
                    releaseDecodeSlot();
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

    function updateDurationFromElement(): void {
        if (!audioElement) {
            return;
        }

        const nextDuration = audioElement.duration;
        if (isFinite(nextDuration) && nextDuration > 0) {
            duration = nextDuration;
        }
    }

    function updateDurationFromCache(targetUrl: string): void {
        const cachedDuration = durationCache.get(targetUrl);
        if (typeof cachedDuration === 'number' && isFinite(cachedDuration) && cachedDuration > 0) {
            duration = cachedDuration;
        }
    }

    $effect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        // Reset playback state when URL changes.
        currentTime = 0;
        isPlaying = false;
        isLoading = false;
        duration = 0;
        pendingSeekTime = null;
        playbackRate = 1;

        updateDurationFromCache(url);

        isWaveformLoading = true;
        peaks = buildFallbackPeaks(url, BAR_COUNT);

        void loadWaveformPeaks(url).then((value) => {
            peaks = value;
            isWaveformLoading = false;
            updateDurationFromCache(url);
        });
    });

    $effect(() => {
        if (audioElement && audioElement.readyState >= HTMLMediaElement.HAVE_METADATA) {
            audioElement.playbackRate = playbackRate;
            audioElement.preservesPitch = true;
        }
    });

    function togglePlay() {
        if (!audioElement) {
            return;
        }

        if (audioElement.paused) {
            // With preload="none", we need to load first if not ready
            if (audioElement.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA) {
                audioElement.load();
            }
            audioElement
                .play()
                .then(() => {
                    isPlaying = true;
                    if (audioElement) {
                        audioElement.playbackRate = playbackRate;
                        audioElement.preservesPitch = true;
                    }
                })
                .catch((e) => {
                    console.error('[AudioPlayer] Failed to play audio', e);
                });
        } else {
            audioElement.pause();
        }
    }

    function handleLoadedMetadata() {
        if (!audioElement) {
            return;
        }

        updateDurationFromElement();
        updateDurationFromCache(url);

        // Apply any seek that was requested before audio loaded.
        if (pendingSeekTime !== null) {
            audioElement.currentTime = pendingSeekTime;
            currentTime = pendingSeekTime;
            pendingSeekTime = null;
        }

        // Ensure playback rate is synced after load.
        audioElement.playbackRate = playbackRate;
    }

    function handleDurationChange(): void {
        updateDurationFromElement();
    }

    function handleTimeUpdate() {
        if (!audioElement) {
            return;
        }

        updateDurationFromElement();
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
        const targetTime = clamped * duration;

        if (audioElement.readyState >= HTMLMediaElement.HAVE_METADATA) {
            audioElement.currentTime = targetTime;
            currentTime = audioElement.currentTime;
            pendingSeekTime = null;
        } else {
            // Audio not loaded yet — queue the seek for when metadata arrives.
            pendingSeekTime = targetTime;
            currentTime = targetTime;
        }
    }

    function cycleSpeed(): void {
        const currentIndex = SPEEDS.indexOf(playbackRate as (typeof SPEEDS)[number]);
        const nextIndex = (currentIndex + 1) % SPEEDS.length;
        playbackRate = SPEEDS[nextIndex];
        // Apply immediately so active playback reflects the change without
        // waiting for Svelte's effect scheduling.
        if (audioElement && audioElement.readyState >= HTMLMediaElement.HAVE_METADATA) {
            audioElement.playbackRate = playbackRate;
            audioElement.preservesPitch = true;
        }
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
    class={`flex items-start gap-3 px-3 py-1.5 rounded-xl border text-[11px] min-w-[200px] max-w-full bg-white/20 dark:bg-slate-800/50 md:bg-white/10 md:dark:bg-slate-800/30 md:backdrop-blur-sm border-gray-200/50 dark:border-slate-700/50 transition-colors ${
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

    <div class="flex-1 flex flex-col gap-0.5 min-w-0">
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

        <div class="flex items-center justify-between">
            <div class="text-[10px] tabular-nums">
                {#if isPlaying || currentTime > 0}
                    {formatTime(currentTime)} / {formatTime(duration)}
                {:else}
                    {formatTime(duration)}
                {/if}
            </div>

            <button
                type="button"
                onclick={cycleSpeed}
                class={`text-[9px] font-semibold leading-none px-1.5 py-0.5 rounded-full transition-colors ${
                    playbackRate === 1
                        ? 'opacity-50 bg-gray-300/30 dark:bg-slate-600/30'
                        : 'opacity-100 bg-blue-500/20 dark:bg-blue-400/20 text-blue-600 dark:text-blue-300'
                }`}
                aria-label={`Playback speed ${playbackRate}x, tap to change`}
            >
                {playbackRate}x
            </button>
        </div>

        {#if isWaveformLoading}
            <div class="typ-meta text-[10px] text-gray-500 dark:text-slate-400">Loading waveform…</div>
        {/if}
    </div>
</div>

<!-- svelte-ignore a11y_media_has_caption -->
<audio
    bind:this={audioElement}
    src={url}
    preload="none"
    onloadedmetadata={handleLoadedMetadata}
    ondurationchange={handleDurationChange}
    ontimeupdate={handleTimeUpdate}
    onplay={handlePlay}
    onpause={handlePause}
    onended={handleEnded}
    class="sr-only"
    style="width: 1px; height: 1px; opacity: 0; pointer-events: none;"
></audio>
