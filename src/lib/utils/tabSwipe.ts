import { isAndroidCapacitorShell } from './platform';
import { hapticSelection } from './haptics';

interface TabSwipeOptions {
    /** Total number of tab panels */
    tabCount: number;
    /** Current active panel index (0-based) */
    activeIndex: number;
    /** Called when the active panel changes */
    onIndexChange: (index: number) => void;
    /** Called during swipe with fractional progress (0 to tabCount-1) for indicator sync */
    onProgress?: (progress: number) => void;
    /** Minimum fraction of container width to trigger tab change (default: 0.25) */
    swipeThreshold?: number;
    /** Minimum velocity in px/ms to trigger tab change (default: 0.3) */
    velocityThreshold?: number;
    /** Animation duration in ms (default: 250) */
    animationDuration?: number;
}

/**
 * Svelte action that adds horizontal swipe-to-switch-tabs on Android.
 *
 * Applied to a flex container whose direct children are the tab panels.
 * Each panel should be `width: 100%; flex-shrink: 0`.
 *
 * The action translates the container horizontally to show the active panel,
 * follows the finger during swipe, and snaps to the nearest tab on release.
 *
 * @example
 * <div use:tabSwipe={{ tabCount: 4, activeIndex: idx, onIndexChange: (i) => idx = i }}>
 *   <div class="panel">Panel 1</div>
 *   <div class="panel">Panel 2</div>
 * </div>
 */
