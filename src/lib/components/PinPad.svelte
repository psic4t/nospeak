<script lang="ts">
    import { hapticSelection } from '$lib/utils/haptics';

    let {
        value = $bindable(''),
        length = 4,
        error = false,
        onComplete = (_pin: string) => {},
        disabled = false
    } = $props<{
        value?: string;
        length?: number;
        error?: boolean;
        onComplete?: (pin: string) => void;
        disabled?: boolean;
    }>();

    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'backspace'] as const;

    function handleKey(key: typeof keys[number]) {
        if (disabled) return;
        hapticSelection();

        if (key === 'backspace') {
            value = value.slice(0, -1);
            return;
        }

        if (key === '' || value.length >= length) return;

        value = value + key;

        if (value.length === length) {
            onComplete(value);
        }
    }

    function handleKeydown(e: KeyboardEvent) {
        if (disabled) return;

        if (e.key >= '0' && e.key <= '9') {
            handleKey(e.key as typeof keys[number]);
        } else if (e.key === 'Backspace') {
            handleKey('backspace');
        }
    }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="flex flex-col items-center gap-10">
    <!-- PIN dots -->
    <div class="flex gap-5" role="status" aria-live="polite">
        {#each Array(length) as _, i}
            <div
                class="w-5 h-5 rounded-full transition-all duration-150
                    {error ? 'animate-shake' : ''}
                    {i < value.length
                        ? 'bg-[rgb(var(--color-lavender-rgb))] scale-110'
                        : 'bg-gray-300 dark:bg-slate-600'
                    }"
            ></div>
        {/each}
    </div>

    <!-- Keypad grid -->
    <div class="grid grid-cols-3 gap-4 w-full">
        {#each keys as key}
            {#if key === ''}
                <div></div>
            {:else if key === 'backspace'}
                <button
                    type="button"
                    {disabled}
                    class="h-[72px] rounded-2xl flex items-center justify-center
                        text-gray-700 dark:text-slate-300
                        active:bg-gray-200/60 dark:active:bg-slate-700/60
                        transition-colors duration-100
                        disabled:opacity-30"
                    onclick={() => handleKey(key)}
                    aria-label="Backspace"
                >
                    <svg class="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 4H8l-7 8 7 8h13a2 2 0 002-2V6a2 2 0 00-2-2z" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M18 9l-6 6M12 9l6 6" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </button>
            {:else}
                <button
                    type="button"
                    {disabled}
                    class="h-[72px] rounded-2xl flex items-center justify-center
                        text-3xl font-medium
                        text-gray-900 dark:text-white
                        bg-gray-100/60 dark:bg-slate-800/60
                        active:bg-gray-200/80 dark:active:bg-slate-700/80
                        active:scale-95
                        transition-all duration-100
                        disabled:opacity-30"
                    onclick={() => handleKey(key)}
                >
                    {key}
                </button>
            {/if}
        {/each}
    </div>
</div>

<style>
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
        20%, 40%, 60%, 80% { transform: translateX(4px); }
    }

    :global(.animate-shake) {
        animation: shake 0.5s ease-in-out;
    }
</style>
