<script lang="ts">
    import { toasts, dismissToast, type Toast } from '$lib/stores/toast';
    import { fly } from 'svelte/transition';

    const typeStyles = {
        info: 'bg-[rgb(var(--color-lavender-rgb))] text-white',
        success: 'bg-[rgb(var(--color-green-rgb))] text-white',
        error: 'bg-[rgb(var(--color-red-rgb))] text-white'
    };

    function handleClick(toast: Toast) {
        if (toast.onClick) {
            toast.onClick();
        }
        dismissToast(toast.id);
    }
</script>

<div class="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] flex flex-col gap-2 pointer-events-none">
    {#each $toasts as toast (toast.id)}
        <button
            class="px-4 py-3 rounded-xl shadow-lg typ-body pointer-events-auto cursor-pointer {typeStyles[toast.type]}"
            transition:fly={{ y: 50, duration: 200 }}
            onclick={() => handleClick(toast)}
        >
            {toast.message}
        </button>
    {/each}
</div>
