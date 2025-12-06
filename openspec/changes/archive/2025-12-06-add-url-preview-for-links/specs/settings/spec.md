## MODIFIED Requirements
### Requirement: URL Preview Toggle in Settings
The application settings interface SHALL expose a user-facing option under Settings → General that controls whether URL previews for non-media links are rendered in chat messages. The option SHALL be enabled by default for new and existing users.

#### Scenario: Default state enables URL previews
- **GIVEN** a new or existing user who has not changed the URL previews setting
- **WHEN** the user opens Settings → General
- **THEN** the URL previews option SHALL appear in the enabled state by default
- **AND** non-media links in chat messages SHALL render URL preview cards when metadata is available.

#### Scenario: User disables URL previews
- **GIVEN** a user who opens Settings → General
- **WHEN** the user disables the URL previews option and saves or closes the settings modal
- **THEN** subsequent rendering of chat messages SHALL NOT show URL preview cards for non-media links
- **AND** the links in message text SHALL remain clickable as normal.

#### Scenario: User re-enables URL previews
- **GIVEN** a user who previously disabled URL previews in Settings → General
- **WHEN** the user re-enables the URL previews option
- **THEN** newly rendered and updated chat messages containing non-media links SHALL once again show URL preview cards when metadata is available
- **AND** previously stored messages SHALL NOT require resending to benefit from the preview behavior.
