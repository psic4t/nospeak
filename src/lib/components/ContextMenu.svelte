<script lang="ts">
    import { t } from '$lib/i18n';

    let { x = 0, y = 0, isOpen = false, onClose, onCite, onReact, onCopy } = $props<{
        x: number;
        y: number;
        isOpen: boolean;
        onClose: () => void;
        onCite: () => void;
        onReact: (emoji: '👍' | '👎' | '❤️' | '😂') => void;
        onCopy: () => void;
    }>();

    // Close on outside press (pointerdown) so one tap closes,
    // while long-press open doesn't immediately self-dismiss on release.
    $effect(() => {
        if (!isOpen) return;

        const handlePointerDown = (e: PointerEvent) => {
            const target = e.target as HTMLElement | null;
            if (!target?.closest('.context-menu')) {
                onClose();
            }
        };

        // Use capture so we close before other handlers run.
        document.addEventListener('pointerdown', handlePointerDown, true);

        return () => {
            document.removeEventListener('pointerdown', handlePointerDown, true);
        };
    });

    function portal(node: HTMLElement) {
        document.body.appendChild(node);
        return {
            destroy() {
                if (node.parentNode) {
                    node.parentNode.removeChild(node);
                }
            }
        };
    }

    function reposition(node: HTMLElement, coords: { x: number, y: number }) {
        const update = ({ x, y }: { x: number, y: number }) => {
            const rect = node.getBoundingClientRect();
            const { innerWidth, innerHeight } = window;
            const padding = 8;

            let safeX = x;
            let safeY = y;

            // Horizontal clamping
            if (safeX + rect.width > innerWidth - padding) {
                safeX = innerWidth - rect.width - padding;
            }
            if (safeX < padding) {
                safeX = padding;
            }

            // Vertical clamping
            if (safeY + rect.height > innerHeight - padding) {
                safeY = innerHeight - rect.height - padding;
            }
            if (safeY < padding) {
                safeY = padding;
            }

            node.style.left = `${safeX}px`;
            node.style.top = `${safeY}px`;
        };

        update(coords);

        return {
            update
        };
    }
</script>

{#if isOpen}
    <div 
        use:portal
        use:reposition={{x, y}}
        class="context-menu fixed bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-gray-200 dark:border-slate-700 rounded-lg shadow-xl py-1 z-[9999] min-w-[140px] outline-none"
    >
        <div class="flex px-2 pt-1 pb-1 gap-1 border-b border-gray-200/70 dark:border-slate-700/70">
            {#each ['👍','👎','❤️','😂'] as emoji}
                <button
                    type="button"
                    class="flex-1 px-1 py-1 rounded-md hover:bg-gray-100/70 dark:hover:bg-slate-700/70 text-lg text-center"
                    onclick={() => { onReact(emoji as '👍' | '👎' | '❤️' | '😂'); onClose(); }}
                >
                    {emoji}
                </button>
            {/each}
        </div>
        <button 
            class="w-full text-left px-4 py-2 hover:bg-gray-100/50 dark:hover:bg-slate-700/50 text-sm dark:text-white transition-colors"
            onclick={() => { onCite(); onClose(); }}
        >
            {$t('chat.contextMenu.cite')}
        </button>
        <button 
            class="w-full text-left px-4 py-2 hover:bg-gray-100/50 dark:hover:bg-slate-700/50 text-sm dark:text-white transition-colors"
            onclick={() => { onCopy(); onClose(); }}
        >
            {$t('chat.contextMenu.copy')}
        </button>
    </div>
{/if}
