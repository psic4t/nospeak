## ADDED Requirements

### Requirement: Android Native Bottom Sheet Container
When running inside the Android Capacitor app shell, the Settings bottom sheet SHALL be rendered using a native Android `BottomSheetDialogFragment` that hosts the existing WebView content. The native container SHALL provide hardware-accelerated drag gestures and animations while preserving the WebView's DOM state, JavaScript context, and scroll position. The Svelte content rendered inside the WebView SHALL remain unchanged; only the container and gesture handling move to native code.

#### Scenario: Settings opens in native bottom sheet on Android
- **GIVEN** the user is running nospeak inside the Android Capacitor app shell
- **AND** the user triggers the Settings modal to open
- **WHEN** the Settings UI is displayed
- **THEN** the Android shell SHALL present the Settings content inside a native `BottomSheetDialogFragment`
- **AND** the existing WebView instance SHALL be transferred into the native sheet container without re-rendering
- **AND** the Settings content SHALL remain fully interactive (scrolling, tapping, form input).

#### Scenario: Native bottom sheet provides 60fps drag animation
- **GIVEN** the user is running nospeak inside the Android Capacitor app shell
- **AND** the Settings bottom sheet is currently open in the native container
- **WHEN** the user drags the sheet from the drag handle area
- **THEN** the sheet SHALL animate smoothly at 60 frames per second using Android's native `BottomSheetBehavior`
- **AND** the drag gesture SHALL be handled entirely by native code without JavaScript involvement during the drag.

#### Scenario: Native bottom sheet dismiss returns WebView to bridge
- **GIVEN** the user is running nospeak inside the Android Capacitor app shell
- **AND** the Settings bottom sheet is currently open in the native container
- **WHEN** the sheet is dismissed (via drag gesture, back button, or programmatic close)
- **THEN** the WebView SHALL be transferred back to its original Capacitor bridge container
- **AND** the WebView's DOM state and scroll position SHALL be preserved
- **AND** the Svelte store controlling Settings visibility SHALL be updated to reflect the closed state.

#### Scenario: Web and PWA behavior unchanged for native bottom sheet
- **GIVEN** the user is accessing nospeak via a standard web browser or PWA rather than the Android Capacitor app shell
- **WHEN** the user opens Settings
- **THEN** no native Android bottom sheet container SHALL be used
- **AND** the Settings modal SHALL continue to use the existing CSS-based modal presentation as defined by the `visual-design` and `settings` specifications.

## MODIFIED Requirements

### Requirement: Android Bottom Sheet Swipe-to-Close Gesture
The Android Capacitor app shell SHALL support a swipe-down-to-close gesture for designated bottom sheet modals (including at least Settings and Manage Contacts) so that users can dismiss these sheets by dragging them downward. For the Settings bottom sheet, this gesture SHALL be handled by the native `BottomSheetDialogFragment` and its associated `BottomSheetBehavior`. For other bottom sheets (such as Manage Contacts), the gesture MAY continue to use the existing JavaScript-based implementation until those sheets are migrated to native containers. The gesture SHALL be threshold-based, SHALL only apply when running inside the Android app shell, and SHALL not interfere with primary scrolling and tapping behavior inside the sheet content.

#### Scenario: Swipe-down closes Settings bottom sheet on Android
- **GIVEN** the user is running nospeak inside the Android Capacitor app shell
- **AND** the Settings experience is currently presented inside the native `BottomSheetDialogFragment` container
- **WHEN** the user drags downward from the drag handle area beyond the configured threshold distance
- **THEN** the native `BottomSheetBehavior` SHALL dismiss the sheet with a hardware-accelerated animation
- **AND** the WebView SHALL be returned to its original Capacitor bridge container
- **AND** the Svelte store controlling Settings visibility SHALL be updated
- **AND** the drag SHALL not prevent normal vertical scrolling or tapping inside the Settings content area when the drag begins outside the drag handle area.

#### Scenario: Swipe-down closes Manage Contacts bottom sheet on Android
- **GIVEN** the user is running nospeak inside the Android Capacitor app shell
- **AND** the Manage Contacts modal is currently presented as a bottom sheet anchored to the bottom of the screen
- **WHEN** the user initiates a downward drag from the defined drag area at the top of the Manage Contacts bottom sheet and drags beyond the configured threshold distance
- **THEN** the Manage Contacts bottom sheet SHALL dismiss, triggering the same close behavior as tapping the close or back control in the header
- **AND** vertical scrolling within the contacts list or search results SHALL remain unaffected when the user scrolls from within the main content area instead of the drag area.

#### Scenario: Short drags cause Android bottom sheets to snap back
- **GIVEN** the user is running nospeak inside the Android Capacitor app shell
- **AND** a bottom sheet modal such as Settings or Manage Contacts is currently open
- **WHEN** the user initiates a drag from the drag handle area at the top of the sheet but releases it before reaching the configured threshold distance
- **THEN** the sheet SHALL animate back to its resting position without dismissing
- **AND** the sheet SHALL not enter an intermediate or partially translated state after the animation completes
- **AND** existing close mechanisms (tapping outside, header close button, Android system back) SHALL continue to operate as before.

#### Scenario: Web and PWA behavior unchanged outside Android shell
- **GIVEN** the user is accessing nospeak via a standard desktop or mobile web browser, not inside the Android Capacitor app shell
- **WHEN** they interact with Settings, Manage Contacts, or other modals that appear as centered dialogs or full-screen overlays
- **THEN** no Android-specific swipe-to-close behavior SHALL be required or implemented
- **AND** the modals SHALL continue to use their existing close controls and interactions as defined by the `visual-design` and `settings` specifications.
