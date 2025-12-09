<script lang="ts">
    let { x = 0, y = 0, isOpen = false, onClose, onCite } = $props<{
        x: number;
        y: number;
        isOpen: boolean;
        onClose: () => void;
        onCite: () => void;
    }>();

    // Close on click outside
    $effect(() => {
        if (isOpen) {
            let isMenuJustOpened = true;
            
            const handleClick = (e: MouseEvent) => {
                const target = e.target as HTMLElement;
                if (!target.closest('.context-menu') && !isMenuJustOpened) {
                    onClose();
                }
                isMenuJustOpened = false;
            };
            
            // Add listener with a small delay to avoid catching the opening click
            const timeoutId = setTimeout(() => {
                document.addEventListener('click', handleClick);
            }, 10);
            
            return () => {
                clearTimeout(timeoutId);
                document.removeEventListener('click', handleClick);
            };
        }
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
</script>

{#if isOpen}
    <div 
        use:portal
        class="context-menu fixed bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-gray-200 dark:border-slate-700 rounded-lg shadow-xl py-1 z-[9999] min-w-[120px] outline-none"
        style="left: {x}px; top: {y}px;"
    >
        <button 
            class="w-full text-left px-4 py-2 hover:bg-gray-100/50 dark:hover:bg-slate-700/50 text-sm dark:text-white transition-colors"
            onclick={() => { onCite(); onClose(); }}
        >
            Cite
        </button>
    </div>
{/if}