<script lang="ts">
    import { tick } from 'svelte';
    import { hapticSelection } from '$lib/utils/haptics';

    export type TabItem = {
        value: string;
        label: string;
        disabled?: boolean;
        ariaLabel?: string;
    };

    let {
        value = $bindable<string>(),
        tabs,
        ariaLabel = 'Tabs',
        class: className = '',
        progress
    } = $props<{
        value?: string;
        tabs: TabItem[];
        ariaLabel?: string;
        class?: string;
        /** Fractional tab index (0 to tabs.length-1) for smooth indicator interpolation during swipe. */
        progress?: number;
    }>();

    let tablistEl = $state<HTMLDivElement | null>(null);
    let indicatorLeft = $state(0);
    let indicatorWidth = $state(0);
    let indicatorVisible = $state(false);
    let indicatorAnimated = $state(true);
    let resizeObserver: ResizeObserver | null = null;

    // Drag-to-scroll state (desktop)
    let isDragging = false;
    let dragStartX = 0;
    let scrollLeftStart = 0;
    let hasDragged = false;
    const DRAG_THRESHOLD = 5;

    function cssEscape(value: string): string {
        // CSS.escape is not supported everywhere (and not always typed).
        // This fallback is sufficient for our tab value strings.
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const esc = (globalThis as any).CSS?.escape;
            if (typeof esc === 'function') {
                return esc(value);
            }
        } catch {
            // ignore
        }

        return value.replace(/[^a-zA-Z0-9_-]/g, '\\$&');
    }

    async function updateIndicator(): Promise<void> {
        await tick();

        if (!tablistEl || tabs.length === 0) {
            indicatorVisible = false;
            return;
        }

        const selector = `button[data-tab-value="${cssEscape(value)}"]`;
        const btn = tablistEl.querySelector<HTMLButtonElement>(selector);
        if (!btn) {
            indicatorVisible = false;
            return;
        }

        const containerRect = tablistEl.getBoundingClientRect();
        const rect = btn.getBoundingClientRect();

        // Material 3 primary tabs: short indicator under label area.
        // Account for scrollLeft so the indicator stays aligned when scrolled.
        const inset = 14;
        const left = rect.left - containerRect.left + tablistEl.scrollLeft + inset;
        const width = Math.max(24, rect.width - inset * 2);

        indicatorLeft = Math.max(0, left);
        indicatorWidth = Math.max(0, width);
        indicatorVisible = true;
    }

    function selectTab(tab: TabItem): void {
        if (tab.disabled) {
            return;
        }

        hapticSelection();
        value = tab.value;

        // Scroll the selected tab into view
        if (tablistEl) {
            const selector = `button[data-tab-value="${cssEscape(tab.value)}"]`;
            const btn = tablistEl.querySelector<HTMLButtonElement>(selector);
            btn?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        }
    }

    // --- Drag-to-scroll handlers (desktop) ---

    function onDocumentMouseMove(e: MouseEvent): void {
        if (!isDragging || !tablistEl) return;
        const dx = e.clientX - dragStartX;
        if (Math.abs(dx) > DRAG_THRESHOLD) {
            hasDragged = true;
        }
        tablistEl.scrollLeft = scrollLeftStart - dx;
    }

    function onDocumentMouseUp(): void {
        if (!isDragging) return;
        isDragging = false;
        document.removeEventListener('mousemove', onDocumentMouseMove);
        document.removeEventListener('mouseup', onDocumentMouseUp);
    }

    function handleMouseDown(e: MouseEvent): void {
        if (!tablistEl || e.button !== 0) return;
        isDragging = true;
        hasDragged = false;
        dragStartX = e.clientX;
        scrollLeftStart = tablistEl.scrollLeft;
        document.addEventListener('mousemove', onDocumentMouseMove);
        document.addEventListener('mouseup', onDocumentMouseUp);
    }

    // --- Wheel handler: convert vertical wheel to horizontal scroll ---

    function handleWheel(e: WheelEvent): void {
        if (!tablistEl) return;
        // Only hijack when the container is actually scrollable
        if (tablistEl.scrollWidth <= tablistEl.clientWidth) return;
        e.preventDefault();
        tablistEl.scrollLeft += e.deltaY || e.deltaX;
    }

    function handleKeydown(e: KeyboardEvent): void {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Home' && e.key !== 'End') {
            return;
        }

        e.preventDefault();

        const enabledTabs = tabs.filter((tab: TabItem) => !tab.disabled);
        if (enabledTabs.length === 0) {
            return;
        }

        const currentIndex = enabledTabs.findIndex((tab: TabItem) => tab.value === value);
        const startIndex = currentIndex >= 0 ? currentIndex : 0;

        if (e.key === 'Home') {
            selectTab(enabledTabs[0]);
            return;
        }

        if (e.key === 'End') {
            selectTab(enabledTabs[enabledTabs.length - 1]);
            return;
        }

        const delta = e.key === 'ArrowRight' ? 1 : -1;
        const nextIndex = (startIndex + delta + enabledTabs.length) % enabledTabs.length;
        selectTab(enabledTabs[nextIndex]);
    }

    /**
     * When `progress` is provided (during swipe), interpolate the indicator
     * position between the two adjacent tab buttons for smooth tracking.
     */
    function updateIndicatorFromProgress(p: number): void {
        if (!tablistEl || tabs.length === 0) return;

        const buttons = tabs.map((tab: TabItem) => {
            const selector = `button[data-tab-value="${cssEscape(tab.value)}"]`;
            return tablistEl!.querySelector<HTMLButtonElement>(selector);
        });

        const floorIdx = Math.max(0, Math.min(tabs.length - 1, Math.floor(p)));
        const ceilIdx = Math.min(tabs.length - 1, floorIdx + 1);
        const frac = p - floorIdx;

        const btnA = buttons[floorIdx];
        const btnB = buttons[ceilIdx];
        if (!btnA || !btnB) return;

        const containerRect = tablistEl.getBoundingClientRect();
        const scrollLeft = tablistEl.scrollLeft;
        const inset = 14;

        const rectA = btnA.getBoundingClientRect();
        const rectB = btnB.getBoundingClientRect();

        const leftA = rectA.left - containerRect.left + scrollLeft + inset;
        const widthA = Math.max(24, rectA.width - inset * 2);
        const leftB = rectB.left - containerRect.left + scrollLeft + inset;
        const widthB = Math.max(24, rectB.width - inset * 2);

        indicatorLeft = Math.max(0, leftA + (leftB - leftA) * frac);
        indicatorWidth = Math.max(0, widthA + (widthB - widthA) * frac);
        indicatorVisible = true;
        indicatorAnimated = false;
    }

    $effect(() => {
        // Ensure the underline follows selection changes.
        value;
        tabs.length;

        // When progress is undefined (no active swipe), use standard snap indicator
        if (progress === undefined) {
            indicatorAnimated = true;
            void updateIndicator();
        }
    });

    // Track progress changes for smooth interpolation during swipe
    $effect(() => {
        if (progress !== undefined) {
            updateIndicatorFromProgress(progress);
        }
    });

    // Update indicator when the tab container is scrolled.
    $effect(() => {
        if (!tablistEl) return;
        const el = tablistEl;
        const onScroll = () => void updateIndicator();
        el.addEventListener('scroll', onScroll, { passive: true });
        return () => el.removeEventListener('scroll', onScroll);
    });

    // Wheel: convert vertical scroll to horizontal (needs passive: false for preventDefault).
    $effect(() => {
        if (!tablistEl) return;
        const el = tablistEl;
        el.addEventListener('wheel', handleWheel, { passive: false });
        return () => el.removeEventListener('wheel', handleWheel);
    });

    $effect(() => {
        if (!tablistEl || typeof ResizeObserver === 'undefined') {
            return;
        }

        resizeObserver?.disconnect();
        resizeObserver = new ResizeObserver(() => {
            void updateIndicator();
        });
        resizeObserver.observe(tablistEl);

        return () => {
            resizeObserver?.disconnect();
            resizeObserver = null;
        };
    });

    $effect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        const onResize = () => {
            void updateIndicator();
        };

        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    });
