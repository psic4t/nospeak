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

### Requirement: Android Background Messaging Preference
The Settings interface SHALL provide an Android-only background messaging preference under Settings → General that controls whether the Android app is allowed to keep relay connections and message subscriptions active while the app UI is not visible.

This preference SHALL be stored per Android installation and SHALL be compatible with the Notifications toggle:
- When Notifications are disabled, background messaging SHALL be treated as disabled and the preference SHALL NOT be user-configurable.
- When Notifications are enabled and no prior preference has been stored, the background messaging preference SHALL default to enabled (opt-out).

The preference persistence mechanism SHALL survive device restarts and app updates and SHALL be readable by Android-native components (for example, boot receivers) without requiring the WebView to start.

When the current session is a local-key (nsec) session and the Android-native secret key required for background decryption is missing, the system SHALL disable background messaging for that installation rather than keeping the service running in a degraded state.

#### Scenario: Default background messaging enabled
- **GIVEN** the user is running nospeak inside the Android Capacitor app shell
- **AND** Notifications are enabled
- **AND** no background messaging preference has been stored for this Android installation
- **WHEN** the user opens Settings → General
- **THEN** the background messaging preference SHALL be enabled by default.

#### Scenario: Background messaging is hidden when notifications are disabled
- **GIVEN** the user is running nospeak inside the Android Capacitor app shell
- **AND** Notifications are disabled
- **WHEN** the user opens Settings → General
- **THEN** the background messaging preference control SHALL NOT be shown.

#### Scenario: Disabling notifications disables background messaging
- **GIVEN** the user is running nospeak inside the Android Capacitor app shell
- **AND** background messaging is enabled
- **WHEN** the user disables Notifications
- **THEN** the system SHALL disable background messaging for that installation
- **AND** the native foreground service SHALL stop.

#### Scenario: Background messaging does not start when notifications are disabled
- **GIVEN** Notifications are disabled for the current Android installation
- **WHEN** the Android shell attempts to start or restore background messaging (including on boot)
- **THEN** the native foreground service SHALL NOT be started.

#### Scenario: Background messaging auto-disables when local secret is missing
- **GIVEN** the user previously enabled Android background messaging in Settings → General
- **AND** the current session is a local-key (nsec) session
- **AND** the Android-native secret key required for local-key background decryption is missing
- **WHEN** the Android shell attempts to start or restore background messaging (including on boot)
- **THEN** the system SHALL persistently disable the background messaging preference for that installation
- **AND** the native foreground service SHALL stop
- **AND** the user MUST re-login before background messaging can be enabled again.

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

### Requirement: Language Selection in Settings
The Settings interface SHALL provide a language selection control under Settings → General that determines the language used for static UI text (including labels, headings, helper text, and button copy) across the nospeak web client. The language preference SHALL be stored per device, independent of the authenticated account, and SHALL default to English when no preference can be inferred.

#### Scenario: Default language follows environment with German preference
- **GIVEN** a user opens nospeak on a device where no `nospeak` language preference has been stored
- **AND** the browser or operating system language is reported as a `de-*` locale (for example, `de-DE` or `de-AT`)
- **WHEN** the Settings → General view is rendered
- **THEN** the language selector SHALL show German as the current value
- **AND** static UI text covered by localization (including the Settings labels and descriptions) SHALL be rendered in German
- **AND** the effective language preference SHALL be stored on that device for future sessions.

#### Scenario: Default language falls back to English
- **GIVEN** a user opens nospeak on a device where no `nospeak` language preference has been stored
- **AND** the browser or operating system language is not a `de-*` locale
- **WHEN** the Settings → General view is rendered
- **THEN** the language selector SHALL show English as the current value
- **AND** static UI text covered by localization SHALL be rendered in English
- **AND** the effective language preference SHALL be stored on that device for future sessions.

#### Scenario: User changes language from English to German
- **GIVEN** nospeak is currently displaying static UI text in English
- **AND** the user has opened Settings → General
- **WHEN** the user changes the language selector from English to German
- **THEN** the Settings modal and other covered UI chrome SHALL update to German without requiring a full page reload
- **AND** the new language preference SHALL be stored so that subsequent visits on that device continue to use German.

