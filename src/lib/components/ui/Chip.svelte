<script lang="ts">
    let {
        class: className = '',
        children
    } = $props<{
        class?: string;
        children?: import('svelte').Snippet;
    }>();
</script>

<span
    class="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-200 {className}"
>
    {@render children?.()}
</span>
