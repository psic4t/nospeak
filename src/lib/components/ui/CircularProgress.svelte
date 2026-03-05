<script lang="ts">
    interface Props {
        size?: number;
        strokeWidth?: number;
        value?: number;
        class?: string;
    }

    let {
        size = 48,
        strokeWidth = 4,
        value = undefined,
        class: className = ""
    }: Props = $props();

    const radius = 20;
    const circumference = 2 * Math.PI * radius;
    let dashOffset = $derived(
        value !== undefined ? circumference - (value / 100) * circumference : 0
    );
</script>

<div
    class={`circular-progress ${value === undefined ? 'indeterminate' : ''} ${className}`}
    style="width: {size}px; height: {size}px;"
    role="progressbar"
    aria-label={value !== undefined ? `${value}% complete` : 'Loading'}
    aria-valuenow={value}
    aria-valuemin={value !== undefined ? 0 : undefined}
    aria-valuemax={value !== undefined ? 100 : undefined}
>
    <svg viewBox="0 0 48 48">
        {#if value !== undefined}
            <!-- Background track -->
            <circle
                cx="24"
                cy="24"
                r={radius}
                fill="none"
                stroke-width={strokeWidth}
                class="track"
            />
            <!-- Foreground arc -->
            <circle
                cx="24"
                cy="24"
                r={radius}
                fill="none"
                stroke-width={strokeWidth}
                class="arc"
                stroke-dasharray={circumference}
                stroke-dashoffset={dashOffset}
            />
            <!-- Percentage text -->
            <text x="24" y="24" text-anchor="middle" dominant-baseline="central" class="percent-text">
                {value}%
            </text>
        {:else}
            <circle
                cx="24"
                cy="24"
                r={radius}
                fill="none"
                stroke-width={strokeWidth}
            />
        {/if}
    </svg>
</div>

<style>
    .circular-progress {
        display: inline-block;
        color: var(--color-lavender, #7287fd);
    }

    .circular-progress.indeterminate {
        animation: rotate 2s linear infinite;
    }

    svg {
        display: block;
        width: 100%;
        height: 100%;
    }

    /* Indeterminate mode */
    .indeterminate circle {
        stroke: currentColor;
        stroke-linecap: round;
        animation: dash 1.4s ease-in-out infinite;
    }

    /* Determinate mode */
    .track {
        stroke: currentColor;
        opacity: 0.2;
    }

    .arc {
        stroke: currentColor;
        stroke-linecap: round;
        transform: rotate(-90deg);
        transform-origin: center;
        transition: stroke-dashoffset 0.3s ease;
    }

    .percent-text {
        fill: currentColor;
        font-size: 12px;
        font-weight: 600;
    }

    @keyframes rotate {
        100% {
            transform: rotate(360deg);
        }
    }

    @keyframes dash {
        0% {
            stroke-dasharray: 1, 150;
            stroke-dashoffset: 0;
        }
        50% {
            stroke-dasharray: 90, 150;
            stroke-dashoffset: -35;
        }
        100% {
            stroke-dasharray: 90, 150;
            stroke-dashoffset: -124;
        }
    }
</style>
