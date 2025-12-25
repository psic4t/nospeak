## ADDED Requirements



### Requirement: Android Location Permissions and GPS Access
The Android Capacitor app shell SHALL request `ACCESS_FINE_LOCATION` and `ACCESS_COARSE_LOCATION` permissions from the user via the runtime permission model when accessing GPS coordinates for location sharing. The app SHALL register these permissions in `AndroidManifest.xml` and SHALL handle permission denial gracefully without crashing.

#### Scenario: AndroidManifest declares location permissions
- **GIVEN** the Android application is being built
- **WHEN** the `AndroidManifest.xml` is processed
- **THEN** the manifest SHALL declare `uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"`
- **AND** the manifest SHALL declare `uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"`

#### Scenario: Runtime permission request on location share
- **GIVEN** a user is running nospeak inside the Android Capacitor app shell
- **AND** the user has not previously granted location permissions
- **WHEN** the user taps the location share button
- **THEN** the app SHALL request `ACCESS_FINE_LOCATION` permission via the Android runtime permission model
- **AND** the OS SHALL show a permission dialog to the user
- **AND** upon grant, the app SHALL proceed to fetch GPS coordinates
- **AND** if the user denies, the app SHALL display an error dialog and NOT send the location message

#### Scenario: Geolocation plugin uses granted permissions
- **GIVEN** a user has previously granted location permissions
- **WHEN** the user taps the location share button
- **THEN** the AndroidLocation plugin SHALL access GPS coordinates without prompting
- **AND** the plugin SHALL use fine-grained location when available
- **AND** the location data SHALL be returned successfully to the web layer

#### Scenario: Permission denial handled gracefully
- **GIVEN** a user denies location permission when prompted
- **WHEN** the location share action fails
- **THEN** the app SHALL display an in-app or native dialog error message
- **AND** the app SHALL remain functional for non-location features
- **AND** the user SHALL be able to retry location sharing
