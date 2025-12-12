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

### Requirement: Message Notifications Toggle in Settings
The Settings interface SHALL provide a message notifications option under Settings  General that controls whether the application attempts to show new-message notifications on the current device. The toggle SHALL persist per device, SHALL default to disabled when no prior preference has been stored, and SHALL gate both web and Android notification behavior without depending solely on OS-level permission state.

#### Scenario: Default notifications disabled
- **GIVEN** a user opens the application on a device where no `nospeak` settings have been stored
- **WHEN** the user opens Settings  General
- **THEN** the message notifications option SHALL appear in the disabled state by default
- **AND** the system SHALL NOT attempt to show new-message notifications until the user explicitly enables the option and the platform grants notification permission.

#### Scenario: User enables notifications on web
- **GIVEN** the user is accessing nospeak in a standard web browser that supports the Notifications API
- **AND** the message notifications option is currently disabled
- **WHEN** the user enables the option in Settings  General
- **THEN** the system SHALL request browser notification permission if not already granted
- **AND** upon permission being granted, the preference for message notifications SHALL be stored so that the enabled state persists across reloads on that device
- **AND** new-message events SHALL be eligible to trigger browser notifications according to the messaging notification requirements.

#### Scenario: User enables notifications in Android app
- **GIVEN** the user is running nospeak inside the Android Capacitor app shell
- **AND** the message notifications option is currently disabled
- **WHEN** the user enables the option in Settings  General
- **THEN** the app SHALL request OS-level permission for local notifications via the Android runtime
- **AND** upon permission being granted, the preference for message notifications SHALL be stored so that the enabled state persists for that Android installation
- **AND** new-message events SHALL be eligible to trigger local notifications through the Android notification system.

#### Scenario: User disables message notifications
- **GIVEN** the message notifications option is currently enabled on a device
- **WHEN** the user disables the option in Settings  General
- **THEN** the system SHALL stop attempting to show new-message notifications on that device regardless of existing OS-level permission
- **AND** the stored preference SHALL be updated so that notifications remain disabled on subsequent app launches until the user re-enables them.

### Requirement: Android Background Messaging Preference
The Settings interface SHALL provide an Android-only background messaging preference under Settings → General that controls whether the Android app is allowed to keep relay connections and message subscriptions active while the app UI is not visible. The preference SHALL be stored per Android installation and SHALL be independent from, but compatible with, the existing message notifications toggle.

#### Scenario: Background messaging toggle default and visibility
- **GIVEN** a user opens Settings → General inside the Android Capacitor app shell on a device where no background messaging preference has been stored
- WHEN the settings view is rendered
- THEN the background messaging preference SHALL appear in the disabled state by default
- AND the control SHALL be visible only when running inside the Android app shell (not in standard web browsers).

#### Scenario: User enables Android background messaging
- **GIVEN** the user is running nospeak inside the Android Capacitor app shell
- AND the background messaging preference is currently disabled
- WHEN the user enables the background messaging option in Settings → General
- THEN the app SHALL persist the enabled state for that Android installation
- AND it SHALL prompt the user to grant any required Android background activity or battery optimization permissions (for example, by navigating to the appropriate system settings screen)
- AND upon confirmation or best-effort completion of the OS permission flow, the app SHALL be eligible to start the Android background messaging foreground service.

#### Scenario: User disables Android background messaging
- **GIVEN** the background messaging preference is currently enabled on an Android device
- WHEN the user disables the background messaging option in Settings → General
- THEN the app SHALL persist the disabled state for that installation
- AND it SHALL stop any active Android background messaging foreground service
- AND it SHALL close background relay connections associated with that service.

#### Scenario: Web settings behavior unchanged outside Android
- **GIVEN** the user opens Settings → General in a standard web browser (not inside the Android app shell)
- WHEN the settings view is rendered
- THEN no Android background messaging preference control SHALL be shown
- AND the existing message notifications toggle and other settings SHALL behave as already defined in the `settings` specification.

### Requirement: Android Back Behavior for Settings and Manage Contacts
When running inside the Android Capacitor app shell, the Settings and Manage Contacts experiences SHALL integrate with the Android system back action so that back first closes these modals before any route-level navigation occurs, keeping the user on their current underlying chat or contact list view.

#### Scenario: Android back closes Settings modal
- **GIVEN** the user is running nospeak inside the Android Capacitor app shell
- **AND** the Settings modal is currently open above the chat or contact list UI
- **WHEN** the user triggers the Android system back action (via hardware back or OS back swipe)
- **THEN** the Settings modal SHALL be closed
- **AND** the underlying chat or contact list view SHALL remain visible
- **AND** the app SHALL NOT exit or change the current route as a result of this back action.

#### Scenario: Android back closes Manage Contacts modal
- **GIVEN** the user is running nospeak inside the Android Capacitor app shell
- **AND** the Manage Contacts modal is currently open above the chat or contact list UI
- **WHEN** the user triggers the Android system back action
- **THEN** the Manage Contacts modal SHALL be closed
- **AND** the underlying chat or contact list view SHALL remain visible
- **AND** the app SHALL NOT exit or change the current route as a result of this back action.

