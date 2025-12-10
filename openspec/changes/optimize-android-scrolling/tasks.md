# Tasks: Optimize Android Scrolling

## CSS Optimizations
- [ ] Remove `backdrop-filter` from message bubbles in `src/lib/components/ChatView.svelte` and `src/app.css` for mobile/Android breakpoints. <!-- id: css-remove-blur -->
- [ ] Increase background opacity for message bubbles on mobile to compensate for loss of blur. <!-- id: css-adjust-opacity -->
- [ ] Verify scrolling smoothness on Android device/emulator. <!-- id: verify-css-perf -->

## Virtualization
- [ ] Create `src/lib/components/VirtualList.svelte` (Svelte 5 compatible). <!-- id: create-virtual-list -->
- [ ] Implement dynamic height measurement in `VirtualList`. <!-- id: virtual-list-dynamic-height -->
- [ ] Update `src/lib/components/ChatView.svelte` to use `VirtualList`. <!-- id: chat-view-integrate-virtual-list -->
- [ ] Implement "maintain scroll position on prepend" logic for history loading. <!-- id: history-scroll-position -->
- [ ] Implement scroll anchoring to prevent jumping when dynamic items resize above the viewport. <!-- id: virtual-list-scroll-anchoring -->
- [ ] Implement "stick to bottom" logic for new incoming messages. <!-- id: stick-to-bottom -->
- [x] Verify chat interaction (sending, receiving, loading history) works without visual glitches. <!-- id: verify-virtual-list -->

## Performance Deep Dive
- [ ] Create `src/lib/utils/observers.ts` for shared `ResizeObserver` and `IntersectionObserver` management. <!-- id: shared-observers -->
- [ ] Refactor `src/lib/components/VirtualList.svelte` to use shared `ResizeObserver`. <!-- id: virtual-list-shared-observer -->
- [ ] Refactor `src/lib/components/MessageContent.svelte` to use shared `IntersectionObserver`. <!-- id: message-content-shared-observer -->
- [ ] Refine `VirtualList` scroll logic: use `overflow-anchor: none` and force absolute scroll position for sticky mode. <!-- id: refine-virtual-list-scroll -->
- [ ] Implement debouncing logic for URL preview fetches in `MessageContent.svelte`. <!-- id: debounce-url-previews -->
