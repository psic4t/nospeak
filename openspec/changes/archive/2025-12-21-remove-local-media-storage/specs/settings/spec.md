## MODIFIED Requirements
### Requirement: Media Servers Settings Category
The Settings interface SHALL provide a "Media Servers" category that allows users to view and manage their Blossom media server configuration.

Media uploads in nospeak (chat attachments and profile media) SHALL always use Blossom servers derived from this configuration. The Settings UI SHALL NOT provide any toggle to select a non-Blossom upload backend.

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

## REMOVED Requirements
### Requirement: Upload Backend Toggle
**Reason**: Blossom is now the only supported upload backend; the toggle is redundant and can lead to inconsistent behaviour.

**Migration**: Any stored per-device upload-backend preference SHALL be ignored and uploads SHALL use Blossom servers.

#### Scenario: Previously stored toggle value is ignored
- **GIVEN** the user previously stored an upload-backend preference on this device
- **WHEN** the user performs a media upload after this change
- **THEN** the stored preference SHALL be ignored
- **AND** the upload SHALL use Blossom servers according to the `messaging` specification.
