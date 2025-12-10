<script lang="ts">
    let { url, isOwn = false } = $props<{ url: string; isOwn?: boolean }>();

    let audioElement: HTMLAudioElement | null = null;
    let duration = $state(0);
    let currentTime = $state(0);
    let isPlaying = $state(false);
    let isLoading = $state(true);

    const BAR_COUNT = 5;
    const EQ_SPEED = 6;

    const progress = $derived(duration > 0 ? currentTime / duration : 0);

    const eqLevels = $derived(
        Array.from({ length: BAR_COUNT }, (_, i) => {
            if (!isPlaying) {
                return 0.3 + 0.05 * i;
            }
            const phase = (i / BAR_COUNT) * Math.PI * 2;
            const t = currentTime ?? 0;
            const value = 0.4 + 0.6 * Math.abs(Math.sin(t * EQ_SPEED + phase));
            return value;
        })
    );

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

<div
    class={`flex items-center gap-3 px-3 py-2 rounded-xl border text-[11px] min-w-[220px] max-w-full bg-white/20 dark:bg-slate-800/50 md:bg-white/10 md:dark:bg-slate-800/30 md:backdrop-blur-sm border-gray-200/50 dark:border-slate-700/50 transition-colors ${
        isOwn ? 'text-blue-50' : 'text-gray-900 dark:text-slate-100'
    }`}
>


    <button
        type="button"
        onclick={togglePlay}
        class="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center bg-blue-500 text-white shadow-sm hover:bg-blue-600 disabled:opacity-60"
        aria-label={isPlaying ? 'Pause audio' : 'Play audio'}
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
        <div class="text-[11px] font-semibold truncate tracking-wide">
            Audio message
        </div>

        <!-- Equalizer -->
        <div class="flex items-end gap-[4px] h-8 w-full">
            {#each eqLevels as level}
                <div
                    class="flex-1 max-w-[7px] rounded-full bg-blue-400/95 dark:bg-blue-300/95 transition-[height,opacity]"
                    style={`height: ${4 + level * 24}px; opacity: ${isPlaying ? 0.98 : 0.7}`}
                ></div>
            {/each}
        </div>

        <!-- Progress bar below equalizer -->
        <div class="mt-1 h-[3px] w-full rounded-full bg-gray-200/80 dark:bg-slate-800/80 overflow-hidden">
            <div
                class="h-full rounded-full bg-blue-500/90 dark:bg-blue-400/90 transition-[width]"
                style={`width: ${progress * 100}%`}
            ></div>
        </div>
    </div>

    <div class="flex-shrink-0 text-[10px] tabular-nums text-right min-w-[56px]">
        {formatTime(currentTime)} / {formatTime(duration)}
    </div>
</div>
