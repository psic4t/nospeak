<script lang="ts">
    import { hapticSelection } from '$lib/utils/haptics';

    // Props interface using Svelte 5 $props
    type Variant = 'glass' | 'primary' | 'ghost' | 'danger';
    type Size = 'sm' | 'md' | 'lg' | 'icon';

    let { 
        variant = 'glass',
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
    const baseStyles = "inline-flex items-center justify-center rounded-full font-semibold transition-all duration-200 ease-out active:scale-95 disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30";

    // Variant styles
    const variants: Record<Variant, string> = {
        glass: "bg-white/90 dark:bg-slate-800/90 border border-blue-500/10 dark:border-blue-500/15 text-gray-900 dark:text-gray-200 backdrop-blur-md shadow-md hover:bg-blue-500/5 dark:hover:bg-blue-500/10 hover:border-blue-500/20 dark:hover:border-blue-500/25 hover:text-black dark:hover:text-white hover:shadow-lg",
        primary: "bg-green-200/90 dark:bg-green-900/40 text-green-900 dark:text-green-300 border border-green-400/60 dark:border-green-800/50 shadow-md hover:bg-green-300 dark:hover:bg-green-900/60 active:bg-green-400/50 dark:active:bg-green-900/80 hover:text-green-950 dark:hover:text-green-200 hover:shadow-lg",
        ghost: "bg-transparent text-gray-500 dark:text-gray-400 hover:bg-blue-500/5 dark:hover:bg-blue-500/10 active:bg-blue-500/10 dark:active:bg-blue-500/20 hover:text-gray-900 dark:hover:text-white border border-transparent",
        danger: "bg-red-200/90 dark:bg-red-900/40 text-red-900 dark:text-red-300 border border-red-400/60 dark:border-red-800/50 shadow-md hover:bg-red-300 dark:hover:bg-red-900/60 active:bg-red-400/50 dark:active:bg-red-900/80 hover:text-red-950 dark:hover:text-red-200 hover:shadow-lg"
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