#### Scenario: User changes language from German to English
- **GIVEN** nospeak is currently displaying static UI text in German
- **AND** the user has opened Settings → General
- **WHEN** the user changes the language selector from German to English
- **THEN** the Settings modal and other covered UI chrome SHALL update to English without requiring a full page reload
- **AND** the new language preference SHALL be stored so that subsequent visits on that device continue to use English.

#### Scenario: Language preference is per-device
- **GIVEN** a user has selected German as the language on one device
- **AND** the same user signs in to nospeak on a different device where no language preference has been stored
- **WHEN** the Settings → General view is rendered on the second device
- **THEN** the language selector and UI texts on the second device SHALL follow the default language selection logic for that environment (including German auto-selection for `de-*` locales)
- **AND** the language preference on the first device SHALL remain unchanged.

### Requirement: Messaging Relays Settings Category
The Settings interface SHALL provide a "Messaging Relays" category that allows users to configure the set of relay URLs used for sending and receiving encrypted direct messages. This category replaces the previous "Mailbox Relays" terminology and read/write relay split, and SHALL present a single list of messaging relay URLs that are published as the user's NIP-17 kind 10050 messaging relay list.

#### Scenario: Settings sidebar shows Messaging Relays category
- **GIVEN** the user is authenticated and opens the Settings modal
- **WHEN** the Settings sidebar categories are rendered
- **THEN** the sidebar SHALL contain a "Messaging Relays" entry instead of "Mailbox Relays"
- **AND** selecting this entry SHALL display the messaging relays configuration view.

#### Scenario: Messaging Relays view shows a single relay list
- **GIVEN** the user has selected the "Messaging Relays" category in Settings
- **WHEN** the messaging relays view is rendered
- **THEN** it SHALL display a single list of relay URLs representing the current user's messaging relays
- **AND** it SHALL NOT display separate read/write checkboxes or labels for each relay.

### Requirement: Messaging Relays Add/Remove Behavior
The Messaging Relays settings view SHALL allow the user to add and remove messaging relay URLs, and any changes SHALL update the locally cached profile and the user's published NIP-17 kind 10050 messaging relay list.

#### Scenario: User adds a messaging relay URL
- **GIVEN** the Messaging Relays view is open in Settings
- **WHEN** the user enters a valid relay URL (or hostname that can be normalized to `wss://…`) and confirms the add action
- **THEN** the new URL SHALL be normalized if necessary, appended to the messaging relay list if not already present, and saved to the user's profile cache
- **AND** the client SHALL publish an updated kind 10050 messaging relay list event that includes the new relay URL.

#### Scenario: User removes a messaging relay URL
- **GIVEN** the Messaging Relays view is open in Settings
- **AND** the current messaging relay list contains at least one URL
- **WHEN** the user removes a relay from the list
- **THEN** the removed URL SHALL no longer appear in the messaging relay list
- **AND** the updated list SHALL be saved to the user's profile cache
- **AND** the client SHALL publish an updated kind 10050 messaging relay list event that reflects the removal.

### Requirement: Settings Layout Across Desktop, Mobile Web, and Android
The Settings experience SHALL adapt its layout and navigation pattern to the users platform and viewport while preserving the same set of categories (including General, Profile, Messaging Relays, Security, and About) and underlying settings semantics. Desktop web SHALL continue to use a two-column dialog with persistent sidebar navigation, while mobile web (PWA) and the Android app shell SHALL use a card-based navigation pattern without a persistent active background state on the list of categories.

#### Scenario: Desktop settings use sidebar navigation
- **GIVEN** the user is accessing nospeak in a desktop-class browser at a layout where the authenticated app window is rendered as a centered glass container with a visible left contacts column and right chat area
- **AND** the user opens the Settings experience from the contacts header
- **WHEN** the Settings dialog is rendered
- **THEN** it SHALL appear as a glassmorphism dialog with a left navigation area listing Settings categories (including General, Profile, Messaging Relays, Security, and About)
- **AND** selecting any category in this navigation area SHALL keep the navigation visible while the corresponding detail view is shown on the right
- **AND** the currently selected category in the navigation area SHALL be visually distinguished with an "active" treatment consistent with the visual-design specification.

