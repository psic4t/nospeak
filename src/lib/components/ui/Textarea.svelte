<script lang="ts">
    import { hapticSelection } from '$lib/utils/haptics';

    let { 
        value = $bindable(),
        placeholder = '',
        id = undefined,
        rows = 3,
        class: className = '',
        disabled = false,
        readonly = false,
        autoGrow = false,
        ...rest 
    } = $props<{
        value?: string;
        placeholder?: string;
        id?: string;
        rows?: number;
        class?: string;
        disabled?: boolean;
        readonly?: boolean;
        autoGrow?: boolean;
        [key: string]: any;
    }>();

    let textareaEl = $state<HTMLTextAreaElement | undefined>(undefined);

    $effect(() => {
        if (autoGrow && textareaEl) {
            // Access value to track it as a dependency
            void value;
            textareaEl.style.height = 'auto';
            textareaEl.style.height = textareaEl.scrollHeight + 'px';
        }
    });

    // Textarea uses rounded-2xl instead of rounded-full for better aesthetics on multiline
    const baseStyles = "w-full px-4 py-3 border border-gray-200 dark:border-slate-700 rounded-2xl bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all placeholder:text-gray-400 dark:placeholder:text-slate-500 disabled:opacity-50 disabled:cursor-not-allowed resize-none";
</script>

<textarea
    {id}
    bind:this={textareaEl}
    bind:value={value}
    {placeholder}
    {rows}
    {disabled}
    {readonly}
    class="{baseStyles} {autoGrow ? 'overflow-hidden' : ''} {className}"
    onclick={hapticSelection}
    {...rest}
></textarea>
