<script lang="ts">
    import { clamp01 } from '$lib/core/Waveform';

    let {
        peaks = [],
        barCount = 60,
        progress = 0,
        heightPx = 32,
        seekable = false,
        onSeek,
        playedClass = 'bg-blue-500/90 dark:bg-blue-400/90',
        unplayedClass = 'bg-blue-300/60 dark:bg-blue-200/50'
    } = $props<{
        peaks?: number[];
        barCount?: number;
        progress?: number;
        heightPx?: number;
        seekable?: boolean;
        onSeek?: (progress: number) => void;
        playedClass?: string;
        unplayedClass?: string;
    }>();

    let container = $state<HTMLElement | null>(null);
    let isDragging = $state(false);

    const normalizedPeaks = $derived((() => {
        const normalized = peaks.map((p: number) => clamp01(p));

        if (barCount <= 0) {
            return [];
        }

        if (normalized.length === barCount) {
            return normalized;
        }

        if (normalized.length > barCount) {
            return normalized.slice(normalized.length - barCount);
        }

        const padValue = normalized.length > 0 ? normalized[0] ?? 0.2 : 0.2;
        const padding = Array.from({ length: barCount - normalized.length }, () => padValue);
        return [...padding, ...normalized];
    })());

    const clampedProgress = $derived(clamp01(progress));
    const playedCount = $derived(Math.round(clampedProgress * normalizedPeaks.length));

    function eventToProgress(e: PointerEvent): number {
        if (!container) {
            return 0;
        }

        const rect = container.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const ratio = rect.width > 0 ? x / rect.width : 0;
        return clamp01(ratio);
    }

    function handlePointerDown(e: PointerEvent): void {
        if (!seekable || !onSeek || !container) {
            return;
        }

        isDragging = true;
        container.setPointerCapture(e.pointerId);
        onSeek(eventToProgress(e));
        e.preventDefault();
    }

    function handlePointerMove(e: PointerEvent): void {
        if (!isDragging || !seekable || !onSeek) {
            return;
        }

        onSeek(eventToProgress(e));
        e.preventDefault();
    }

    function handlePointerUp(e: PointerEvent): void {
        if (!isDragging || !container) {
            return;
        }

        isDragging = false;
        try {
            container.releasePointerCapture(e.pointerId);
        } catch {
            // ignore
        }
        e.preventDefault();
    }
</script>

<div
    bind:this={container}
    role={seekable ? 'slider' : 'presentation'}
    aria-valuemin={seekable ? 0 : undefined}
    aria-valuemax={seekable ? 100 : undefined}
    aria-valuenow={seekable ? Math.round(clampedProgress * 100) : undefined}
    aria-label={seekable ? 'Audio seek bar' : undefined}
    class={`flex items-center justify-between gap-[2px] w-full ${seekable ? 'cursor-pointer touch-none select-none' : ''}`}
    style={`height: ${heightPx}px`}
    onpointerdown={handlePointerDown}
    onpointermove={handlePointerMove}
    onpointerup={handlePointerUp}
    onpointercancel={handlePointerUp}
>
    {#each normalizedPeaks as peak, i}
        <div class="flex-1 min-w-[2px] max-w-[4px]">
            <div
                class={`w-full rounded-full transition-colors ${i < playedCount ? playedClass : unplayedClass}`}
                style={`height: ${Math.max(2, peak * heightPx)}px`}
            ></div>
        </div>
    {/each}
</div>
