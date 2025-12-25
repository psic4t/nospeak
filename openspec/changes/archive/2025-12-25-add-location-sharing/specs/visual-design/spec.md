## ADDED Requirements

### Requirement: Inline Location Message Map Styling
Location messages in the conversation view SHALL render an inline OpenStreetMap iframe inside the message bubble, with a small, bold "Location" label above the map. The UI SHALL NOT display raw latitude/longitude coordinates by default.

#### Scenario: Inline map displays in message bubble
- **GIVEN** a conversation contains a location message with stored coordinates
- **WHEN** the conversation view renders the message bubble
- **THEN** the bubble SHALL show a small bold "Location" label
- **AND** the bubble SHALL render an OpenStreetMap iframe directly below the label
- **AND** the map SHALL be visually contained (rounded corners) and sized appropriately for chat

#### Scenario: Coordinates are not shown by default
- **GIVEN** a conversation contains a location message
- **WHEN** the bubble is rendered
- **THEN** raw latitude/longitude text SHALL NOT be displayed to the user

### Requirement: Location Preview Modal Map Styling
The interactive OpenStreetMap iframe displayed in the location preview modal (AttachmentPreviewModal with `mode="location"`) SHALL render with appropriate sizing, support pan and zoom gestures, and maintain legibility in both light and dark visual themes. The iframe SHALL use the standard OpenStreetMap export embed endpoint with appropriate bounding box and marker parameters.

#### Scenario: Map iframe renders with correct aspect ratio and size
- **GIVEN** the AttachmentPreviewModal is open with `mode="location"` at coordinates `{ latitude: 52.5200, longitude: 13.4050 }`
- **WHEN** the modal renders the location content area
- **THEN** the OpenStreetMap iframe SHALL have a height of approximately 300px
- **AND** the iframe SHALL occupy the full width of the modal content area
- **AND** the map SHALL render without cropping or distortion

#### Scenario: Map iframe supports pan and zoom interactions
- **GIVEN** a user is viewing the interactive OSM map in the modal
- **WHEN** the user performs pan or zoom gestures within the iframe
- **THEN** the map SHALL respond smoothly to these interactions
- **AND** the user SHALL be able to navigate the map freely
- **AND** the iframe SHALL not exit or reload when interacting with the map

#### Scenario: Map marker displays at correct coordinates
- **GIVEN** the modal is displaying a location at `{ latitude: 52.5200, longitude: 13.4050 }`
- **WHEN** the OpenStreetMap iframe loads
- **THEN** a marker or pin SHALL be visible at the correct coordinates
- **AND** the map SHALL be centered on the location with an appropriate zoom level (approximately zoom=15)

#### Scenario: Map iframe adapts to dark theme
- **GIVEN** the active visual theme is dark mode
- **WHEN** the location modal is opened
- **THEN** the OpenStreetMap iframe and surrounding modal content SHALL use dark theme colors
- **AND** the modal title, buttons, and backdrop SHALL follow dark theme styling
- **AND** in light mode, the modal components SHALL adapt to light theme colors

#### Scenario: Modal provides clear confirmation controls
- **GIVEN** the location preview modal is open
- **WHEN** the modal renders below the map iframe
- **THEN** Cancel and Send controls SHALL be visible and clearly labeled
- **AND** tapping Send SHALL send the location message
- **AND** tapping Cancel SHALL dismiss the preview without sending

#### Scenario: Modal dismisses cleanly with close control
- **GIVEN** the location modal is open
- **WHEN** the user taps the Close button or the modal backdrop
- **THEN** the modal SHALL close immediately
- **AND** the AttachmentPreviewModal SHALL clean up any state
- **AND** the underlying conversation view SHALL remain visible and functional
