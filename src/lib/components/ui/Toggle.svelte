<script lang="ts">
    import { hapticSelection } from '$lib/utils/haptics';

    let { 
        checked = $bindable(false),
        disabled = false,
        label = '',
        id = undefined,
        onclick = undefined,
        class: className = '',
        ...rest 
    } = $props<{
        checked?: boolean;
        disabled?: boolean;
        label?: string;
        id?: string;
        onclick?: (e: MouseEvent) => void;
        class?: string;
        [key: string]: any;
    }>();

    const trackClasses = $derived(`
        relative inline-flex h-8 w-14 flex-shrink-0 cursor-pointer items-center rounded-full border-2 transition-all duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-lavender-rgb)/0.45)] active:scale-95
        ${checked 
            ? 'bg-[rgb(var(--color-lavender-rgb)/0.20)] border-[rgb(var(--color-lavender-rgb)/0.30)]' 
            : 'bg-gray-200/50 dark:bg-slate-800/50 border-transparent hover:bg-gray-300/50 dark:hover:bg-slate-700/50'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        ${className}
    `);

    const thumbClasses = $derived(`
        pointer-events-none flex items-center justify-center rounded-full shadow-sm transition-all duration-200 ease-out
        ${checked 
            ? 'h-6 w-6 ltr:translate-x-7 rtl:-translate-x-7 bg-[rgb(var(--color-lavender-rgb))]' 
            : 'h-4 w-4 ltr:translate-x-1 rtl:-translate-x-1 bg-gray-400 dark:bg-slate-500'
        }
    `);

    function handleClick(e: MouseEvent) {
        if (disabled) return;
        hapticSelection();
        checked = !checked;
        if (onclick) onclick(e);
    }
</script>

<button
    type="button"
    {id}
    role="switch"
    aria-checked={checked}
    aria-label={label}
    {disabled}
    onclick={handleClick}
    class={trackClasses}
    {...rest}
>
    <span class="sr-only">{label}</span>
    <span
        aria-hidden="true"
        class={thumbClasses}
    >
        {#if checked}
            <svg 
                class="h-4 w-4 text-[rgb(var(--color-base-rgb))] transition-all duration-200"
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                stroke-width="4"
            >
                <path d="M5 12l5 5L20 7" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
        {/if}
    </span>
</button>
