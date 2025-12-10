# Design: Scrolling Optimization

## 1. CSS Performance Optimizations

### Disable Blur on Scrolling Elements
On Android (and potentially all mobile devices), `backdrop-filter: blur` is expensive when applied to moving elements.

*   **Strategy:** We will use a CSS class or media query strategy to disable `backdrop-filter` on `.message-bubble` (or equivalent) elements when running in the Android context or on small screens.
*   **Fallback:** Use a solid semi-transparent background color (e.g., `bg-white/90` instead of `bg-white/70` + blur) to maintain contrast without the GPU cost.
*   **Scope:** Keep blurs on static elements like the Header and Footer, as they don't trigger repaints as often during scroll (though they are composited). If performance is still poor, we can remove them there too.

## 2. List Virtualization

### `VirtualList` Component
We need a virtual list implementation that works with Svelte 5 (runes).

*   **Behavior:**
    *   Takes a list of items (`messages`).
    *   Calculates the total height based on item heights (can be dynamic or fixed, dynamic is harder but necessary for chat).
    *   Renders only the items that intersect with the viewport (plus a buffer).
    *   Maintains scroll position when new items are added (especially at the top for history loading).

### Chat View Integration
*   The `ChatView.svelte` currently renders a simple `{#each}` loop.
*   We will replace this with `<VirtualList items={messages} let:item> ... </VirtualList>`.
*   **Challenges:**
    *   **Dynamic Heights:** Message bubbles have variable heights. The virtual list needs to measure them after rendering and adjust the scroll offset to prevent jumping.
    *   **Scroll-to-Bottom:** Chat needs to start at the bottom.
    *   **History Loading:** Loading more messages at the top should not displace the current view.
    *   **Scroll Anchoring:** Dynamic height adjustments (when estimated sizes are replaced by actual measurements) can cause "jumping" during scroll. The virtual list must implement scroll compensation: if an item above the viewport expands, the scroll position must be increased by the same amount to keep the viewport content stable.

### Observer Optimization
*   **Problem:** Creating a new `ResizeObserver` for every item in `VirtualList` and a new `IntersectionObserver` for every `MessageContent` is extremely expensive on mobile.
*   **Solution:** Implement a shared `ObserverManager` that maintains singleton observer instances. Components will register callbacks with this manager instead of instantiating new browser APIs.

### URL Preview Debouncing
*   **Problem:** Rapid scrolling triggers immediate fetch requests for every link that flashes into the viewport.
*   **Solution:** Debounce URL preview fetches (e.g., 300ms). If an item leaves the viewport before the timeout, the fetch is cancelled.

### Scroll-to-Bottom Reliability
*   **Problem:** Native browser scroll anchoring fights with manual scroll adjustments, causing unreliability on Firefox/Android.
*   **Solution:** 
    *   Disable native anchoring via `overflow-anchor: none`.
    *   Use absolute "force to bottom" (`scrollTop = scrollHeight`) instead of relative delta adjustments when in sticky mode.

## 3. Implementation Phasing
1.  **Phase 1 (CSS):** Rapidly deploy the CSS changes to fix the immediate "jank". This is low risk and high impact.
2.  **Phase 2 (Virtualization):** Implement and test the `VirtualList`. This is more complex and carries regression risks (scrolling bugs).

*Note: The current proposal focuses on delivering both.*
