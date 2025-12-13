## ADDED Requirements
### Requirement: Contact QR Scanning on Camera-Capable Browsers
The system SHALL allow users to scan contact QR codes using the device camera from the contact list header in any environment where browser camera access is available. The Scan Contact QR trigger SHALL be visible whenever the runtime environment exposes a functional getUserMedia camera API, including the Android app shell, mobile web/PWA, and desktop browsers with webcams. QR decoding SHALL continue to interpret nostr: and npub1 payloads to extract a contact npub before opening the add-contact flow.

#### Scenario: Scan contact QR in Android app
- **GIVEN** the user is running nospeak inside the Android Capacitor app shell
- **AND** the device camera is available and permission has been granted
- **WHEN** the user taps the Scan Contact QR button in the contact list header
- **THEN** a camera preview modal opens and scans for QR codes
- **AND** when a QR containing a valid nostr npub is detected, the system opens the contact-from-QR result view pre-populated with that npub.

#### Scenario: Scan contact QR in mobile web or PWA
- **GIVEN** the user is accessing nospeak in a mobile browser or installed PWA on a device whose browser exposes navigator.mediaDevices.getUserMedia for the camera
- **AND** the user has granted camera permission to nospeak
- **WHEN** the user taps the Scan Contact QR button in the contact list header
- **THEN** a camera preview modal opens and scans for QR codes using the rear or environment-facing camera when available
- **AND** when a QR containing a valid nostr npub is detected, the system opens the contact-from-QR result view pre-populated with that npub.

#### Scenario: Scan contact QR in desktop browser with webcam
- **GIVEN** the user is accessing nospeak in a desktop browser that exposes navigator.mediaDevices.getUserMedia and has at least one usable camera or webcam
- **AND** the browser has granted camera permission to nospeak
- **WHEN** the user clicks the Scan Contact QR button in the contact list header
- **THEN** a camera preview modal opens and scans for QR codes using an available camera
- **AND** when a QR containing a valid nostr npub is detected, the system opens the contact-from-QR result view pre-populated with that npub.

#### Scenario: No camera or permission available for scanning
- **GIVEN** the user is accessing nospeak in an environment where navigator.mediaDevices.getUserMedia is not available, no camera devices are present, or camera access is denied
- **WHEN** the contact list view is rendered
- **THEN** the Scan Contact QR trigger SHALL NOT be shown in the header
- **OR** if shown due to partial capability detection, activating it SHALL result in a non-blocking camera-error state in the scanning modal without crashing the application.
