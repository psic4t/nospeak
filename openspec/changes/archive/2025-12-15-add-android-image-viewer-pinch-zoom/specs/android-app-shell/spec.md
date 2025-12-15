## ADDED Requirements
### Requirement: Android In-App Image Viewer Gestures
When running inside the Android Capacitor app shell, the in-app image viewer defined by the `messaging` specification SHALL support native-feeling pinch-zoom and panning interactions, plus a double-tap gesture to reset zoom, while preserving existing Android back behaviour for full-screen overlays.

#### Scenario: Pinch-zoom and pan in Android image viewer
- **GIVEN** the user is running nospeak inside the Android Capacitor app shell
- **AND** the in-app image viewer overlay is currently visible above the chat UI
- **WHEN** the user performs a two-finger pinch gesture on the image
- **THEN** the viewer SHALL change the image zoom level within reasonable minimum and maximum bounds without causing the entire WebView or page to zoom
- **AND** while the image is zoomed in, the user SHALL be able to drag to pan the image within the viewer without leaving the overlay.

#### Scenario: Double-tap resets Android image viewer zoom
- **GIVEN** the user is running nospeak inside the Android Capacitor app shell
- **AND** the in-app image viewer overlay is currently visible above the chat UI
- **AND** the image is currently zoomed or panned away from its initial fit-to-screen state
- **WHEN** the user double-taps the image inside the viewer
- **THEN** the viewer SHALL reset the zoom level and panning offsets so that the image returns to a fit-to-screen composition
- **AND** the viewer header controls and close behaviour SHALL remain unchanged.

#### Scenario: Web behaviour unchanged outside Android shell for image viewer gestures
- **GIVEN** the user is accessing nospeak in a standard web browser rather than the Android Capacitor app shell
- **WHEN** the in-app image viewer is opened for a message image
- **THEN** the platform SHALL continue to use the existing scroll-based panning and fit/full-size behaviour defined in the `messaging` specification
- **AND** no Android-specific pinch-zoom or double-tap reset semantics SHALL be required for web-only environments.
