## ADDED Requirements



### Requirement: Location Sharing via Encrypted DMs
The messaging system SHALL allow users to send their current GPS location to contacts as encrypted NIP-17 direct messages using Kind 14 rumors, and SHALL receive and display location messages sent by other nospeak clients. Location coordinates SHALL be transmitted as `geo:lat,lng` content format with supporting tags for interoperability. Location messages SHALL NOT expire and SHALL persist indefinitely in message history alongside text and file attachments.

#### Scenario: Sending a location message
- **GIVEN** a user is viewing an encrypted DM conversation with a contact
- **AND** location sharing is supported on their platform (Android with GPS or web with geolocation API)
- **AND** location permissions are granted
- **WHEN** the user selects "Location" from the media upload menu
- **THEN** the system SHALL fetch the current GPS coordinates `{ latitude, longitude }`
- **AND** the system SHALL present a preview modal showing an interactive OpenStreetMap view
- **WHEN** the user confirms "Send" in the preview modal
- **THEN** the system SHALL create a Kind 14 rumor with content `geo:52.5200,13.4050`
- **AND** the rumor SHALL include tags `['p', 'location']` where the location tag value is `52.5200,13.4050`
- **AND** the system SHALL gift-wrap and publish the rumor to the contact's messaging relays
- **AND** an optimistic location message SHALL appear immediately in the conversation view
- **AND** the message SHALL persist in IndexedDB with a `location` field containing `{ latitude: 52.5200, longitude: 13.4050 }`

#### Scenario: Receiving a location message
- **GIVEN** a contact sends a Kind 14 gift-wrapped message containing `geo:lat,lng` content and a `['location']` tag
- **WHEN** the messaging service receives and unwraps the gift-wrap
- **THEN** the system SHALL parse the coordinates from the location tag into `{ latitude, longitude }`
- **AND** the system SHALL store the message with the `location` field in IndexedDB
- **AND** the conversation UI SHALL render the message as a location preview

#### Scenario: Location message persists indefinitely
- **GIVEN** a location message has been sent or received and saved to the conversation history
- **WHEN** the user views the conversation later (hours, days, or weeks later)
- **THEN** the location message SHALL remain visible and accessible in the message list
- **AND** the system SHALL NOT automatically expire or remove location messages
- **AND** the location map SHALL remain visible inline in the message bubble

#### Scenario: Location appears alongside other message types
- **GIVEN** a conversation contains text messages, file attachments, reactions, and location messages
- **WHEN** the message list is rendered
- **THEN** location messages SHALL display consistently with text and file messages in chronological order
- **AND** the UI SHALL distinguish location messages with a location label and an inline map view
- **AND** users SHALL be able to react to, cite, and copy location messages using the same interaction menu as text and file messages

#### Scenario: Backward compatibility with location format
- **GIVEN** a remote nospeak client sends a location message
- **AND** the message content is `geo:lat,lng` and includes a `['location']` tag
- **WHEN** nospeak receives this message
- **THEN** the system SHALL interpret and display the location correctly
- **AND** if a remote client sends ONLY `geo:lat,lng` without a location tag, the system SHALL still render the location by parsing the geo URI from content
- **AND** if a remote client sends ONLY a location tag without geo URI content, the system SHALL still parse and render using the tag data

### Requirement: Location Preview Modal Before Sending
Before sending a location message, the messaging interface SHALL display an interactive OpenStreetMap iframe in a preview modal (reusing `AttachmentPreviewModal` with `mode="location"`) so the user can confirm the map content before sending. The modal SHALL support Cancel and Send actions and SHALL not send the location message until the user confirms Send.

#### Scenario: Selecting Location shows preview modal
- **GIVEN** a user is viewing an encrypted DM conversation with a contact
- **WHEN** the user selects "Location" from the media upload menu
- **THEN** the system SHALL fetch GPS coordinates
- **AND** the AttachmentPreviewModal SHALL open with `mode="location"`
- **AND** the modal SHALL display an interactive OpenStreetMap iframe centered on the fetched coordinates
- **AND** the iframe SHALL support pan and zoom interactions

#### Scenario: OpenStreetMap iframe renders at correct coordinates
- **GIVEN** the AttachmentPreviewModal is open with `mode="location"` and location `{ latitude: 52.5200, longitude: 13.4050 }`
- **WHEN** the modal renders the iframe
- **THEN** the iframe SHALL load OpenStreetMap with coordinates `52.5200, 13.4050`
- **AND** the map view SHALL show the correct geographic location
- **AND** a marker or pin SHALL be displayed at the coordinates (via OSM marker parameter if supported)

#### Scenario: Preview modal provides Cancel and Send
- **GIVEN** the AttachmentPreviewModal is open with `mode="location"` as a pre-send preview
- **WHEN** the modal content is rendered
- **THEN** the caption input field SHALL be hidden
- **AND** the modal SHALL show a Cancel button
- **AND** the modal SHALL show a Send confirmation button
- **AND** no file preview (image, video, audio) SHALL be shown
- **AND** choosing Cancel SHALL NOT send the location message
- **AND** choosing Send SHALL send the encrypted location message

#### Scenario: External link to full OpenStreetMap (optional)
- **GIVEN** the AttachmentPreviewModal is open with `mode="location"` at `{ latitude: 52.5200, longitude: 13.4050 }`
- **WHEN** the modal renders an OpenStreetMap external-link action
- **THEN** activating the link SHALL open `https://www.openstreetmap.org/?mlat=52.5200&mlon=13.4050&zoom=15` in a new browser tab

#### Scenario: Modal supports both media and location modes
- **GIVEN** the AttachmentPreviewModal is designed to support both media preview and location map
- **WHEN** opened with `mode="media"` after a user selects an image/video/audio attachment
- **THEN** the modal SHALL render the existing file preview interface with caption input and send/confirm buttons
- **WHEN** opened with `mode="location"` as a pre-send preview
- **THEN** the modal SHALL render the interactive OSM iframe
- **AND** the modal SHALL handle dismissal and user interactions consistently in both modes
