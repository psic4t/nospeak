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
    class={`
        relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full border transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500/30 active:scale-95
        ${checked 
            ? 'bg-blue-500/10 border-blue-500/30 shadow-sm' 
            : 'bg-transparent border-gray-300 dark:border-slate-700'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        ${className}
    `}
    {...rest}
>
    <span class="sr-only">{label}</span>
    <span
        aria-hidden="true"
        class={`
            pointer-events-none inline-block h-5 w-5 transform rounded-full shadow-sm transition-all duration-200 ease-in-out
            ${checked 
                ? 'translate-x-[22px] bg-blue-400 dark:bg-blue-400' 
                : 'translate-x-1 bg-blue-500/30 dark:bg-blue-400/20'
            }
            translate-y-[3px]
        `}
    ></span>
</button>
