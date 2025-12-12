## ADDED Requirements
### Requirement: Android Back Navigation from Chat Detail to Contact List
When running inside the Android Capacitor app shell on a mobile form factor, the messaging experience SHALL treat the Android system back action (hardware back or OS back swipe) from a chat detail view as a request to return to the contact list rather than exiting the app or navigating to an unrelated screen.

#### Scenario: Android back from chat detail returns to contact list
- **GIVEN** the user is running nospeak inside the Android Capacitor app shell on a mobile device
- **AND** the user is currently viewing a specific conversation at URL `/chat/<npub>`
- **AND** no full-screen overlays or global modals are open
- **WHEN** the user triggers the Android system back action (via hardware back or OS back swipe)
- **THEN** the application SHALL navigate to the contact list view at `/chat`
- **AND** the app SHALL NOT exit from this back action.

#### Scenario: Android back from contact list behaves like root navigation
- **GIVEN** the user is running nospeak inside the Android Capacitor app shell on a mobile device
- **AND** the user is currently viewing the contact list root at `/chat`
- **AND** no full-screen overlays or global modals are open
- **WHEN** the user triggers the Android system back action
- **THEN** the application SHALL treat this as a root-level back navigation consistent with Android expectations (for example, delegating to browser history or exiting the app when no further in-app history is available)
- **AND** the behavior SHALL remain compatible with the existing Startup Navigation requirements for desktop and mobile.
