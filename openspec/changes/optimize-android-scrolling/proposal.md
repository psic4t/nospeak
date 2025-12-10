# Optimize Android Scrolling

## Problem
The current Android app suffers from poor scrolling performance (jank) in chat views. This is primarily caused by two factors:
1.  **Heavy Visual Effects:** The extensive use of `backdrop-filter: blur` on individual message bubbles is GPU-intensive on mobile devices.
2.  **Large DOM Size:** Rendering the entire chat history (no list virtualization) increases memory usage and layout calculation costs as the conversation grows.

## Solution
We will optimize the scrolling experience by:
1.  **Simplifying Visuals on Android:** Removing or reducing `backdrop-filter` effects on message bubbles when running on Android or low-power devices.
2.  **Implementing List Virtualization:** Introducing a `VirtualList` component to render only the visible messages, significantly reducing DOM nodes and memory footprint.
3.  **Optimizing Observers & Network:** Consolidating multiple `ResizeObserver` and `IntersectionObserver` instances into shared singletons and debouncing URL preview fetches to prevent network floods during scroll.

## Impact
- **Android App:** Significantly smoother scrolling and lower battery consumption.
- **Web Client:** Improved performance for users with long chat histories or lower-end devices (if virtualization is applied globally).
- **Visual Design:** Minor degradation in "glass" aesthetic on Android message bubbles in exchange for usability.
