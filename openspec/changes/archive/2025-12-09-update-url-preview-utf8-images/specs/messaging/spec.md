## MODIFIED Requirements

### Requirement: URL Preview for Non-Media Links
The messaging interface SHALL detect HTTP(S) URLs in message content that are not recognized as direct image or video media links and MAY render a compact URL preview card under the message bubble. The preview card SHALL display, when available, the destination page title, a short description or summary, and the effective domain, and MAY include a small favicon or thumbnail image. URL preview metadata lookups SHALL be initiated only for messages that are currently within the visible scroll viewport of the conversation, and the client SHALL avoid repeated metadata requests for the same message content once a successful or failed preview attempt has been recorded. When metadata is available from the destination, the client and preview service SHALL correctly decode common HTML entities and character encodings so that non-ASCII characters (such as umlauts) are rendered as human-readable text in the preview card.

#### Scenario: Preview card correctly decodes HTML entities
- **GIVEN** a sent or received message whose content includes at least one non-media HTTP(S) URL
- **AND** the destination page exposes a title or description that includes HTML entity-encoded characters (for example, `&uuml;`, `&ouml;`, or numeric character references)
- **WHEN** the system fetches preview metadata and renders the URL preview card while the message bubble is within the visible scroll viewport
- **THEN** the title and description in the preview card SHALL display those characters as properly decoded text (for example, `für` instead of `f&uuml;r`)
- **AND** the user SHALL NOT see raw entity sequences in the preview card text.

#### Scenario: Preview card uses expanded metadata sources
- **GIVEN** a sent or received message whose content includes at least one non-media HTTP(S) URL
- **AND** the destination page provides metadata via standard Open Graph, Twitter card, or common HTML meta tags (including `og:title`, `og:description`, `og:image`, `twitter:title`, `twitter:description`, `twitter:image`, or `meta name="description"`)
- **WHEN** the system fetches preview metadata for that URL while the message bubble is within the visible scroll viewport
- **THEN** the preview service SHALL consider these standard tags as candidates when deriving the title, description, and image for the preview card
- **AND** it SHALL resolve relative image URLs against the destination URL so that the preview card can show a thumbnail when available.

#### Scenario: Graceful behavior for consent or cookie-wall pages
- **GIVEN** a sent or received message whose content includes at least one non-media HTTP(S) URL
- **AND** the initial response for that URL is a consent, cookie-wall, or generic interstitial page that does not expose detailed article-specific metadata
- **WHEN** the system fetches preview metadata and parses the available HTML
- **THEN** the preview service MAY derive a minimal preview using whatever generic title or description is present (for example, the site name)
- **AND** any text it surfaces in the preview card SHALL still respect the entity and character decoding behavior defined above
- **AND** when no meaningful metadata beyond such generic text is available, the system MAY omit the preview card entirely while leaving the original link clickable in the message text.
