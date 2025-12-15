## Context
The messaging spec already defines an in-app image viewer with fit-to-screen and full-size panning behaviour, and the android-app-shell spec defines back-navigation semantics for full-screen overlays such as the image viewer. However, the current behaviour relies on scroll-based panning and does not describe native-feeling pinch-to-zoom or double-tap interactions on Android.

## Goals / Non-Goals
- Goals:
  - Provide pinch-to-zoom, pan, and double-tap reset for the in-app image viewer when running inside the Android Capacitor app shell.
  - Keep non-Android behaviour unchanged while explicitly documenting Android-only gesture enhancements.
  - Ensure gestures coexist cleanly with existing back navigation and viewer controls.
- Non-Goals:
  - Redesigning the visual style of the image viewer or its header controls.
  - Introducing generic multi-platform gesture libraries or changing browser-level zoom behaviour.

## Decisions
- Scope Android-specific semantics into `android-app-shell` while updating the `messaging` spec to acknowledge the in-app viewer gesture behaviour via a dedicated scenario.
- Gate gesture handling at runtime using the existing Android/native environment detection so that web-only environments retain current behaviour.
- Use a simple transform-based zoom and pan model (scale + translation) for the viewer image rather than introducing new layout containers or external dependencies.

## Risks / Trade-offs
- Gesture logic adds complexity to the image viewer component and may require careful tuning to avoid janky behaviour on low-end devices.
- Clamping pan and zoom bounds in a generic way may be approximate; the spec keeps behavioural expectations high-level so implementation can iterate without further spec changes.

## Migration Plan
- Implement gestures behind Android-only runtime checks so existing platforms remain unaffected.
- Verify behaviour in the Android app shell across common form factors (phones with gesture navigation, different aspect ratios).
- Iterate on gesture tuning as needed without further spec changes, as long as the documented scenarios remain satisfied.

## Open Questions
- Should future iterations extend pinch-to-zoom to non-Android mobile web environments? (Out of scope for this change but may warrant a follow-up proposal.)
