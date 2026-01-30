## ADDED Requirements

### Requirement: Auto-Set Default Relays for Existing Users

When a user with existing profile metadata (username) but no configured messaging relays logs in or returns to the app, the system SHALL automatically configure the default messaging relays and notify the user via a non-blocking toast notification. This ensures existing users can send and receive messages without requiring manual relay configuration.

#### Scenario: Existing user without relays gets auto-configured on login
- **GIVEN** the user successfully logs into nospeak and the ordered login history/sync flow has completed
- **AND** the cached profile for the current user has no configured messaging relays
- **AND** the profile metadata contains a `name`, `display_name`, or `nip05` value (i.e., the user has a username)
- **WHEN** the empty profile check runs after login flow completion
- **THEN** the system SHALL automatically configure the default messaging relays (deployment-configurable; defaults: `wss://nostr.data.haus`, `wss://nos.lol`, `wss://relay.damus.io`)
- **AND** the system SHALL publish a NIP-17 messaging relay list (kind 10050 with `relay` tags) to all known relays including the blaster relay
- **AND** the system SHALL display a non-blocking toast notification informing the user that messaging relays have been configured
- **AND** the toast message SHALL indicate that the user can change the relays in Settings

#### Scenario: Existing user without relays gets auto-configured on app resume
- **GIVEN** the user is logged into nospeak
- **AND** the app returns from background (visibility changes to visible)
- **AND** the cached profile for the current user has no configured messaging relays
- **AND** the profile metadata contains a username-like value
- **WHEN** the visibility change handler runs
- **THEN** the system SHALL automatically configure the default messaging relays
- **AND** the system SHALL display the same toast notification as the login scenario

#### Scenario: Auto-relay notification is shown only once per session
- **GIVEN** the user has been auto-configured with default relays in the current session
- **WHEN** any subsequent check for missing relays occurs (login retry, app resume, etc.)
- **THEN** the system SHALL NOT display an additional toast notification
- **AND** the system SHALL NOT attempt to re-publish the relay list

#### Scenario: Auto-relay check does not affect new users
- **GIVEN** the user logs into nospeak
- **AND** the cached profile has no configured messaging relays
- **AND** the profile metadata does not contain a `name`, `display_name`, or `nip05` value
- **WHEN** the empty profile check runs
- **THEN** the system SHALL display the EmptyProfileModal as per the existing requirement
- **AND** the system SHALL NOT auto-configure relays or display a toast
