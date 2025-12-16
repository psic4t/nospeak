## MODIFIED Requirements
### Requirement: Login Screen Local Keypair Generator
The unauthenticated login screen SHALL provide a locally generated Nostr keypair option in addition to existing login methods (Amber, which on Android uses a NIP-55-compatible external signer when running inside the Android app shell, NIP-07 extension when available, and manual `nsec` entry). The keypair generator flow SHALL be accessible via a small link under the local `nsec` login control, SHALL open a dedicated modal that displays the newly generated `npub` and `nsec`, and SHALL offer controls to regenerate and to log in using the currently displayed secret key. Key generation SHALL occur entirely on the client using a standard Nostr keypair format, and the generated keys SHALL NOT be persisted by the keypair UI itself until or unless the user explicitly chooses to log in with them.

#### Scenario: User opens keypair generator from login screen
- **GIVEN** the unauthenticated login screen is visible with options for Amber (which, when running inside the Android app shell, uses a NIP-55-compatible external signer), NIP-07 extension (when available), and manual `nsec` entry
- **WHEN** the user clicks the "Generate new keypair" link under the local `nsec` login section
- **THEN** a glass-style modal appears over the login background
- **AND** the modal displays a newly generated Nostr keypair where the `npub` and `nsec` are shown as bech32-encoded strings.

#### Scenario: User regenerates keypair in modal
- **GIVEN** the keypair generator modal is open and displaying a keypair
- **WHEN** the user clicks the recycle-style generate-again control
- **THEN** the system discards the previous keypair from the modal state
- **AND** generates and displays a new `npub`/`nsec` pair in the same modal without requiring the user to close and reopen it.

#### Scenario: User logs in using generated keypair
- **GIVEN** the keypair generator modal is open and displaying a generated keypair
- **WHEN** the user clicks the primary action button labeled "Use this keypair and login"
- **THEN** the system logs the user in using the currently displayed `nsec` via the existing local `nsec` login flow
- **AND** the resulting authenticated session behavior (including navigation to `/chat`, relay initialization, and first-time sync flows) SHALL match the behavior of a successful manual `nsec` login
- **AND** the underlying auth implementation MAY persist the `nsec` to local storage according to existing local login semantics, but the keypair generator modal itself SHALL NOT add any additional persistence beyond invoking the login action.
