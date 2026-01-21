# Change: Port Android bottom sheets to native BottomSheetDialogFragment

## Why

The current Android bottom sheet implementation uses JavaScript pointer event handling within the WebView for drag-to-dismiss gestures. This approach suffers from performance issues: WebView's pointer event handling overhead, JavaScript-to-native bridge latency during drag, and CSS transform animations instead of hardware-accelerated native animations. Users perceive the gesture as laggy compared to native Android bottom sheets in other apps.

## What Changes

- Add a new native Android `BottomSheetDialogFragment` that hosts the existing WebView content for Settings
- Create a Capacitor plugin (`AndroidBottomSheet`) to bridge between the Svelte UI and the native sheet
- The WebView instance is detached from the main Capacitor bridge and re-parented into the native bottom sheet container when shown
- Remove ~100 lines of JavaScript drag handling code from `SettingsModal.svelte` (for Android path only)
- Native drag gestures, snap-back animations, and dismiss thresholds are handled entirely by Android's Material Components `BottomSheetBehavior`
- Web and PWA behavior remains unchanged

## Impact

- Affected specs: `android-app-shell` (modified requirement)
- Affected code:
  - `android/app/build.gradle` (add Material Components dependency, enable Kotlin)
  - `android/app/src/main/java/com/nospeak/app/AndroidBottomSheetPlugin.kt` (new, Kotlin)
  - `android/app/src/main/java/com/nospeak/app/NativeBottomSheet.kt` (new, Kotlin)
  - `android/app/src/main/java/com/nospeak/app/MainActivity.java` (register plugin)
  - `src/lib/core/AndroidBottomSheet.ts` (new TypeScript interface)
  - `src/lib/utils/nativeBottomSheet.ts` (new helper functions)
  - `src/lib/components/SettingsModal.svelte` (remove JS drag, add native calls)

## Language Choice

New native Android components SHALL be written in Kotlin. Existing Java files (e.g., `MainActivity.java`) remain unchanged but can register Kotlin plugins.

## Scope

- **In scope**: Settings bottom sheet only (proof of concept)
- **Out of scope**: AttachmentPreviewModal, RelayStatusModal, VoiceMessageSheet, ManageContactsModal (future work if successful)

## Non-Breaking

This change preserves all existing functional behavior. The visual appearance, dismiss thresholds, and interaction semantics remain the same. Only the implementation changes from WebView JavaScript to native Android.
