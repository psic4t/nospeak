<script lang="ts">
    import { hapticSelection } from '$lib/utils/haptics';

    /**
     * Material Design 3 Split Button Component
     * 
     * Two independent buttons with a small gap, matching Button.svelte styling.
     * - Secondary (icon) button on the left
     * - Primary (text) button on the right
     * - Small gap between them (2px)
     * - Inner corners have small rounding, outer corners fully rounded
     */

    type Variant = 'filled-tonal' | 'primary' | 'ghost' | 'danger';

    let {
        variant = 'filled-tonal',
        primaryOnclick,
        secondaryOnclick,
        primaryLabel,
        secondaryAriaLabel,
        disabled = false,
        class: className = '',
        secondaryIcon
    } = $props<{
        variant?: Variant;
        primaryOnclick: (e: MouseEvent) => void;
        secondaryOnclick: (e: MouseEvent) => void;
        primaryLabel: string;
        secondaryAriaLabel: string;
        disabled?: boolean;
        class?: string;
        secondaryIcon: import('svelte').Snippet;
    }>();

    // Base styles - same as Button.svelte
    const baseStyles = "inline-flex items-center justify-center font-semibold transition-all duration-200 ease-out disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-lavender-rgb)/0.45)] focus-visible:ring-inset";

    // Variant styles - exact copy from Button.svelte
    const variants: Record<Variant, string> = {
        'filled-tonal': "bg-[rgb(var(--color-lavender-rgb)/0.20)] dark:bg-[rgb(var(--color-lavender-rgb)/0.24)] text-[rgb(var(--color-text-rgb)/0.92)] shadow-sm hover:shadow hover:bg-[rgb(var(--color-lavender-rgb)/0.26)] dark:hover:bg-[rgb(var(--color-lavender-rgb)/0.30)] active:bg-[rgb(var(--color-lavender-rgb)/0.32)] dark:active:bg-[rgb(var(--color-lavender-rgb)/0.36)]",
        primary: "bg-green-200/90 dark:bg-green-900/40 text-green-900 dark:text-green-300 border border-green-400/60 dark:border-green-800/50 shadow-md hover:bg-green-300 dark:hover:bg-green-900/60 active:bg-green-400/50 dark:active:bg-green-900/80 hover:text-green-950 dark:hover:text-green-200 hover:shadow-lg",
        ghost: "bg-transparent text-gray-500 dark:text-gray-400 hover:bg-blue-500/5 dark:hover:bg-blue-500/10 active:bg-blue-500/10 dark:active:bg-blue-500/20 hover:text-gray-900 dark:hover:text-white border border-transparent focus-visible:ring-[rgb(var(--color-lavender-rgb)/0.45)] focus-visible:ring-inset",
        danger: "bg-red-200/90 dark:bg-red-900/40 text-red-900 dark:text-red-300 border border-red-400/60 dark:border-red-800/50 shadow-md hover:bg-red-300 dark:hover:bg-red-900/60 active:bg-red-400/50 dark:active:bg-red-900/80 hover:text-red-950 dark:hover:text-red-200 hover:shadow-lg"
    };

    let variantStyles = $derived(variants[variant as Variant]);

    function handleClick(callback: (e: MouseEvent) => void) {
        return (e: MouseEvent) => {
            if (!disabled) {
                hapticSelection();
                callback(e);
            }
        };
    }
</script>

<!-- Container with visible gap (2px) -->
<div class="inline-flex gap-0.5 {className}">
    <!-- Secondary action (icon) - LEFT -->
    <!-- Outer: fully rounded, Inner: small rounding -->
    <button
        type="button"
        class="{baseStyles} {variantStyles} h-11 w-11 p-0 rounded-l-[22px] rounded-r-[0.3rem]"
        onclick={handleClick(secondaryOnclick)}
        aria-label={secondaryAriaLabel}
        {disabled}
    >
        <span class="w-5 h-5 flex items-center justify-center">
            {@render secondaryIcon()}
        </span>
    </button>
    
    <!-- Primary action (text) - RIGHT -->
    <!-- Outer: fully rounded, Inner: small rounding -->
    <button
        type="button"
        class="{baseStyles} {variantStyles} h-11 px-5 text-sm rounded-l-[0.3rem] rounded-r-[22px]"
        onclick={handleClick(primaryOnclick)}
        {disabled}
    >
        {primaryLabel}
    </button>
</div>
