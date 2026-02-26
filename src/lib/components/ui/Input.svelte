<script lang="ts">
    import { hapticSelection } from '$lib/utils/haptics';

    let { 
        value = $bindable(),
        type = 'text',
        placeholder = '',
        id = undefined,
        class: className = '',
        disabled = false,
        readonly = false,
        dir = undefined,
        oninput = undefined,
        onkeydown = undefined,
        ...rest 
    } = $props<{
        value?: string | number;
        type?: string;
        placeholder?: string;
        id?: string;
        class?: string;
        disabled?: boolean;
        readonly?: boolean;
        dir?: 'ltr' | 'rtl' | 'auto';
        oninput?: (e: Event) => void;
        onkeydown?: (e: KeyboardEvent) => void;
        [key: string]: any;
    }>();

    const baseStyles = "w-full px-4 h-11 border border-gray-200 dark:border-slate-700 rounded-full bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all placeholder:text-gray-400 dark:placeholder:text-slate-500 disabled:opacity-50 disabled:cursor-not-allowed";
</script>

<input
    {id}
    {type}
    bind:value={value}
    {placeholder}
    {disabled}
    {readonly}
    {dir}
    class="{baseStyles} {className}"
    oninput={oninput}
    onkeydown={onkeydown}
    onclick={hapticSelection}
    {...rest}
/>
