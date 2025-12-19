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
        relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500/30
        ${checked 
            ? 'bg-green-200/50 dark:bg-green-900/20 border-green-400/60 dark:border-green-800/50 shadow-sm' 
            : 'bg-gray-200/50 dark:bg-slate-700/50 border-gray-200 dark:border-slate-600'
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
            pointer-events-none inline-block h-5 w-5 transform rounded-full shadow ring-0 transition-all duration-200 ease-in-out
            ${checked ? 'translate-x-[22px] bg-green-900 dark:bg-green-100' : 'translate-x-0.5 bg-white'}
            translate-y-0.5
        `}
    ></span>
</button>
