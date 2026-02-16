import { hapticSelection } from '$lib/utils/haptics';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface BottomSheetOptions {
    /** Whether the drag-to-dismiss gesture is active. */
    enabled: boolean;
    /** Called when the sheet should be dismissed (after the close animation). */
    onClose: () => void;
    /**
     * Optional overlay element whose opacity should fade proportionally
     * as the sheet is dragged down.
     */
    overlay?: HTMLElement | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Minimum downward movement before drag activates (prevents accidental drags). */
const ACTIVATION_THRESHOLD_PX = 6;

/** Velocity threshold for fast-swipe dismiss (px/ms). */
const VELOCITY_THRESHOLD = 0.5;

/**
 * Duration (ms) projected forward from release velocity.
 * projectedY = dragY + velocity * MOMENTUM_DURATION
 * If projectedY > 40% of sheet height → close.
 */
const MOMENTUM_DURATION_MS = 120;

/** Fraction of sheet height beyond which momentum-projected release triggers close. */
const CLOSE_FRACTION = 0.4;

/** Height (px) of the drag handle zone at top of the sheet. */
const HANDLE_ZONE_HEIGHT = 60;

/**
 * Rubber-band factor applied once drag exceeds the sheet height.
 * Gives a weighted/elastic feel when dragging far.
 */
const RUBBER_BAND_FACTOR = 0.35;

/**
 * Spring-like easing curve for snap-back / close animations.
 * Material Design 3 standard decelerate curve.
 */
const SPRING_EASING = 'cubic-bezier(0.2, 0.9, 0.3, 1)';

/** Minimum close animation duration (ms). */
const CLOSE_DURATION_MIN_MS = 150;

/** Maximum close animation duration (ms). */
const CLOSE_DURATION_MAX_MS = 350;

/** Snap-back animation duration (ms). */
const SNAP_BACK_DURATION_MS = 280;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Clamp a value between min and max. */
function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

/**
 * Apply rubber-band resistance.
 * For `raw` values beyond `limit`, returns a diminished offset:
 * limit + (raw - limit) * factor
 */
function rubberBand(raw: number, limit: number, factor: number): number {
    if (raw <= limit) return raw;
    return limit + (raw - limit) * factor;
}

/**
 * Find the first scrollable ancestor of `start` within `root`.
 * Returns null if none found.
 */
function findScrollContainer(root: HTMLElement, start: HTMLElement): HTMLElement | null {
    let el: HTMLElement | null = start;
    while (el && el !== root) {
        const style = window.getComputedStyle(el);
        const overflowY = style.overflowY;
        if (
            (overflowY === 'auto' || overflowY === 'scroll') &&
            el.scrollHeight > el.clientHeight
        ) {
            return el;
        }
        el = el.parentElement;
    }
    return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Svelte Action
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Svelte action that adds drag-to-dismiss behaviour to a bottom-sheet element.
 *
 * Usage:
 * ```svelte
 * <div use:bottomSheet={{ enabled: isMobile, onClose: close, overlay: overlayEl }}>
 * ```
 *
 * Features:
 * - Full-width drag zone at top (60px) + scroll-aware drag from content
 * - Rubber-band resistance when over-dragging
 * - Momentum-based close decision (projected position)
 * - `transitionend`-based close (no setTimeout race)
 * - Proportional backdrop fade during drag
 * - Haptic feedback on dismiss
 */
export function bottomSheet(node: HTMLElement, options: BottomSheetOptions) {
    let opts = { ...options };

    // ── State ────────────────────────────────────────────────────────────
    let isDragging = false;
    let isActive = false; // true once activation threshold met
    let startY = 0;
    let currentDragY = 0;
    let lastY = 0;
    let lastTime = 0;
    let velocity = 0; // px/ms, positive = downward
    let pointerId: number | null = null;
    let sheetHeight = 0;
    let overlayBaseOpacity = 1;
    let isClosing = false;
    let scrollContainer: HTMLElement | null = null;
    let pointerStartedInHandle = false;

    // ── Overlay opacity tracking ─────────────────────────────────────────

    function captureOverlayOpacity(): void {
        if (opts.overlay) {
            const computed = window.getComputedStyle(opts.overlay);
            overlayBaseOpacity = parseFloat(computed.opacity) || 1;
        }
    }

    function updateOverlayOpacity(progress: number): void {
        if (opts.overlay) {
            const opacity = overlayBaseOpacity * (1 - progress * 0.6);
            opts.overlay.style.opacity = String(Math.max(0, opacity));
        }
    }

    function resetOverlayOpacity(): void {
        if (opts.overlay) {
            opts.overlay.style.opacity = '';
        }
    }

    // ── Animation helpers ────────────────────────────────────────────────

    function setTransition(duration: number, easing: string): void {
        node.style.transition = `transform ${duration}ms ${easing}`;
    }

    function clearTransition(): void {
        node.style.transition = 'none';
    }

    function setTransform(y: number): void {
        node.style.transform = `translateY(${y}px)`;
    }

    function resetStyles(): void {
        node.style.transition = '';
        node.style.transform = '';
        node.style.willChange = '';
        resetOverlayOpacity();
    }

    // ── Close animation ──────────────────────────────────────────────────

    function animateClose(): void {
        if (isClosing) return;
        isClosing = true;

        // Duration proportional to remaining distance
        const remaining = sheetHeight - currentDragY;
        const fraction = remaining / (sheetHeight || 1);
        const duration = clamp(
            fraction * CLOSE_DURATION_MAX_MS,
            CLOSE_DURATION_MIN_MS,
            CLOSE_DURATION_MAX_MS
        );

        setTransition(duration, SPRING_EASING);

        // Fade overlay during close animation
        if (opts.overlay) {
            opts.overlay.style.transition = `opacity ${duration}ms ${SPRING_EASING}`;
            opts.overlay.style.opacity = '0';
        }

        // Use rAF to ensure the transition property is applied before transform change
        requestAnimationFrame(() => {
            setTransform(sheetHeight);

            // Listen for transitionend to actually close
            const handler = (e: TransitionEvent) => {
                if (e.propertyName !== 'transform') return;
                node.removeEventListener('transitionend', handler);
                clearTimeout(fallback);
                finalizeClose();
            };
            node.addEventListener('transitionend', handler);

            // Safety fallback in case transitionend doesn't fire
            const fallback = setTimeout(() => {
                node.removeEventListener('transitionend', handler);
                finalizeClose();
            }, duration * 1.5);
        });
    }

    function finalizeClose(): void {
        resetStyles();
        isClosing = false;
        isDragging = false;
        isActive = false;
        currentDragY = 0;
        hapticSelection();
        opts.onClose();
    }

    // ── Snap-back animation ──────────────────────────────────────────────

    function animateSnapBack(): void {
        setTransition(SNAP_BACK_DURATION_MS, SPRING_EASING);

        if (opts.overlay) {
            opts.overlay.style.transition = `opacity ${SNAP_BACK_DURATION_MS}ms ${SPRING_EASING}`;
            opts.overlay.style.opacity = '';
        }

        requestAnimationFrame(() => {
            setTransform(0);

            const handler = (e: TransitionEvent) => {
                if (e.propertyName !== 'transform') return;
                node.removeEventListener('transitionend', handler);
                clearTimeout(fallback);
                resetStyles();
            };
            node.addEventListener('transitionend', handler);

            const fallback = setTimeout(() => {
                node.removeEventListener('transitionend', handler);
                resetStyles();
            }, SNAP_BACK_DURATION_MS * 1.5);
        });
    }

    // ── Close decision ───────────────────────────────────────────────────

    function shouldClose(): boolean {
        // Fast swipe
        if (velocity > VELOCITY_THRESHOLD) return true;

        // Momentum-projected position
        const projected = currentDragY + velocity * MOMENTUM_DURATION_MS;
        if (projected > sheetHeight * CLOSE_FRACTION) return true;

        return false;
    }

    // ── Pointer event handlers ───────────────────────────────────────────

    function onPointerDown(e: PointerEvent): void {
        if (!opts.enabled || isClosing) return;

        const target = e.target as HTMLElement;
        const rect = node.getBoundingClientRect();
        const relativeY = e.clientY - rect.top;

        // Check if pointer started in the handle zone (top area)
        pointerStartedInHandle = relativeY <= HANDLE_ZONE_HEIGHT;

        // For content area touches, find the scroll container
        if (!pointerStartedInHandle) {
            scrollContainer = findScrollContainer(node, target);
            // If there's a scrollable container that isn't at the top, let it scroll
            if (scrollContainer && scrollContainer.scrollTop > 0) {
                return;
            }
        }

        isDragging = true;
        isActive = false;
        startY = e.clientY;
        currentDragY = 0;
        lastY = e.clientY;
        lastTime = e.timeStamp;
        velocity = 0;
        pointerId = e.pointerId;
        sheetHeight = node.offsetHeight;

        captureOverlayOpacity();

        // Only prevent default + capture for handle zone;
        // for content area we wait until activation
        if (pointerStartedInHandle) {
            e.preventDefault();
            node.setPointerCapture(e.pointerId);
        }
    }

    function onPointerMove(e: PointerEvent): void {
        if (!isDragging || !opts.enabled || isClosing || e.pointerId !== pointerId) return;

        const rawDelta = e.clientY - startY;

        // If started in content area, check scroll position before activating
        if (!pointerStartedInHandle && !isActive) {
            // If scrollable container has scrolled content, cancel drag tracking
            if (scrollContainer && scrollContainer.scrollTop > 0) {
                isDragging = false;
                return;
            }
            // Only activate on downward movement
            if (rawDelta <= 0) return;
        }

        if (!isActive) {
            if (rawDelta > ACTIVATION_THRESHOLD_PX) {
                isActive = true;
                // Capture pointer now if we didn't on pointerdown (content area start)
                if (!pointerStartedInHandle) {
                    try {
                        node.setPointerCapture(e.pointerId);
                    } catch {
                        // ignore
                    }
                }
                node.style.willChange = 'transform';
                clearTransition();
                // Prevent content scroll once we own the gesture
                e.preventDefault();
            } else {
                return;
            }
        }

        e.preventDefault();

        // Track velocity (exponential moving average for smoothness)
        const timeDelta = e.timeStamp - lastTime;
        if (timeDelta > 0) {
            const instantVelocity = (e.clientY - lastY) / timeDelta;
            velocity = velocity * 0.6 + instantVelocity * 0.4;
        }
        lastY = e.clientY;
        lastTime = e.timeStamp;

        // Apply rubber-band resistance
        const clamped = Math.max(0, rawDelta);
        currentDragY = rubberBand(clamped, sheetHeight * 0.6, RUBBER_BAND_FACTOR);

        // Direct DOM update (no Svelte reactivity)
        setTransform(currentDragY);

        // Fade overlay proportionally
        const progress = clamp(currentDragY / sheetHeight, 0, 1);
        updateOverlayOpacity(progress);
    }

    function onPointerUp(e: PointerEvent): void {
        if (!isDragging || !opts.enabled || e.pointerId !== pointerId) return;

        try {
            node.releasePointerCapture(e.pointerId);
        } catch {
            // ignore
        }

        isDragging = false;
        pointerId = null;
        scrollContainer = null;

        if (!isActive) {
            currentDragY = 0;
            return;
        }

        node.style.willChange = '';

        if (shouldClose()) {
            animateClose();
        } else {
            animateSnapBack();
        }
    }

    function onPointerCancel(e: PointerEvent): void {
        onPointerUp(e);
    }

    // ── Touch prevention (stop browser pull-to-refresh during drag) ──────

    function onTouchMove(e: TouchEvent): void {
        if (isActive) {
            e.preventDefault();
        }
    }

    // ── Attach / detach ──────────────────────────────────────────────────

    function attach(): void {
        node.addEventListener('pointerdown', onPointerDown, { passive: false });
        node.addEventListener('pointermove', onPointerMove, { passive: false });
        node.addEventListener('pointerup', onPointerUp);
        node.addEventListener('pointercancel', onPointerCancel);
        node.addEventListener('touchmove', onTouchMove, { passive: false });
        // Ensure the node can receive touch events without browser interference
        node.style.touchAction = 'pan-x';
    }

    function detach(): void {
        node.removeEventListener('pointerdown', onPointerDown);
        node.removeEventListener('pointermove', onPointerMove);
        node.removeEventListener('pointerup', onPointerUp);
        node.removeEventListener('pointercancel', onPointerCancel);
        node.removeEventListener('touchmove', onTouchMove);
        node.style.touchAction = '';
        resetStyles();
    }

    // ── Init ─────────────────────────────────────────────────────────────

    if (opts.enabled) {
        attach();
    }

    return {
        update(newOptions: BottomSheetOptions) {
            const wasEnabled = opts.enabled;
            opts = { ...newOptions };

            if (opts.enabled && !wasEnabled) {
                attach();
            } else if (!opts.enabled && wasEnabled) {
                detach();
            }
        },
        destroy() {
            detach();
        }
    };
}
