<script lang="ts" generics="T">
    import { onMount, tick } from 'svelte';
    import { ResizeObserverManager } from '$lib/utils/observers';
    
    // Props
    let { 
        items, 
        estimateSize = 100,
        getKey = (item: T) => (item as any).id,
        itemClass = "",
        children,
        header,
        footer,
        onScroll,
        viewportHeight = 0
    } = $props<{
        items: T[];
        estimateSize?: number;
        getKey?: (item: T) => any;
        children: any;
        header?: any;
        footer?: any;
        onScroll?: (e: Event) => void;
        viewportHeight?: number;
        itemClass?: string;
    }>();

    // State
    let scrollContainer: HTMLElement;
    let headerContainer: HTMLElement;
    let scrollTop = $state(0);
    let containerHeight = $state(0);
    let headerHeight = $state(0);
    let measuredSizes = $state<Record<string, number>>({});
    let stickToBottom = $state(false);
    let isAdjustingScroll = false;
    let spacer: HTMLElement;
    
    // Helper to get size or estimate
    function getSize(item: T) {
        const key = getKey(item);
        return measuredSizes[key] || estimateSize;
    }

    // Derived state for virtualization
    let totalHeight = $derived(items.reduce((acc: number, item: T) => acc + getSize(item), 0));
    
    let visibleRange = $derived.by(() => {
        let start = 0;
        let offset = 0;
        const effectiveScrollTop = Math.max(0, scrollTop - headerHeight);
        
        // Find start index
        while (start < items.length && offset + getSize(items[start]) < effectiveScrollTop) {
            offset += getSize(items[start]);
            start++;
        }

        // Find end index
        let end = start;
        let visibleSize = 0;
        const targetHeight = containerHeight || viewportHeight || 800; // Fallback
        
        while (end < items.length && visibleSize < targetHeight) {
            visibleSize += getSize(items[end]);
            end++;
        }
        
        // Add buffer
        const buffer = 5;
        return {
            start: Math.max(0, start - buffer),
            end: Math.min(items.length, end + buffer),
            paddingTop: items.slice(0, Math.max(0, start - buffer)).reduce((acc: number, item: T) => acc + getSize(item), 0)
        };
    });

    // Measurement
    function measureElement(node: HTMLElement, initialIndex: number) {
        if (!node) return;
        
        let index = initialIndex;
        const manager = ResizeObserverManager.getInstance();
        
        manager.observe(node, (entry) => {
            if (entry.borderBoxSize && entry.borderBoxSize.length > 0) {
                const height = entry.borderBoxSize[0].blockSize;
                const item = items[index];
                if (item) {
                    const key = getKey(item);
                    const oldHeight = measuredSizes[key] || estimateSize;
                    if (measuredSizes[key] !== height) {
                        measuredSizes[key] = height;

                        // Scroll Anchoring
                        if (scrollContainer) {
                            if (!stickToBottom) {
                                // Calculate where this item 'starts' in the virtual space
                                let itemStart = 0;
                                for (let i = 0; i < index; i++) {
                                    itemStart += getSize(items[i]);
                                }

                                const effectiveScrollTop = Math.max(0, scrollTop - headerHeight);

                                // If the item starts before the current scroll position,
                                // its expansion pushes the current view down. We need to correct it.
                                // Also handle partially visible items at the top.
                                if (itemStart < effectiveScrollTop) {
                                    const delta = height - oldHeight;
                                    isAdjustingScroll = true;
                                    scrollContainer.scrollTop += delta;
                                    // Debounce clearing the flag to capture the async scroll event
                                    setTimeout(() => { isAdjustingScroll = false; }, 50);
                                }
                            } else {
                                // Sync Stick-to-Bottom
                                // When sticking to bottom, any size change above means we must scroll down 
                                // to maintain the bottom lock.
                                
                                const delta = height - oldHeight;
                                if (delta !== 0) {
                                    isAdjustingScroll = true;
                                    
                                    // If expanding, ensure the spacer is large enough immediately
                                    if (delta > 0 && spacer) {
                                        const currentHeight = totalHeight;
                                        spacer.style.height = `${currentHeight + delta}px`;
                                    }

                                    // Force to bottom using absolute calculation instead of delta
                                    // This is more robust against browser rounding errors and native scroll anchoring
                                    scrollContainer.scrollTop = scrollContainer.scrollHeight;
                                    
                                    // Debounce clearing the flag to capture the async scroll event
                                    setTimeout(() => { isAdjustingScroll = false; }, 50);
                                }
                            }
                        }
                    }
                }
            }
        });
        
        return {
            update(newIndex: number) {
                index = newIndex;
            },
            destroy() {
                manager.unobserve(node);
            }
        };
    }

    // Effect to handle sticky bottom
    $effect(() => {
        totalHeight; // depend on totalHeight
        if (stickToBottom && scrollContainer) {
            tick().then(() => {
                if (scrollContainer) {
                    scrollContainer.scrollTop = scrollContainer.scrollHeight;
                }
            });
        }
    });

    // Measure Header
    function measureHeader(node: HTMLElement) {
        const manager = ResizeObserverManager.getInstance();
        manager.observe(node, (entry) => {
            if (entry.borderBoxSize && entry.borderBoxSize.length > 0) {
                headerHeight = entry.borderBoxSize[0].blockSize;
            }
        });
        return { destroy() { manager.unobserve(node); } };
    }

    // Public methods
    export function scrollToBottom() {
        if (scrollContainer) {
            stickToBottom = true;
            isAdjustingScroll = true;
            tick().then(() => {
                if (scrollContainer) {
                    scrollContainer.scrollTop = scrollContainer.scrollHeight;
                    // Allow a small delay for the scroll event to fire before re-enabling manual control checks
                    setTimeout(() => {
                        isAdjustingScroll = false;
                    }, 50);
                } else {
                     isAdjustingScroll = false;
                }
            });
        }
    }

    export function getScrollContainer() {
        return scrollContainer;
    }

    function handleScroll(e: Event) {
        scrollTop = (e.target as HTMLElement).scrollTop;
        if (onScroll) onScroll(e);
        
        if (isAdjustingScroll) return;

        if (scrollContainer) {
            const isAtBottom = scrollContainer.scrollTop + scrollContainer.clientHeight >= scrollContainer.scrollHeight - 20;
            if (!isAtBottom) {
                stickToBottom = false;
            } else {
                // If user scrolls to bottom, we can re-enable sticky behavior
                stickToBottom = true;
            }
        }
    }
    
    onMount(() => {
        if (scrollContainer) {
            containerHeight = scrollContainer.clientHeight;
            const manager = ResizeObserverManager.getInstance();
            manager.observe(scrollContainer, (entry) => {
                containerHeight = entry.contentRect.height;
            });
            return () => manager.unobserve(scrollContainer);
        }
    });

</script>

<div 
    bind:this={scrollContainer}
    class="flex-1 overflow-y-auto px-4 pb-28 pt-20 space-y-4 custom-scrollbar h-full w-full relative" 
    style="overflow-anchor: none;"
    onscroll={handleScroll}
>
    {#if header}
        <div use:measureHeader>
            {@render header()}
        </div>
    {/if}

    <!-- Spacer for total height -->
    <div 
        bind:this={spacer}
        style="height: {totalHeight}px; position: relative; width: 100%;"
    >
        <!-- Rendered items positioned absolutely or using padding-top -->
        <!-- Using padding-top strategy avoids absolute positioning complexity for flow -->
        <div style="transform: translateY({visibleRange.paddingTop}px);">
            {#each items.slice(visibleRange.start, visibleRange.end) as item, i (getKey(item))}
                <div use:measureElement={visibleRange.start + i} class={itemClass}>
                    {@render children({ item, index: visibleRange.start + i })}
                </div>
            {/each}
        </div>
    </div>
    
    {#if footer}
        <div>
            {@render footer()}
        </div>
    {/if}
</div>
