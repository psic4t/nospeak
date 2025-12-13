## ADDED Requirements
### Requirement: Android Native Haptics for Micro-Interactions
When running inside the Android Capacitor app shell, the messaging experience SHALL use the Capacitor Haptics plugin (for example, `@capacitor/haptics`) to provide soft, OS-native haptic feedback for selected micro-interactions, aligning with the visual-design micro-interaction guidance while remaining non-blocking when haptics are unavailable.

#### Scenario: Soft haptic feedback on primary tap interactions
- **GIVEN** the user is running nospeak inside the Android Capacitor app shell on a supported Android device
- **AND** the user performs a primary tap interaction that is configured to trigger `softVibrate` (for example, selecting a contact from the list or opening a conversation)
- **WHEN** the tap interaction is handled by the web client
- **THEN** the Android shell SHALL invoke the Capacitor Haptics plugin to trigger a light-impact haptic effect corresponding to a "soft" vibration
- **AND** the haptic call SHALL be non-blocking and SHALL NOT prevent the underlying navigation or action from completing if the plugin is unavailable or fails.

#### Scenario: Web behavior remains unchanged outside Android shell for haptics
- **GIVEN** the user is accessing nospeak via a standard web browser rather than the Android Capacitor app shell
- WHEN the user performs the same interactions that would normally trigger soft haptics on Android (such as contact selection or chat navigation)
- THEN the system SHALL NOT require the Capacitor Haptics plugin to be present
- AND the absence of haptic feedback SHALL NOT block or degrade the primary interaction behavior, which SHALL continue to follow the existing messaging and visual-design requirements.
