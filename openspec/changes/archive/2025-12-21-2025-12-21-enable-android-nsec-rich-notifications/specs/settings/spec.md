## MODIFIED Requirements

### Requirement: Android Background Messaging Preference
The Settings interface SHALL provide an Android-only background messaging preference under Settings → General that controls whether the Android app is allowed to keep relay connections and message subscriptions active while the app UI is not visible.

This preference SHALL be stored per Android installation and SHALL be independent from, but compatible with, the existing message notifications toggle. The preference persistence mechanism SHALL survive device restarts and app updates and SHALL be readable by Android-native components (for example, boot receivers) without requiring the WebView to start.

When the current session is a local-key (nsec) session and the Android-native secret key required for background decryption is missing, the system SHALL disable background messaging for that installation rather than keeping the service running in a degraded state.

#### Scenario: Background messaging auto-disables when local secret is missing
- **GIVEN** the user previously enabled Android background messaging in Settings → General
- **AND** the current session is a local-key (nsec) session
- **AND** the Android-native secret key required for local-key background decryption is missing
- **WHEN** the Android shell attempts to start or restore background messaging (including on boot)
- **THEN** the system SHALL persistently disable the background messaging preference for that installation
- **AND** the native foreground service SHALL stop
- **AND** the user MUST re-login before background messaging can be enabled again.
