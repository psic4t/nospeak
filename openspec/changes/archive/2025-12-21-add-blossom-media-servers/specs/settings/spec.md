## ADDED Requirements

### Requirement: Media Servers Settings Category
The Settings interface SHALL provide a "Media Servers" category that allows users to view and manage their Blossom media server configuration.

#### Scenario: Settings sidebar shows Media Servers category
- **GIVEN** the user is authenticated and opens the Settings modal
- **WHEN** the Settings sidebar categories are rendered
- **THEN** the sidebar SHALL contain a "Media Servers" entry
- **AND** selecting this entry SHALL display the Media Servers configuration view.

### Requirement: Media Servers Add/Remove Behavior
The Media Servers settings view SHALL allow the user to add and remove Blossom media server URLs, and any changes SHALL update the locally cached server list and publish an updated replaceable Nostr event `kind:10063` containing ordered `server` tags.

#### Scenario: User adds a media server URL
- **GIVEN** the Media Servers view is open in Settings
- **WHEN** the user enters a valid server URL (or hostname that can be normalized to `https://…`) and confirms the add action
- **THEN** the new URL SHALL be normalized if necessary and appended to the server list if not already present
- **AND** the updated server list SHALL be saved to the user's local profile cache
- **AND** the client SHALL publish an updated `kind:10063` server list event that includes the new server URL.

#### Scenario: User removes a media server URL
- **GIVEN** the Media Servers view is open in Settings
- **AND** the current server list contains at least one URL
- **WHEN** the user removes a server from the list
- **THEN** the removed URL SHALL no longer appear in the server list
- **AND** the updated server list SHALL be saved to the user's local profile cache
- **AND** the client SHALL publish an updated `kind:10063` server list event that no longer includes the removed URL.

### Requirement: Upload Backend Toggle
The Settings interface SHALL provide a user-facing toggle under Settings → Media Servers that selects whether uploads use nospeak’s local upload endpoint or the user’s configured Blossom servers.

#### Scenario: Blossom mode toggle is disabled when no servers configured
- **GIVEN** the user has selected Settings → Media Servers
- **AND** the user has zero configured media server URLs
- **WHEN** the Media Servers view is rendered
- **THEN** the "Use Blossom servers" toggle SHALL be disabled (greyed out)
- **AND** uploads SHALL use the local nospeak upload endpoint.

#### Scenario: User enables Blossom uploads when servers exist
- **GIVEN** the user has at least one configured media server URL
- **WHEN** the user enables the "Use Blossom servers" toggle
- **THEN** the system SHALL persist the preference per device
- **AND** subsequent uploads SHALL use Blossom servers according to the `messaging` specification.