export function tabSwipe(node: HTMLElement, options: TabSwipeOptions) {
    // Only enable on Android
    if (!isAndroidCapacitorShell()) {
        // Still position the container for desktop (inline to avoid TDZ with tabCount)
        const setTranslate = (opts: TabSwipeOptions) => {
            const pct = -(opts.activeIndex * 100) / opts.tabCount;
            node.style.transition = 'none';
            node.style.transform = `translateX(${pct}%)`;
        };
        setTranslate(options);
        return {
            update(newOptions: TabSwipeOptions) {
                setTranslate(newOptions);
            },
            destroy() {}
        };
    }

    let {
        tabCount,
        activeIndex,
        onIndexChange,
        onProgress,
        swipeThreshold = 0.25,
        velocityThreshold = 0.3,
        animationDuration = 250
    } = options;

    // Touch tracking state
    let touchId: number | null = null;
    let startX = 0;
    let startY = 0;
    let currentX = 0;
    let axisLocked: 'horizontal' | 'vertical' | null = null;
    let isSwiping = false;
    let startTime = 0;

    const AXIS_LOCK_THRESHOLD = 10; // px before we decide direction

    function getContainerWidth(): number {
        return node.parentElement?.clientWidth ?? node.clientWidth / tabCount;
    }

    function applyTranslate(index: number, animate: boolean): void {
        const pct = -(index * 100) / tabCount;
        if (animate) {
            node.style.transition = `transform ${animationDuration}ms cubic-bezier(0.4, 0, 0.2, 1)`;
        } else {
            node.style.transition = 'none';
        }
        node.style.transform = `translateX(${pct}%)`;
    }

    function applySwipeOffset(offsetPx: number): void {
        const containerWidth = getContainerWidth();
        const basePct = -(activeIndex * 100) / tabCount;
        const offsetPct = (offsetPx / (containerWidth * tabCount)) * 100;
        node.style.transition = 'none';
        node.style.transform = `translateX(${basePct + offsetPct}%)`;

        // Report fractional progress for indicator sync
        if (onProgress) {
            const progress = activeIndex - (offsetPx / containerWidth);
            onProgress(Math.max(0, Math.min(tabCount - 1, progress)));
        }
    }

    function handleTouchStart(e: TouchEvent): void {
        if (touchId !== null) return;

        const touch = e.touches[0];
        touchId = touch.identifier;
        startX = touch.clientX;
        startY = touch.clientY;
        currentX = touch.clientX;
        axisLocked = null;
        isSwiping = false;
        startTime = Date.now();

        // Remove transition during active touch
        node.style.transition = 'none';
    }

    function handleTouchMove(e: TouchEvent): void {
        if (touchId === null) return;

        const touch = Array.from(e.touches).find(t => t.identifier === touchId);
        if (!touch) return;

        const dx = touch.clientX - startX;
        const dy = touch.clientY - startY;

        // Determine axis lock on first significant movement
        if (axisLocked === null) {
            const absDx = Math.abs(dx);
            const absDy = Math.abs(dy);

            if (absDx < AXIS_LOCK_THRESHOLD && absDy < AXIS_LOCK_THRESHOLD) {
                return; // Not enough movement to decide
            }

            if (absDx > absDy) {
                axisLocked = 'horizontal';
                isSwiping = true;
                // Reset start position to current to avoid jump
                startX = touch.clientX;
                startTime = Date.now();
            } else {
                axisLocked = 'vertical';
                return; // Let vertical scroll happen
            }
        }

        if (axisLocked !== 'horizontal') return;

        currentX = touch.clientX;
        const offsetPx = currentX - startX;

        // Clamp at edges with rubber-band resistance
        const containerWidth = getContainerWidth();
        const maxOffset = activeIndex * containerWidth;           // Can't go past first tab
        const minOffset = -(tabCount - 1 - activeIndex) * containerWidth; // Can't go past last tab

        let clampedOffset = offsetPx;
        if (offsetPx > maxOffset) {
            // Past first tab - rubber-band
            const overscroll = offsetPx - maxOffset;
            clampedOffset = maxOffset + overscroll * 0.2;
        } else if (offsetPx < minOffset) {
            // Past last tab - rubber-band
            const overscroll = offsetPx - minOffset;
            clampedOffset = minOffset + overscroll * 0.2;
        }

        applySwipeOffset(clampedOffset);

        // Prevent vertical scroll while swiping horizontally
        e.preventDefault();
    }

    function handleTouchEnd(e: TouchEvent): void {
        if (touchId === null) return;

        const touch = Array.from(e.changedTouches).find(t => t.identifier === touchId);
        if (!touch) return;

        touchId = null;

        if (!isSwiping || axisLocked !== 'horizontal') {
            axisLocked = null;
            isSwiping = false;
            return;
        }

        const dx = touch.clientX - startX;
        const dt = Date.now() - startTime;
        const velocity = dt > 0 ? dx / dt : 0; // px/ms
        const containerWidth = getContainerWidth();
        const fraction = Math.abs(dx) / containerWidth;

        let newIndex = activeIndex;

        if (fraction > swipeThreshold || Math.abs(velocity) > velocityThreshold) {
            if (dx > 0 && activeIndex > 0) {
                newIndex = activeIndex - 1; // Swipe right -> previous tab
            } else if (dx < 0 && activeIndex < tabCount - 1) {
                newIndex = activeIndex + 1; // Swipe left -> next tab
            }
        }

        // Animate to target position
        applyTranslate(newIndex, true);

        if (newIndex !== activeIndex) {
            hapticSelection();
            activeIndex = newIndex;
            onIndexChange(newIndex);
        }

        // Report final progress
        onProgress?.(newIndex);

        axisLocked = null;
        isSwiping = false;
    }

    function handleTouchCancel(e: TouchEvent): void {
        if (touchId === null) return;

        const touch = Array.from(e.changedTouches).find(t => t.identifier === touchId);
        if (!touch) return;

        touchId = null;

        // Snap back to current tab
        applyTranslate(activeIndex, true);
        onProgress?.(activeIndex);

        axisLocked = null;
        isSwiping = false;
    }

    // Set initial position
    applyTranslate(activeIndex, false);

    // Register touch handlers
    node.addEventListener('touchstart', handleTouchStart, { passive: true });
    node.addEventListener('touchmove', handleTouchMove, { passive: false });
    node.addEventListener('touchend', handleTouchEnd, { passive: true });
    node.addEventListener('touchcancel', handleTouchCancel, { passive: true });

    return {
        update(newOptions: TabSwipeOptions) {
            const indexChanged = newOptions.activeIndex !== activeIndex;

            tabCount = newOptions.tabCount;
            onIndexChange = newOptions.onIndexChange;
            onProgress = newOptions.onProgress;
            swipeThreshold = newOptions.swipeThreshold ?? 0.25;
            velocityThreshold = newOptions.velocityThreshold ?? 0.3;
            animationDuration = newOptions.animationDuration ?? 250;

            if (indexChanged) {
                // Tab changed externally (e.g. via tap) - animate to new position
                activeIndex = newOptions.activeIndex;
                applyTranslate(activeIndex, true);
            }
        },
        destroy() {
            node.removeEventListener('touchstart', handleTouchStart);
            node.removeEventListener('touchmove', handleTouchMove);
            node.removeEventListener('touchend', handleTouchEnd);
            node.removeEventListener('touchcancel', handleTouchCancel);
            node.style.transform = '';
            node.style.transition = '';
        }
    };
}
