## ADDED Requirements
### Requirement: Android Back and Swipe Integration with Chat Shell
The Android Capacitor app shell SHALL integrate the Android system back action (including both hardware back button presses and OS-level back swipe gestures) with the nospeak chat shell so that back behaves consistently with Android UX expectations. When running inside the Android app shell, the system back action SHALL first dismiss full-screen overlays and global modals layered over the chat UI before performing route-level navigation or exiting the app.

#### Scenario: Android back closes global overlays before navigation
- **GIVEN** the user is running nospeak inside the Android Capacitor app shell
- **AND** a full-screen overlay such as the in-app image viewer is currently visible above the chat UI
- **WHEN** the user triggers the Android system back action (via hardware back button or OS back swipe)
- **THEN** the overlay SHALL be dismissed
- **AND** the underlying chat or contact list view SHALL remain visible
- **AND** no route-level navigation or app exit SHALL occur from this back action.

#### Scenario: Android back closes global modals before navigation
- **GIVEN** the user is running nospeak inside the Android Capacitor app shell
- **AND** a global modal such as Settings or Manage Contacts is currently open above the main chat or contact list interface
- **WHEN** the user triggers the Android system back action
- **THEN** the modal SHALL be closed
- **AND** the user SHALL remain on the same underlying screen (for example, the current chat conversation or the contact list)
- **AND** no additional navigation or app exit SHALL occur from this back action.

#### Scenario: Android back integrates with route-level navigation and app exit
- **GIVEN** the user is running nospeak inside the Android Capacitor app shell
- **AND** no full-screen overlays or global modals are currently open above the main UI
- **WHEN** the user triggers the Android system back action
- **THEN** the app shell SHALL delegate back handling to the web client according to the messaging and settings specifications (including navigation from chat detail to contact list when applicable)
- **AND** if the web client indicates there is no further in-app navigation possible (for example, at the root of the history stack)
- **THEN** the Android app shell MAY exit the application using the standard Android back semantics.
