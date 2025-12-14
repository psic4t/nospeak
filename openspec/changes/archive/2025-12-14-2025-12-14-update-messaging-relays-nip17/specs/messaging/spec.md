## MODIFIED Requirements

### Requirement: Startup Relay Initialization and Profile Refresh
The system SHALL initialize relay connections for returning authenticated users using cached relay configuration when available, and SHALL refresh the current user's profile and relay configuration in the background when the cached profile has expired. Relay discovery for messaging relays SHALL prefer NIP-17 kind 10050 "messaging relay" lists for the current user and contacts, and MAY fall back to NIP-65 kind 10002 mailbox relay lists only when no kind 10050 list exists for a given profile.

#### Scenario: Returning user uses cached messaging relays
- **GIVEN** the user is already authenticated
- **AND** a cached profile for the user exists with at least one relay URL in its messaging relay configuration (derived from either kind 10050 or 10002)
- **WHEN** the application restores the session on startup
- **THEN** it connects to the cached messaging relays without performing full relay discovery
- **AND** the main chat interface becomes usable without waiting for relay discovery to complete

#### Scenario: First-time or missing messaging relays still trigger discovery
- **GIVEN** the user is already authenticated
- **AND** no cached profile with messaging relay information exists for the user
- **WHEN** the application restores the session on startup
- **THEN** it performs relay discovery for the user, first attempting to fetch kind 10050 messaging relay events and only falling back to kind 10002 mailbox relay events when no kind 10050 list is found
- **AND** uses the discovered messaging relays for subsequent cached startups

#### Scenario: Background refresh on expired profile prefers NIP-17 messaging relays
- **GIVEN** the user is authenticated and the application has finished initial startup
- **AND** a cached profile exists for the user whose TTL has expired
- **WHEN** the delayed background refresh runs after startup
- **THEN** the system performs relay discovery for the user without blocking the UI
- **AND** it prefers kind 10050 messaging relay lists when updating the cached configuration, only using kind 10002 lists when no messaging relay list is published for that profile.

### Requirement: Post-login Empty Profile Setup Modal
After a successful login and completion of the ordered login history flow, the messaging experience SHALL display a blocking setup modal whenever the current user's profile has no configured messaging relays and no username-like metadata. The modal SHALL explain that at least one messaging relay and a basic profile identifier are required for a usable experience, SHALL pre-populate a small default set of messaging relays for the user (`wss://nostr.data.haus`, `wss://nos.lol`, `wss://relay.damus.io`) that can be edited later in Settings, and SHALL require the user to provide a simple name that is saved into their profile metadata and published to the network. The modal MAY offer a secondary dismiss action while still reappearing on future logins as long as the profile remains empty.

#### Scenario: Empty profile triggers messaging-relay setup modal on login
- **GIVEN** the user successfully logs into nospeak and the ordered login history/sync flow has completed
- **AND** the cached profile for the current user has no configured messaging relays (no kind 10050 list and no mailbox relay list translated into messaging relays)
- **AND** the profile metadata does not contain a `name`, `display_name`, or `nip05` value
- **WHEN** the main messaging UI becomes active
- **THEN** a blocking modal overlay SHALL be shown informing the user that messaging relays and profile information need to be configured for this key
- **AND** the modal SHALL explain that nospeak will configure the default messaging relays `wss://nostr.data.haus`, `wss://nos.lol`, and `wss://relay.damus.io` on their behalf, with the ability to change them later in Settings → Messaging Relays
- **AND** the modal SHALL require the user to enter a non-empty name before continuing
- **AND** upon confirmation, the client SHALL persist the default relays as the user's messaging relays, update the profile metadata with the provided name, and publish both a NIP-17 messaging relay list (kind 10050 with `relay` tags) and profile metadata (kind 0) to all known relays including the blaster relay
- **AND** the modal SHALL be shown again on subsequent logins while the profile continues to have no messaging relays and no username-like metadata (for example, if the user dismisses the modal or later removes all relays and name from their profile).

