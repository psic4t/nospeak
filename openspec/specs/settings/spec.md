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

