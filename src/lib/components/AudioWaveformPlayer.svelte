<script lang="ts">
    import { onMount } from 'svelte';

    let { url, isOwn = false } = $props<{ url: string; isOwn?: boolean }>();

    let audioElement: HTMLAudioElement | null = null;
    let waveform = $state<number[]>([]);
    let duration = $state(0);
    let currentTime = $state(0);
    let isPlaying = $state(false);
    let isLoading = $state(true);
    let isError = $state(false);

    const BAR_COUNT = 64;

    onMount(() => {
        if (typeof window === 'undefined') {
            return;
        }

        (async () => {
            try {
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error('Failed to load audio');
                }

                const arrayBuffer = await response.arrayBuffer();
                const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
                if (!AudioCtx) {
                    throw new Error('AudioContext not available');
                }

                const ctx = new AudioCtx();
                const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));

                const channelData = audioBuffer.getChannelData(0);
                const blockSize = Math.floor(channelData.length / BAR_COUNT) || 1;
                const peaks: number[] = [];

                for (let i = 0; i < BAR_COUNT; i++) {
                    const start = i * blockSize;
                    const end = Math.min(start + blockSize, channelData.length);
                    let sum = 0;
                    for (let j = start; j < end; j++) {
                        sum += Math.abs(channelData[j]);
                    }
                    const value = end > start ? sum / (end - start) : 0;
                    peaks.push(value);
                }

                const max = Math.max(...peaks) || 1;
                waveform = peaks.map((v) => (max > 0 ? v / max : 0));
            } catch (e) {
                console.error('Failed to compute audio waveform', e);
                isError = true;
            } finally {
                isLoading = false;
            }
        })();
    });

    function togglePlay() {
        if (!audioElement) {
            return;
        }

        if (audioElement.paused) {
            audioElement.play().catch((e) => {
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

    function handleWaveformClick(event: MouseEvent) {
        if (!audioElement || !duration) {
            return;
        }

        const target = event.currentTarget as HTMLElement;
        const rect = target.getBoundingClientRect();
        const offsetX = event.clientX - rect.left;
        const ratio = Math.min(Math.max(offsetX / rect.width, 0), 1);
        const newTime = ratio * duration;
        audioElement.currentTime = newTime;
        currentTime = newTime;
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

    const progress = $derived(duration > 0 ? currentTime / duration : 0);
</script>

{#if isError}
    <!-- Fallback: plain audio controls when waveform fails -->
    <!-- svelte-ignore a11y_media_has_caption -->
    <audio controls src={url} class="w-full"></audio>
{:else}
    <!-- Hidden/compact audio element for playback state -->
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
    ></audio>

    <div class={`mt-1 inline-flex w-full items-center gap-3 px-3 py-2 rounded-lg border text-xs ${isOwn
        ? 'bg-blue-900/40 border-blue-700/60 text-blue-50'
        : 'bg-white/80 dark:bg-slate-900/70 border-gray-200/70 dark:border-slate-700/70 text-gray-800 dark:text-slate-100'}`}>
        <button
            type="button"
            onclick={togglePlay}
            class="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center border border-current/40 hover:bg-current/10"
            aria-label={isPlaying ? 'Pause audio' : 'Play audio'}
        >
            {#if isPlaying}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="6" y="4" width="4" height="16" />
                    <rect x="14" y="4" width="4" height="16" />
                </svg>
            {:else}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polygon points="8 5 19 12 8 19 8 5" />
                </svg>
            {/if}
        </button>

        <div
            class="flex-1 h-10 flex items-center gap-[2px] cursor-pointer select-none"
            onclick={handleWaveformClick}
        >
            {#if isLoading || waveform.length === 0}
                <div class="w-full h-3 rounded-full bg-gray-200/70 dark:bg-slate-800/80 animate-pulse"></div>
            {:else}
                {#each waveform as value, index}
                    <div
                        class="flex-1 rounded-sm bg-blue-500/60 dark:bg-blue-400/60"
                        style={`height: ${Math.max(2, value * 32)}px; opacity: ${index / waveform.length <= progress ? 0.95 : 0.4}`}
                    ></div>
                {/each}
            {/if}
        </div>

        <div class="flex-shrink-0 text-[10px] tabular-nums text-right min-w-[52px]">
            {formatTime(currentTime)} / {formatTime(duration)}
        </div>
    </div>
{/if}
