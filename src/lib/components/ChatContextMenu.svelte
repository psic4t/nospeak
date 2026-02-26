<script lang="ts">
    import { t } from '$lib/i18n';
    import { isAndroidNative } from '$lib/core/NativeDialogs';

    let { x = 0, y = 0, isOpen = false, onClose, onExport, onArchive, isArchived = false } = $props<{
        x: number;
        y: number;
        isOpen: boolean;
        onClose: () => void;
        onExport?: () => void;
        onArchive: () => void;
        isArchived?: boolean;
    }>();

    const isAndroid = isAndroidNative();

    // Close on outside press (pointerdown) so one tap closes,
    // while long-press open doesn't immediately self-dismiss on release.
    $effect(() => {
        if (!isOpen) return;

        const handlePointerDown = (e: PointerEvent) => {
            const target = e.target as HTMLElement | null;
            if (!target?.closest('.chat-context-menu')) {
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
        class="chat-context-menu fixed bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-gray-200 dark:border-slate-700 rounded-lg shadow-xl py-1 z-[9999] min-w-[160px] outline-none"
    >
        {#if !isAndroid && onExport}
            <button
                class="w-full text-start px-4 py-2 hover:bg-gray-100/50 dark:hover:bg-slate-700/50 text-sm dark:text-white transition-colors flex items-center gap-2"
                onclick={() => { onExport(); onClose(); }}
            >
                <!-- Export icon (download/arrow-down-to-line) -->
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 3v12"/>
                    <path d="m8 11 4 4 4-4"/>
                    <path d="M8 5H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-4"/>
                </svg>
                {$t('chats.export')}
            </button>
        {/if}
        <button
            class="w-full text-start px-4 py-2 hover:bg-gray-100/50 dark:hover:bg-slate-700/50 text-sm dark:text-white transition-colors flex items-center gap-2"
            onclick={() => { onArchive(); onClose(); }}
        >
            {#if isArchived}
                <!-- Unarchive icon (box with arrow up) -->
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="m21.8 14.9-6-10.4a2.1 2.1 0 0 0-3.6 0l-6 10.4a2.1 2.1 0 0 0 1.8 3.1h12a2.1 2.1 0 0 0 1.8-3.1Z"/>
                    <path d="m12 14-4-4"/>
                    <path d="m12 14 4-4"/>
                </svg>
                {$t('chats.unarchive')}
            {:else}
                <!-- Archive icon (box) -->
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="m21.8 14.9-6-10.4a2.1 2.1 0 0 0-3.6 0l-6 10.4a2.1 2.1 0 0 0 1.8 3.1h12a2.1 2.1 0 0 0 1.8-3.1Z"/>
                    <path d="M12 10v8"/>
                    <path d="m9 13 3-3 3 3"/>
                </svg>
                {$t('chats.archive')}
            {/if}
        </button>
    </div>
{/if}
