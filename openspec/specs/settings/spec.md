# settings Specification

## Purpose
TBD - created by archiving change add-theme-mode-selector. Update Purpose after archive.
## Requirements
### Requirement: Theme Mode Selection in Settings
The Settings interface SHALL provide a theme mode selector in the General section that lets users choose between System, Light, and Dark appearance modes. The selector SHALL default to System when no prior preference is stored, SHALL persist the selected mode per device, and SHALL map Light to Catppuccin Latte and Dark to Catppuccin Frappe. The effective theme mode SHALL also control the colorization of the in-app nospeak logo so that bright/light appearances use Catppuccin Latte Text, while dark appearances use a white logo that visually matches Catppuccin Frappe text color.

#### Scenario: Default theme mode is System
- **GIVEN** a user opens the application on a device where no theme mode preference has been stored
- **WHEN** the user opens Settings  General
- **THEN** the theme mode selector displays "System" as the current value
- **AND** the effective theme follows the devices `prefers-color-scheme` setting
- **AND** the in-app nospeak logo uses a bright or dark appearance consistent with the effective theme (Latte for light, Frappe for dark)

#### Scenario: User selects Light mode
- **GIVEN** the user opens Settings  General
- **WHEN** the user selects "Light" in the theme mode selector
- **THEN** the application immediately applies the Catppuccin Latte theme
- **AND** the global UI background, panels, and text colors update to the light palette
- **AND** the in-app nospeak logo appears in Catppuccin Latte Lavender (bright violet)
- **AND** the selected mode is stored so that Light remains active on subsequent reloads of the application on that device

#### Scenario: User selects Dark mode
- **GIVEN** the user opens Settings  General
- **WHEN** the user selects "Dark" in the theme mode selector
- **THEN** the application immediately applies the Catppuccin Frappe theme
- **AND** the global UI background, panels, and text colors update to the dark palette
- **AND** the in-app nospeak logo appears as a white logo that visually matches the Catppuccin Frappe text color
- **AND** the selected mode is stored so that Dark remains active on subsequent reloads of the application on that device

#### Scenario: System mode follows OS theme
- **GIVEN** the theme mode selector is set to "System"
- **AND** the application is open
- **WHEN** the operating system or browser changes its color scheme preference between light and dark
- **THEN** the application updates its effective theme to match the new system preference using Catppuccin Latte for light and Catppuccin Frappe for dark
- **AND** any Tailwind `dark:` styles in the UI continue to reflect the correct light or dark state
- **AND** the in-app nospeak logo updates between Latte Lavender and white appearance in sync with the effective theme.

### Requirement: NIP-05 Status Display in Settings
The Settings interface SHALL surface NIP-05 verification status for the current user's configured NIP-05 identifier in the profile or general settings section. The status SHALL be derived from the same cached verification data used by messaging, and SHALL avoid implying verification when the identifier has not been checked or when verification is inconclusive.

#### Scenario: Settings shows verified NIP-05 for current user
- **GIVEN** the current user's profile metadata includes a `nip05` field
- **AND** the system has recorded the NIP-05 status as `valid` for the user's public key based on a successful lookup to `/.well-known/nostr.json`
- **WHEN** the user opens the Settings view containing their NIP-05 field
- **THEN** the UI SHALL display the NIP-05 identifier using the `_@domain` to `domain` visual transformation when applicable
- **AND** SHALL show a clear textual or icon-based indicator that the identifier is verified for the current key.

#### Scenario: Settings shows not-verified state for invalid NIP-05
- **GIVEN** the current user's profile metadata includes a `nip05` field
- **AND** the system has recorded the NIP-05 status as `invalid` for the user's public key
- **WHEN** the user opens the Settings view containing their NIP-05 field
- **THEN** the UI SHALL display the NIP-05 identifier
- **AND** SHALL display a clear \"not verified\" state (for example, a warning icon and explanatory text) indicating that the identifier does not match the current key according to NIP-05 records.

#### Scenario: Settings shows neutral state for unknown NIP-05
- **GIVEN** the current user's profile metadata includes a `nip05` field
- **AND** the system either has not yet attempted verification or has recorded the status as `unknown` due to network or CORS failure
- **WHEN** the user opens the Settings view containing their NIP-05 field
- **THEN** the UI SHALL display the NIP-05 identifier without a verified or not-verified badge
- **AND** MAY display a short helper message explaining that verification has not completed or could not be confirmed.

#### Scenario: Editing NIP-05 resets status until re-verified
- **GIVEN** the Settings view allows the user to edit their NIP-05 identifier
- **AND** the system has previously recorded a NIP-05 status for the old value
- **WHEN** the user changes the NIP-05 field to a different value and saves their profile
- **THEN** the previous NIP-05 status SHALL be cleared or marked as unknown for the new value
- **AND** the system SHALL perform a fresh verification attempt for the new identifier before displaying it as verified in Settings or messaging UIs.

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

