## ADDED Requirements
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
