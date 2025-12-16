## ADDED Requirements
### Requirement: Android Amber Signer via NIP-55
When running inside the Android Capacitor app shell, the nospeak client SHALL integrate with NIP-55-compatible Android signer applications (such as Amber) to perform authentication and cryptographic operations for the "Login with Amber" flow. The Android app shell SHALL use the `nostrsigner:` Intent scheme described in NIP-55 to request the user's public key and initial permissions, SHALL persist the selected signer package name, and SHALL perform subsequent signing and encryption/decryption operations via the signer's NIP-55 ContentResolver endpoints when the signer has granted "remember my choice" for those permissions. The Android app shell SHALL NOT rely on relay-based NIP-46 / Nostr Connect sessions for Amber when running inside the app shell.

#### Scenario: Amber login uses NIP-55 intents on Android
- **GIVEN** the nospeak Android Capacitor app shell is installed on a supported device
- **AND** a NIP-55-compatible signer app such as Amber is installed
- **AND** the unauthenticated login screen is visible inside the Android app shell
- **WHEN** the user taps the "Login with Amber" button
- **THEN** the app SHALL launch the signer via a `nostrsigner:` Intent with `type = "get_public_key"` as described in NIP-55
- **AND** upon user approval, the app SHALL receive the user's public key and signer package name from the signer
- **AND** the app SHALL complete login for that key using the returned public key without establishing a NIP-46 / Nostr Connect session.

#### Scenario: Background signing prefers ContentResolver when permissions are remembered
- **GIVEN** the user previously completed Amber login in the Android app shell and granted "remember my choice" for signing and NIP-44 encryption/decryption operations
- **AND** the app has persisted the signer package name returned by the initial `get_public_key` call
- **WHEN** the nospeak Android app needs to sign an event or perform NIP-44 encryption or decryption on behalf of the current user while running inside the app shell
- **THEN** it SHALL first attempt to call the corresponding NIP-55 ContentResolver endpoint for the signer package (such as `SIGN_EVENT`, `NIP44_ENCRYPT`, or `NIP44_DECRYPT`)
- **AND** if the ContentResolver call returns a result without a `rejected` column, the app SHALL use that result without surfacing an additional signer UI
- **AND** if the ContentResolver call returns `null` or indicates `rejected`, the app MAY fall back to an interactive `nostrsigner:` Intent flow or surface a clear error according to the design of the NIP-55 plugin.

#### Scenario: NIP-46 is not used for Amber inside the Android app shell
- **GIVEN** the user is running nospeak inside the Android Capacitor app shell
- **AND** the current session uses Amber as an external signer for authentication and message signing
- **WHEN** the app performs login, signing, or encryption/decryption operations for this session
- **THEN** it SHALL use only the NIP-55 mechanisms (Intents and ContentResolver) to communicate with the signer
- **AND** it SHALL NOT construct `nostrconnect:` URIs, create bunker relay connections, or initiate NIP-46 / Nostr Connect sessions for Amber while running inside the Android app shell.
