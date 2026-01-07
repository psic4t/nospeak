<script lang="ts">
    import { hapticSelection } from '$lib/utils/haptics';

    // Props interface using Svelte 5 $props
    type Variant = 'filled-tonal' | 'primary' | 'ghost' | 'danger' | 'outlined-chip';
    type Size = 'sm' | 'md' | 'lg' | 'icon';

    let { 
        variant = 'filled-tonal',
        size = 'md',
        disabled = false,
        loading = false,
        href = undefined,
        onclick = undefined,
        type = 'button',
        class: className = '',
        children,
        ...rest 
    } = $props<{
        variant?: Variant;
        size?: Size;
        disabled?: boolean;
        loading?: boolean;
        href?: string;
        onclick?: (e: MouseEvent) => void;
        type?: 'button' | 'submit' | 'reset';
        class?: string;
        children?: import('svelte').Snippet;
        [key: string]: any;
    }>();

    // Base styles
    const baseStyles = "inline-flex items-center justify-center rounded-full font-semibold transition-all duration-200 ease-out disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-lavender-rgb)/0.45)] focus-visible:ring-inset";

    // Variant styles
    const variants: Record<Variant, string> = {
        'filled-tonal': "bg-[rgb(var(--color-lavender-rgb)/0.20)] dark:bg-[rgb(var(--color-lavender-rgb)/0.24)] text-[rgb(var(--color-text-rgb)/0.92)] shadow-sm hover:shadow hover:bg-[rgb(var(--color-lavender-rgb)/0.26)] dark:hover:bg-[rgb(var(--color-lavender-rgb)/0.30)] active:bg-[rgb(var(--color-lavender-rgb)/0.32)] dark:active:bg-[rgb(var(--color-lavender-rgb)/0.36)]",
        primary: "bg-[rgb(var(--color-lavender-rgb))] text-white dark:text-[rgb(var(--color-crust-rgb))] shadow-md hover:bg-[rgb(var(--color-lavender-rgb)/0.9)] active:bg-[rgb(var(--color-lavender-rgb)/0.8)] hover:shadow-lg",
        ghost: "bg-transparent text-gray-500 dark:text-gray-400 hover:bg-blue-500/5 dark:hover:bg-blue-500/10 active:bg-blue-500/10 dark:active:bg-blue-500/20 hover:text-gray-900 dark:hover:text-white border border-transparent focus-visible:ring-[rgb(var(--color-lavender-rgb)/0.45)] focus-visible:ring-inset",
        danger: "bg-[rgb(var(--color-red-rgb))] text-white dark:text-[rgb(var(--color-crust-rgb))] shadow-md hover:bg-[rgb(var(--color-red-rgb)/0.9)] active:bg-[rgb(var(--color-red-rgb)/0.8)] hover:shadow-lg",
        'outlined-chip': "bg-transparent !rounded-lg border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-800 active:bg-gray-200 dark:active:bg-slate-700 shadow-sm"
    };

    // Size styles
    const sizes: Record<Size, string> = {
        sm: "h-8 px-3 text-xs",
        md: "h-11 px-5 text-sm",
        lg: "h-12 px-6 text-base",
        icon: "h-11 w-11 p-0"
    };

    // Derived classes
    let classes = $derived(`${baseStyles} ${variants[variant as Variant]} ${sizes[size as Size]} ${className}`);

    function handleClick(e: MouseEvent) {
        if (!disabled && !loading) {
            hapticSelection();
            if (onclick) onclick(e);
        }
    }
</script>

{#if href}
    <a 
        {href}
        class={classes}
        onclick={handleClick}
        {...rest}
    >
        {#if loading}
            <svg class="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
        {/if}
        {@render children?.()}
    </a>
{:else}
    <button
        {type}
        class={classes}
        {disabled}
        onclick={handleClick}
        {...rest}
    >
        {#if loading}
            <svg class="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
        {/if}
        {@render children?.()}
    </button>
{/if}