</script>

<div class="relative {className}">
    <div
        bind:this={tablistEl}
        role="tablist"
        aria-label={ariaLabel}
        tabindex="0"
        class="relative flex items-center justify-start gap-1 overflow-x-auto scrollbar-hide border-b border-gray-200/70 dark:border-slate-700/70"
        onkeydown={handleKeydown}
        onmousedown={handleMouseDown}
    >
        {#each tabs as tab, i (tab.value)}
            <button
                type="button"
                data-tab-value={tab.value}
                role="tab"
                aria-label={tab.ariaLabel ?? tab.label}
                aria-selected={tab.value === value}
                tabindex={tab.value === value ? 0 : -1}
                disabled={tab.disabled}
                onclick={() => { if (!hasDragged) selectTab(tab); }}
                class="relative h-12 px-4 -mb-px text-sm font-semibold whitespace-nowrap flex-shrink-0 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-lavender-rgb)/0.45)] focus-visible:ring-inset disabled:opacity-50 disabled:pointer-events-none rounded-t-xl {tab.value === value ? 'text-[rgb(var(--color-lavender-rgb))]' : 'text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white hover:bg-[rgb(var(--color-lavender-rgb)/0.08)] active:bg-[rgb(var(--color-lavender-rgb)/0.14)]'}"
            >
                {tab.label}
            </button>
        {/each}

        <div
            aria-hidden="true"
            class="absolute bottom-0 h-[3px] rounded-full bg-[rgb(var(--color-lavender-rgb))] {indicatorAnimated ? 'transition-[transform,width,opacity] duration-200 ease-out' : ''}"
            style="width: {indicatorWidth}px; transform: translateX({indicatorLeft}px); opacity: {indicatorVisible ? 1 : 0};"
        ></div>
    </div>
</div>

<style>
    .scrollbar-hide {
        -ms-overflow-style: none;
        scrollbar-width: none;
    }
    .scrollbar-hide::-webkit-scrollbar {
        display: none;
    }
</style>
