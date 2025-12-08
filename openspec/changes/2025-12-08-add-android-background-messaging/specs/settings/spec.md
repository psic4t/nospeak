## ADDED Requirements
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
