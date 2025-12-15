## MODIFIED Requirements
### Requirement: In-App Image Viewer for Messages
The messaging interface SHALL provide an in-app image viewer for inline message images so that tapping an image opens a full-screen viewer overlay instead of navigating to a separate browser tab or window. The viewer SHALL preserve the existing media rendering semantics in message bubbles while adding richer viewing controls on top.

#### Scenario: Tapping inline image opens in-app viewer
- **GIVEN** a message bubble that renders an inline image based on a media URL in the message content
- **WHEN** the user taps or clicks the image inside the message bubble
- **THEN** the system SHALL open a full-screen in-app image viewer overlay on top of the current messaging UI
- **AND** the underlying conversation view SHALL remain loaded in the background without navigating the browser or Android WebView to a different origin or tab.

#### Scenario: Viewer supports fit-to-screen and full-size panning
- **GIVEN** the in-app image viewer is open for a particular image
- **WHEN** the user activates the "full size" control in the viewer
- **THEN** the system SHALL render the image at full resolution subject to device memory and layout constraints
- **AND** the viewer content area SHALL be scrollable so that the user can pan around the image when it is larger than the viewport
- **AND** the user SHALL be able to toggle back to a fit-to-screen mode that keeps the entire image visible without requiring scrolling.

#### Scenario: Viewer provides close and download controls
- **GIVEN** the in-app image viewer is open for a particular image
- **WHEN** the user activates the close control
- **THEN** the system SHALL dismiss the viewer overlay and return focus to the underlying conversation view
- **AND** the message list and scroll position SHALL remain unchanged.
- **WHEN** the user activates the download control
- **THEN** the system SHALL initiate a download or save flow for the current image using the platform-appropriate download behavior
- **AND** this download action SHALL NOT navigate away from the nospeak messaging UI.

#### Scenario: Android viewer supports pinch-zoom, pan, and double-tap reset
- **GIVEN** the user is running nospeak inside the Android Capacitor app shell
- **AND** the in-app image viewer is open for a particular image
- **WHEN** the user performs a two-finger pinch gesture on the image
- **THEN** the viewer SHALL adjust the zoom level smoothly within reasonable bounds without zooming the entire page or WebView
- **AND** when zoomed in, the user SHALL be able to pan the image within the viewer using a drag gesture.
- **WHEN** the user double-taps the image while the viewer is open
- **THEN** the viewer SHALL reset the zoom level and panning offsets so that the image returns to a fit-to-screen state.
