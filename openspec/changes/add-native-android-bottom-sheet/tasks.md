# Tasks: Native Android Bottom Sheet

## 1. Android Native Implementation

- [x] 1.1 Add Material Components dependency and Kotlin support to `android/app/build.gradle`
- [x] 1.2 Create `NativeBottomSheet.kt` (Kotlin) extending `BottomSheetDialogFragment`
  - Configure `BottomSheetBehavior` (expanded, skip collapsed, draggable)
  - Handle WebView attachment in `onStart()`
  - Handle WebView detachment in `onDismiss()`
  - Add drag handle indicator view
- [x] 1.3 Create `AndroidBottomSheetPlugin.kt` (Kotlin) Capacitor plugin
  - Implement `show(PluginCall)` method
  - Implement `hide(PluginCall)` method
  - Emit `dismissed` event when sheet closes
  - Handle WebView transfer to/from fragment
- [x] 1.4 Register plugin in `MainActivity.java`

## 2. TypeScript Integration

- [x] 2.1 Create `src/lib/core/AndroidBottomSheet.ts` plugin interface
- [x] 2.2 Create `src/lib/utils/nativeBottomSheet.ts` helper functions
  - `showNativeBottomSheet(id: string)` - calls plugin, sets up listener
  - `hideNativeBottomSheet()` - programmatic close
  - Handle `dismissed` event to update Svelte stores
- [x] 2.3 Add unit tests for `nativeBottomSheet.ts`

## 3. SettingsModal Integration

- [x] 3.1 Modify `SettingsModal.svelte` to call native sheet on Android
  - On mount (Android only): call `showNativeBottomSheet('settings')`
  - Listen for `dismissed` event to update `showSettingsModal` store
- [x] 3.2 Remove JavaScript drag handling code from Settings (Android path only)
  - Conditionally skip JS drag handlers when native sheet is active
  - Keep CSS positioning and visual styles (used by native container)
- [x] 3.3 Ensure web/PWA behavior unchanged (no drag code removal for non-Android)

## 4. Testing and Validation

- [ ] 4.1 Manual testing on Android emulator
  - Verify 60fps drag animation
  - Verify snap-back on short drags
  - Verify dismiss on threshold exceeded
  - Verify Android back button closes sheet
  - Verify Settings content scrolls correctly
  - Verify keyboard input works in Settings forms
- [ ] 4.2 Manual testing on physical Android device (various versions)
  - Test on Android 10, 12, 13, 14 if available
  - Verify predictive back gesture integration (Android 13+)
- [ ] 4.3 Verify web/PWA behavior unchanged
  - Desktop browser: centered modal, no drag gesture
  - Mobile browser: full-screen overlay, no drag gesture
- [x] 4.4 Run `npm run check` to verify no TypeScript errors
- [x] 4.5 Run `npx vitest run` to verify all tests pass

## 5. Cleanup

- [x] 5.1 Remove any unused imports from modified files
- [x] 5.2 Ensure code follows project conventions (4-space indent, explicit types)

## Dependencies

- Task 1.2 depends on 1.1 (Material Components needed for BottomSheetDialogFragment)
- Task 1.3 depends on 1.2 (plugin references the fragment)
- Task 2.2 depends on 2.1 (helper uses plugin interface)
- Task 3.1 depends on 2.2 (Svelte uses helper functions)
- Task 3.2 depends on 3.1 (remove old code after new code works)
- Tasks 4.x depend on all implementation tasks

## Parallelizable Work

- Tasks 1.1-1.4 (native) and 2.1-2.3 (TypeScript) can proceed in parallel
- Testing tasks (4.x) must wait for implementation
