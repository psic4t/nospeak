## MODIFIED Requirements
### Requirement: URL Preview for Non-Media Links
The messaging interface SHALL detect HTTP(S) URLs in message content that are not recognized as direct image or video media links and MAY render a compact URL preview card under the message bubble. The preview card SHALL display, when available, the destination page title, a short description or summary, and the effective domain, and MAY include a small favicon or thumbnail image. URL preview metadata lookups SHALL be initiated only for messages that are currently within the visible scroll viewport of the conversation, and the client SHALL avoid repeated metadata requests for the same message content once a successful or failed preview attempt has been recorded.

#### Scenario: Preview card for non-media link
- **GIVEN** a sent or received message whose content includes at least one HTTP(S) URL that does not point directly to an image or video file
- **WHEN** the message is rendered in the chat history
- **AND** the message bubble is within the visible scroll viewport
- **THEN** the system SHALL display a single compact URL preview card associated with that message
- **AND** the card SHALL show the link's effective domain and title when metadata is available
- **AND** the entire card SHALL be clickable and open the link in a new browser tab or window using standard safe-link behavior.

#### Scenario: No preview for media-only URLs
- **GIVEN** a message whose URLs all point directly to image or video files that are already supported by the Media Upload and Media display behavior
- **WHEN** the message is rendered in the chat history
- **THEN** the system SHALL render media inline as currently specified
- **AND** SHALL NOT render an additional non-media URL preview card for those media URLs.

#### Scenario: Graceful degradation when metadata unavailable
- **GIVEN** a message that contains a non-media HTTP(S) URL
- **AND** the system attempts to fetch preview metadata for that URL when the message bubble enters the visible scroll viewport
- **WHEN** the metadata request fails, times out, or returns only partial information
- **THEN** the message text SHALL still render with a clickable link
- **AND** the system MAY omit the preview card entirely when no meaningful metadata is available
- **AND** the user SHALL NOT see an inline error message that blocks reading the message content.

#### Scenario: Multiple links in a single message
- **GIVEN** a message that contains multiple distinct non-media HTTP(S) URLs
- **WHEN** the message is rendered in the chat history and the message bubble is within the visible scroll viewport
- **THEN** the system MAY render at most one URL preview card for that message (for example, for the first or primary URL)
- **AND** all URLs in the message text remain clickable regardless of whether they are represented in the preview card.

#### Scenario: No preview requests for off-screen history
- **GIVEN** a conversation whose history includes many older messages containing non-media HTTP(S) URLs
- **AND** only the most recent subset of messages is currently visible in the scroll viewport
- **WHEN** the user opens or scrolls the conversation
- **THEN** the system SHALL initiate URL preview metadata requests only for messages whose bubbles are within the visible viewport
- **AND** SHALL NOT perform metadata lookups for non-visible off-screen messages until they are scrolled into view.

#### Scenario: No repeated preview requests for same message
- **GIVEN** a message whose non-media HTTP(S) URL has already triggered a URL preview metadata lookup while the message was visible
- **WHEN** the user scrolls the message out of view and then back into view during the same session
- **THEN** the system SHALL avoid issuing duplicate metadata requests for that same URL in that message
- **AND** SHALL reuse the previously resolved preview metadata or the fact that no meaningful metadata is available.
