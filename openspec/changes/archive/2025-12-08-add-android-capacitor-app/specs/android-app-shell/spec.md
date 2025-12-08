## ADDED Requirements
### Requirement: Android Capacitor App Shell
The project SHALL provide an Android application package that wraps the existing nospeak web client using Capacitor, bundles the compiled web assets locally, and launches directly into the chat experience without requiring an external browser.

#### Scenario: Android app launches bundled nospeak UI
- **GIVEN** the nospeak Android app is installed on a supported Android device
- **WHEN** the user taps the nospeak app icon
- **THEN** the app SHALL open a Capacitor-powered WebView that loads the bundled nospeak web UI from local assets
- **AND** the initial screen SHALL respect the existing startup navigation behavior defined in the `messaging` spec (desktop vs mobile contact list and conversation routing).

#### Scenario: Android app works offline for cached content
- **GIVEN** the user has successfully opened the nospeak Android app at least once and the web assets are bundled locally
- **WHEN** the device is temporarily offline but the user opens the nospeak app again
- **THEN** the app SHALL still load the main chat interface shell from local assets
- **AND** any messaging behavior that depends on relays or remote HTTP endpoints MAY be degraded, but the UI SHALL remain responsive and clearly indicate connection state as defined in existing specs.

### Requirement: Android Build and Release Pipeline
The project SHALL define a documented build and release pipeline for the Android app that uses Capacitor tooling and the Android SDK to produce signed APK/AAB artifacts suitable for distribution.

#### Scenario: Android build command produces installable artifact
- **WHEN** a developer runs the documented Android build command from the repository root
- **THEN** the project SHALL produce an Android build (APK or AAB) that can be installed on an emulator or physical device
- **AND** the build SHALL embed the same nospeak web client version as the current production web build.

#### Scenario: Documented steps for signing and store upload
- **WHEN** a maintainer follows the documented signing and store-upload steps
- **THEN** they SHALL be able to generate a signed Android artifact
- **AND** SHALL be able to submit it to the chosen distribution channel (such as the Google Play Store) without requiring undocumented manual configuration changes.
