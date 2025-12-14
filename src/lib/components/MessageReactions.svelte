<script lang="ts">
    import { onMount } from 'svelte';
    import { IntersectionObserverManager } from '$lib/utils/observers';
    import { reactionsStore, type ReactionSummary } from '$lib/stores/reactions';

    let { targetEventId, isOwn = false } = $props<{ targetEventId: string; isOwn?: boolean }>();

    let container: HTMLElement | null = null;
    let isVisible = $state(false);
    let summaries = $state<ReactionSummary[]>([]);
    let unsubscribe: (() => void) | null = null;

    onMount(() => {
        if (typeof window === 'undefined') return;
        if (!container) {
            // Treat as visible fallback
            isVisible = true;
            return;
        }

        const manager = IntersectionObserverManager.getInstance();
        manager.observe(container, (entry) => {
            isVisible = entry.isIntersecting;
        });

        return () => {
            if (container) manager.unobserve(container);
            if (unsubscribe) {
                unsubscribe();
                unsubscribe = null;
            }
        };
    });

    $effect(() => {
        if (!targetEventId) return;

        if (!isVisible) {
            if (unsubscribe) {
                unsubscribe();
                unsubscribe = null;
            }
            return;
        }

        reactionsStore.refreshSummariesForTarget(targetEventId).then(() => {
            if (unsubscribe) {
                unsubscribe();
            }
            unsubscribe = reactionsStore.subscribeToMessageReactions(targetEventId, (value) => {
                summaries = value;
            });
        });
    });
</script>

<div bind:this={container} class="w-full h-0">
    {#if isVisible && summaries.length > 0}
        <div class={`absolute -bottom-3 ${isOwn ? 'right-2' : 'left-2'} flex flex-wrap gap-1 text-xs z-10`}>
            {#each summaries as summary}
                <div
                    class={`inline-flex items-center px-1.5 py-0.5 rounded-full border text-[10px] shadow-sm backdrop-blur-md
                        border-gray-200/50 bg-white/90 text-gray-700 dark:border-slate-600/50 dark:bg-slate-800/90 dark:text-slate-200
                        ${summary.byCurrentUser ? ' font-semibold ring-1 ring-offset-0 ' + (isOwn ? 'ring-blue-300 dark:ring-blue-600' : 'ring-gray-300 dark:ring-slate-500') : ''}`}
                >
                    <span>{summary.emoji}</span>
                </div>
            {/each}
        </div>
    {/if}
</div>