#### Scenario: Mobile web Settings use full-screen card navigation
- **GIVEN** the user is accessing nospeak via a mobile web browser (PWA) at a handset-sized viewport outside of the Android app shell
- **AND** the authenticated app window is rendered as a full-screen glass surface
- **WHEN** the user opens the Settings experience
- **THEN** Settings SHALL appear as a full-screen overlay above the authenticated app window with a header bar containing a title and close/back control
- **AND** the initial view within this overlay SHALL present a vertical list of card-like entries, one per Settings category (including General, Profile, Messaging Relays, Security, and About)
- **AND** tapping a card SHALL navigate to a dedicated detail view for that category within the same overlay
- **AND** the card list itself SHALL NOT retain a persistent colored active background on the previously tapped card once the user is in the detail view; the current category MAY instead be indicated in the detail header.

#### Scenario: Android Settings use bottom sheet card navigation
- **GIVEN** the user is running nospeak inside the Android Capacitor app shell
- **AND** the authenticated chat UI is visible behind any overlays
- **WHEN** the user opens the Settings experience
- **THEN** Settings SHALL be presented as a bottom sheet anchored to the bottom of the screen with rounded top corners and a glassmorphism surface
- **AND** the bottom sheet content SHALL reuse the same card-based category list and per-category detail views as the mobile web Settings overlay
- **AND** the card list in the Android bottom sheet SHALL NOT retain a persistent colored active background state on the previously tapped card once the user is viewing a categorys detail content
- **AND** the Android system back action and explicit close controls SHALL dismiss the Settings bottom sheet before causing any route-level navigation, consistent with existing Android back behavior requirements.

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

### Requirement: Notifications Toggle in Settings
The Settings interface SHALL provide a notifications option under Settings → General that controls whether the application attempts to show message and reaction notifications on the current device.

The toggle SHALL persist per device, SHALL default to enabled when no prior preference has been stored (opt-out), and SHALL gate both web and Android notification behavior without depending solely on OS-level permission state.

#### Scenario: Default notifications enabled
- **GIVEN** a user opens the application on a device where no `nospeak` settings have been stored
- **WHEN** the user opens Settings → General
- **THEN** the notifications option SHALL appear in the enabled state by default
- **AND** the system SHALL attempt to show message/reaction notifications only when OS-level notification permission is granted.

#### Scenario: Permission prompt occurs once on explicit login
- **GIVEN** the notifications option is enabled (including by default)
- **AND** OS notification permission is not yet granted
- **AND** the system has not previously prompted for notification permission on this device
- **WHEN** the user performs an explicit login action (local key, extension, or Amber)
- **THEN** the system SHALL request OS notification permission as part of that login flow
- **AND** the login flow SHALL continue regardless of whether permission is granted or denied
- **AND** the system SHALL NOT repeatedly prompt for notification permission on subsequent logins on the same device.

#### Scenario: User disables notifications
- **GIVEN** the notifications option is currently enabled on a device
- **WHEN** the user disables the option in Settings → General
- **THEN** the system SHALL stop attempting to show message/reaction notifications on that device regardless of existing OS-level permission
- **AND** the stored preference SHALL be updated so that notifications remain disabled on subsequent app launches until the user re-enables them.

#### Scenario: User re-enables notifications
- **GIVEN** the notifications option is currently disabled on a device
- **WHEN** the user enables the option in Settings → General
- **THEN** the system SHALL request OS notification permission if not already granted
- **AND** upon permission being granted, message/reaction events SHALL be eligible to trigger notifications according to the messaging and platform requirements.

#### Scenario: Notifications delegated to background service when background messaging enabled
- **GIVEN** the user is running nospeak inside the Android Capacitor app shell
- **AND** the user has enabled Android background messaging
- **AND** notifications are enabled
- **WHEN** a new message or reaction arrives while the app UI is not visible
- **THEN** the system SHALL treat the Android background messaging native foreground service as the primary emitter of Android OS message/reaction notifications
- **AND** the web runtime SHALL suppress JS-driven Android local notification scheduling while background messaging remains enabled.

