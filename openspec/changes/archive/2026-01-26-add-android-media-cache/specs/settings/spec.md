## MODIFIED Requirements

### Requirement: Media Servers Settings Category
The Settings interface SHALL provide a "Media Servers" category that allows users to view and manage their Blossom media server configuration.

Media uploads in nospeak (chat attachments and profile media) SHALL always use Blossom servers derived from this configuration. The Settings UI SHALL NOT provide any toggle to select a non-Blossom upload backend.

When running inside the Android Capacitor app shell, the Media Servers view SHALL additionally display a "Media Cache" toggle that controls whether decrypted media is cached locally to the device gallery after viewing.

#### Scenario: Settings shows Media Servers category and server list
- **GIVEN** the user is authenticated and opens the Settings modal
- **WHEN** the Settings sidebar categories are rendered
- **THEN** the sidebar SHALL contain a "Media Servers" entry
- **AND** selecting this entry SHALL display the Media Servers configuration view
- **AND** the view SHALL display an ordered list of configured Blossom server URLs.

#### Scenario: User cannot disable Blossom uploads
- **GIVEN** the user has opened Settings → Media Servers
- **WHEN** the Media Servers view is rendered
- **THEN** the UI SHALL NOT display a "Use Blossom servers" toggle (or any upload-backend toggle)
- **AND** uploads SHALL always use Blossom servers.

#### Scenario: Android Media Servers view shows Media Cache toggle
- **GIVEN** the user is running nospeak inside the Android Capacitor app shell
- **AND** the user has opened Settings → Media Servers
- **WHEN** the Media Servers view is rendered
- **THEN** the view SHALL display a "Media Cache" toggle below the server list
- **AND** the toggle SHALL default to off when no prior preference has been stored.

#### Scenario: Web Media Servers view does not show Media Cache toggle
- **GIVEN** the user is accessing nospeak in a standard web browser rather than the Android Capacitor app shell
- **AND** the user has opened Settings → Media Servers
- **WHEN** the Media Servers view is rendered
- **THEN** the view SHALL NOT display a "Media Cache" toggle.