## ADDED Requirements

### Requirement: Messaging Relays Discovery and Fallback
The messaging implementation SHALL treat NIP-17 kind 10050 events with `relay` tags as the primary source of messaging relays for both the current user and contacts, and SHALL fall back to NIP-65 kind 10002 mailbox relay lists only when no kind 10050 list exists for a given profile.

#### Scenario: Contact messaging relays resolved from kind 10050
- **GIVEN** the client resolves a contact's profile from relays
- **AND** at least one kind 10050 event with one or more `relay` tags is found for that profile
- **WHEN** the messaging layer derives the contact's messaging relays
- **THEN** it SHALL treat the URLs from the `relay` tags as the contact's messaging relays
- **AND** it SHALL use these URLs when choosing where to publish gift-wrapped DMs to that contact.

#### Scenario: Contact messaging relays resolved from kind 10002 when no 10050 exists
- **GIVEN** the client resolves a contact's profile from relays
- **AND** no kind 10050 messaging relay list is found for that profile
- **AND** at least one kind 10002 mailbox relay list is found
- **WHEN** the messaging layer derives the contact's messaging relays
- **THEN** it MAY interpret the NIP-65 relay list and derive a messaging relay set from it (for example, by combining read/write URLs)
- **AND** it SHALL use these URLs as the contact's messaging relays for DM routing.

### Requirement: DM Sending Uses Messaging Relays
The DM sending pipeline for Kind 14 text rumors, Kind 15 file rumors, and Kind 7 reactions SHALL route gift-wrapped events using messaging relays derived from NIP-17 kind 10050 or fallback NIP-65 lists, sending each recipient and self copy only to the corresponding user's own messaging relays.

#### Scenario: Sending a DM routes recipient gift-wrap to contact messaging relays
- **GIVEN** the user composes a new encrypted DM (Kind 14 rumor wrapped in Kind 1059 gift-wrap)
- **AND** the messaging layer has resolved the contact's messaging relays
- **AND** the messaging layer has resolved the current user's own messaging relays
- **WHEN** the client publishes the recipient gift-wrap for this DM
- **THEN** it SHALL enqueue and publish that gift-wrap only to the contact's messaging relays
- **AND** it SHALL NOT publish the recipient gift-wrap to relays that belong exclusively to the current user.

#### Scenario: Sending a DM routes self gift-wrap to user messaging relays
- **GIVEN** the same DM as above
- **WHEN** the client creates and publishes the self gift-wrap for the current user
- **THEN** it SHALL enqueue and publish that self gift-wrap only to the current user's messaging relays
- **AND** it SHALL NOT publish the self gift-wrap to relays that belong exclusively to the contact.

#### Scenario: Sending a DM fails when contact has no messaging relays
- **GIVEN** the user attempts to send an encrypted DM to a contact
- **AND** relay discovery cannot find any messaging relays for that contact from either kind 10050 or kind 10002 events
- **WHEN** the messaging pipeline prepares to send the message
- **THEN** it SHALL fail the send attempt
- **AND** the UI SHALL surface a clear, non-crashing error state indicating that the contact has no messaging relays configured and cannot receive NIP-17 DMs.

### Requirement: Profile Modal Shows Unified Messaging Relays
The profile modal in the messaging experience SHALL display a single "Messaging Relays" section for each profile instead of separate "Read Relays" and "Write Relays" sections, using the union of known relay URLs for that profile.

#### Scenario: Profile modal shows unified messaging relay list
- **GIVEN** a profile has one or more relay URLs discovered from either kind 10050 or kind 10002 events
- **WHEN** the user opens the profile modal for that contact or for themselves
- **THEN** the modal SHALL display a single "Messaging Relays" heading
- **AND** SHALL render a deduplicated list of relay URLs under that heading
- **AND** if no relay URLs are known, it SHALL instead display the existing "None" state for relays.
