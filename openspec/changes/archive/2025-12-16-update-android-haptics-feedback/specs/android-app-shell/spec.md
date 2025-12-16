## MODIFIED Requirements
### Requirement: Android Native Haptics for Micro-Interactions
When running inside the Android Capacitor app shell, the messaging experience SHALL use the Capacitor Haptics plugin (for example, `@capacitor/haptics`) to provide soft, OS-native haptic feedback for selected micro-interactions using a minimal, intent-based API. The Android haptics API SHALL expose at least a light impact feedback for primary confirmations and a selection feedback for lightweight option changes, and all haptic calls SHALL remain non-blocking when haptics are unavailable.

#### Scenario: Light impact feedback on primary tap interactions
- **GIVEN** the user is running nospeak inside the Android Capacitor app shell on a supported Android device
- **AND** the user performs a primary tap interaction that is configured to trigger light impact feedback (for example, sending a message or opening a conversation)
- **WHEN** the tap interaction is handled by the web client
- **THEN** the Android shell SHALL invoke the Capacitor Haptics plugin to trigger a light-impact haptic effect via the intent-based API
- **AND** the haptic call SHALL be non-blocking and SHALL NOT prevent the underlying navigation or action from completing if the plugin is unavailable or fails.

#### Scenario: Selection feedback on lightweight option changes
- **GIVEN** the user is running nospeak inside the Android Capacitor app shell on a supported Android device
- **AND** the user changes a lightweight selection that is configured to trigger selection feedback (for example, changing tabs, toggling a setting, or selecting a contact in a list)
- **WHEN** the selection interaction is handled by the web client
- **THEN** the Android shell SHALL invoke the Capacitor Haptics plugin to trigger a subtle selection haptic effect via the intent-based API
- **AND** the haptic call SHALL be non-blocking and SHALL NOT prevent the underlying selection or navigation from completing if the plugin is unavailable or fails.

#### Scenario: Web behavior remains unchanged outside Android shell for haptics
- **GIVEN** the user is accessing nospeak via a standard web browser rather than the Android Capacitor app shell
- **WHEN** the user performs the same interactions that would normally trigger Android haptics (such as contact selection or chat navigation)
- **THEN** the system SHALL NOT require the Capacitor Haptics plugin to be present
- **AND** the absence of haptic feedback SHALL NOT block or degrade the primary interaction behavior, which SHALL continue to follow the existing messaging and visual-design requirements.
