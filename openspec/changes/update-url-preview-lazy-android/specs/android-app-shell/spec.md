## ADDED Requirements
### Requirement: Android URL Preview via Remote Server
When running inside the Android Capacitor app shell, the messaging experience SHALL treat URL previews for non-media HTTP(S) links as an optional enhancement backed by a remote server-side preview API, while keeping the main chat UI and core messaging behaviors available from locally bundled web assets.

#### Scenario: Android app shell uses remote preview API
- **GIVEN** the user is running nospeak inside the Android Capacitor app shell
- **AND** the app has loaded the chat UI from locally bundled web assets
- **AND** a visible message bubble contains at least one non-media HTTP(S) URL
- **WHEN** the system attempts to fetch URL preview metadata for that message
- **THEN** it SHALL call a remote server-side preview API endpoint (for example, the existing `/api/url-preview` route on the deployed SvelteKit instance) rather than relying on a local in-app implementation at the app's origin
- **AND** it SHALL apply the same viewport-based and single-request-per-message semantics defined by the `messaging` URL preview requirements.

#### Scenario: Android preview failure does not break messaging
- **GIVEN** the user is running nospeak inside the Android Capacitor app shell
- **AND** a visible message bubble contains at least one non-media HTTP(S) URL
- **WHEN** the remote server-side preview API is unavailable, slow, or returns incomplete metadata
- **THEN** the message text and its links SHALL still render and remain clickable
- **AND** the system MAY omit the URL preview card entirely without surfacing blocking or noisy error UI
- **AND** all other messaging features (including sending, receiving, history scrolling, and media rendering) SHALL continue to function according to the existing `messaging` specification.

#### Scenario: Android preview behavior respects global URL preview settings
- **GIVEN** the user has disabled URL previews via the global messaging settings
- **WHEN** the user views conversations inside the Android Capacitor app shell
- **THEN** the system SHALL NOT issue remote server-side preview API requests for non-media HTTP(S) URLs in messages
- **AND** the messages SHALL still render with clickable links and media behavior consistent with the `messaging` and `settings` specs.

#### Scenario: Android offline behavior simply omits previews
- **GIVEN** the user has previously opened the nospeak Android app and the web assets are bundled locally
- **AND** the device is currently offline or unable to reach the remote server-side preview API
- **WHEN** the user opens a conversation that includes messages with non-media HTTP(S) URLs
- **THEN** the app SHALL still load the main chat interface shell from local assets as defined by the existing Android Capacitor App Shell requirements
- **AND** the system SHALL treat URL previews as unavailable, rendering only the message text and clickable links without preview cards.
