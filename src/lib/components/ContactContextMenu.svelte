<script lang="ts">
    import { t } from '$lib/i18n';

    let { x = 0, y = 0, isOpen = false, onClose, onDelete } = $props<{
        x: number;
        y: number;
        isOpen: boolean;
        onClose: () => void;
        onDelete: () => void;
    }>();

    // Close on outside press (pointerdown) so one tap closes,
    // while long-press open doesn't immediately self-dismiss on release.
    $effect(() => {
        if (!isOpen) return;

        const handlePointerDown = (e: PointerEvent) => {
            const target = e.target as HTMLElement | null;
            if (!target?.closest('.contact-context-menu')) {
                e.stopPropagation();
                e.preventDefault();
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
        class="contact-context-menu fixed bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-gray-200 dark:border-slate-700 rounded-lg shadow-xl py-1 z-[9999] min-w-[140px] outline-none"
    >
        <button
            class="w-full text-start px-4 py-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm text-red-600 dark:text-red-400 transition-colors flex items-center gap-2"
            onclick={() => { onDelete(); onClose(); }}
        >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 6h18"/>
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
            </svg>
            {$t('modals.manageContacts.contextMenu.delete')}
        </button>
    </div>
{/if}
