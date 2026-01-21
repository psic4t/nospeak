# Design: Native Android Bottom Sheet with Inner WebView

## Context

The Android app uses bottom sheets for Settings and other modals. Currently, the drag-to-dismiss gesture is implemented in JavaScript within the WebView using pointer events and CSS transforms. While functional, this approach has noticeable performance issues compared to native Android bottom sheets because:

1. WebView's pointer event handling adds overhead
2. JavaScript-to-native bridge has latency during continuous drag updates
3. CSS transform animations don't benefit from Android's hardware-accelerated sheet animations
4. No integration with Android's predictive back gesture (Android 13+)

## Goals

- Achieve 60fps drag animations matching native Android apps
- Preserve existing WebView content without re-rendering or state loss
- Maintain identical dismiss behavior (threshold-based, velocity-aware)
- Keep web/PWA behavior completely unchanged
- Prove the approach with Settings before expanding to other sheets

## Non-Goals

- Changing the visual design of bottom sheets
- Adding new bottom sheet functionality
- Converting web/PWA modals to any native approach
- Porting all bottom sheets in this change (only Settings)

## Decisions

### Decision 1: Single WebView Transfer

**What**: Detach the existing WebView from the Capacitor bridge layout and re-parent it into the native `BottomSheetDialogFragment` container.

**Why**: This preserves all WebView state (DOM, JavaScript context, scroll position) without requiring content re-rendering or complex state synchronization between multiple WebViews.

**Alternatives considered**:
- **Second WebView**: Create a new WebView in the fragment that loads specific URLs. Rejected because it requires complex state sync, doubles memory usage, and may cause visible flicker.
- **Native UI replacement**: Replace bottom sheet content with native Android Views. Rejected because it duplicates UI logic and breaks the single-codebase principle.

### Decision 2: BottomSheetDialogFragment over BottomSheetBehavior

**What**: Use `BottomSheetDialogFragment` (a Dialog subclass) rather than attaching `BottomSheetBehavior` to a CoordinatorLayout child.

**Why**: 
- `DialogFragment` provides automatic back button handling via `onDismiss()`
- Easier lifecycle management (fragment manages its own state)
- Built-in scrim/backdrop handling
- Can be dismissed programmatically with standard Fragment APIs

**Trade-off**: DialogFragment creates a new window, which requires careful handling of WebView transfer. Mitigated by doing the transfer in `onStart()` after the dialog window is ready.

### Decision 3: Material Components BottomSheetBehavior Configuration

**What**: Configure the sheet with:
- `STATE_EXPANDED` on show (no half-expanded intermediate state)
- `skipCollapsed = true` (dismiss directly, no collapsed state)
- `isDraggable = true`
- `peekHeight` matching current 90% viewport design

**Why**: Matches current behavior where sheets either show fully or dismiss. No intermediate "peek" state exists in the current design.

### Decision 4: Capacitor Plugin Bridge

**What**: Create `AndroidBottomSheetPlugin` with methods:
- `show(options: { id: string })` - Shows native sheet, transfers WebView
- `hide()` - Dismisses sheet, returns WebView to bridge
- Event: `dismissed` - Notifies JS when user drags to close

**Why**: Standard Capacitor plugin pattern already used throughout the app (see `AndroidTapSoundPlugin`, `AndroidMicrophonePlugin`). Familiar API surface for the TypeScript side.

### Decision 5: Kotlin for New Native Code

**What**: Write `AndroidBottomSheetPlugin.kt` and `NativeBottomSheet.kt` in Kotlin rather than Java.

**Why**: 
- Kotlin is the recommended language for new Android development
- Better null safety reduces crash risk during WebView transfer
- More concise syntax for fragment lifecycle and callback handling
- Interoperates seamlessly with existing Java code (`MainActivity.java` can register Kotlin plugins)

**Trade-off**: Adds Kotlin stdlib to the build if not already present. This is a negligible size increase and is standard for modern Android apps.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ MainActivity                                                    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ FrameLayout (capacitor-bridge-webview-container)        │   │
│  │   └─ WebView ← detached when sheet opens                │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ NativeBottomSheet.kt (BottomSheetDialogFragment)        │   │
│  │   └─ FrameLayout (sheet-content-container)              │   │
│  │        ├─ View (drag-handle-indicator)                  │   │
│  │        └─ WebView ← attached here while sheet is open   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Flow**:
1. JS calls `AndroidBottomSheet.show({ id: 'settings' })`
2. Plugin gets WebView reference from bridge
3. Plugin removes WebView from its current parent
4. Plugin creates/shows `NativeBottomSheet` fragment
5. Fragment's `onStart()` adds WebView to its container
6. User drags sheet - native `BottomSheetBehavior` handles all gestures
7. On dismiss (drag or back button):
   - Fragment's `onDismiss()` removes WebView from container
   - Fragment re-adds WebView to original bridge container
   - Plugin emits `dismissed` event to JS
   - JS updates Svelte store to close modal

## Risks / Trade-offs

| Risk | Impact | Mitigation |
|------|--------|------------|
| WebView flicker during transfer | Visual glitch | Add 16ms delay + crossfade; test on low-end devices |
| Content scroll vs sheet drag conflict | Unusable scrolling | Use `NestedScrollingChild` properly in WebView container |
| WebView loses focus/keyboard | Input breaks | Explicitly restore focus after transfer |
| Fragment lifecycle edge cases | Crashes | Handle config changes, backgrounding carefully |
| Back button double-handling | Confusing UX | Let DialogFragment handle back; disable JS back handler for sheets |

## Migration Plan

1. Implement native plugin and fragment (no behavior change yet)
2. Add TypeScript wrapper with feature flag
3. Modify `SettingsModal.svelte` to use native sheet when flag enabled
4. Test extensively on multiple Android versions and devices
5. Remove feature flag, delete JS drag code for Android path
6. Monitor crash reports and performance metrics

## Open Questions

1. **WebView keyboard behavior**: Does the soft keyboard work correctly when WebView is inside DialogFragment? Needs testing.
2. **Safe area insets**: Does the native sheet respect edge-to-edge insets, or do we need explicit handling?
3. **Theme synchronization**: Will the sheet background match the current dark/light theme automatically?

## Future Work

If this approach proves successful with Settings:
- Port `AttachmentPreviewModal` (media preview before send)
- Port `RelayStatusModal` (relay health display)
- Port `VoiceMessageSheet` (voice recording UI)
- Consider `ManageContactsModal` (user preference: keep as-is for now)
