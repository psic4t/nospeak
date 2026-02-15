## ADDED Requirements

### Requirement: On-Visit Contact Relay Discovery and Profile Refresh
When the user navigates to a 1:1 chat, the system SHALL run relay discovery and profile resolution for the chat partner in the background. This SHALL call `discoverUserRelays(npub, false)` which performs relay discovery (connecting to discovery relays temporarily) and profile resolution (fetching Kind 0, 10050, 10002, 10063 events) in a single operation. The refresh SHALL always fetch from the network regardless of cache TTL. After the refresh completes, the system SHALL dispatch a `nospeak:profiles-updated` event so the UI re-reads updated profile data from IndexedDB.

#### Scenario: Profile and relay data refreshed on 1:1 chat visit
- **GIVEN** the user is authenticated and navigates to a 1:1 chat with contact Alice
- **WHEN** the chat page loads
- **THEN** the system SHALL call `discoverUserRelays(aliceNpub, false)` in the background
- **AND** discovery relays SHALL be connected temporarily, profile data fetched, and discovery relays cleaned up
- **AND** a `nospeak:profiles-updated` event SHALL be dispatched after completion

#### Scenario: UI updates gradually after profile refresh
- **GIVEN** the user is viewing a 1:1 chat with contact Alice
- **AND** Alice has changed her display name from "Alice" to "Alice W." on relays
- **WHEN** the background profile refresh completes and dispatches `nospeak:profiles-updated`
- **THEN** the chat header SHALL re-read Alice's profile from IndexedDB
- **AND** the displayed name SHALL update from "Alice" to "Alice W." without a full page reload

#### Scenario: Profile picture updates after refresh
- **GIVEN** the user is viewing a 1:1 chat with contact Bob
- **AND** Bob has updated his profile picture on relays
- **WHEN** the background profile refresh completes
- **THEN** the chat header avatar SHALL update to show Bob's new profile picture

### Requirement: On-Visit Group Chat Participant Refresh
When the user navigates to a group chat, the system SHALL run relay discovery and profile resolution for all participants in the group (excluding the current user). Participants SHALL be refreshed in batches with inter-batch delays to avoid overwhelming relays. The system SHALL dispatch `nospeak:profiles-updated` after each batch completes so the UI updates gradually as participant data arrives.

#### Scenario: All group participants refreshed on group chat visit
- **GIVEN** the user navigates to a group chat with participants Alice, Bob, and Carol
- **WHEN** the chat page loads and the group conversation metadata is available
- **THEN** the system SHALL call `discoverUserRelays()` for Alice, Bob, and Carol (excluding the current user)
- **AND** participants SHALL be processed in batches with delays between batches
- **AND** a `nospeak:profiles-updated` event SHALL be dispatched after each batch completes

#### Scenario: Group participant names update gradually
- **GIVEN** the user is viewing a group chat with 6 participants
- **AND** 2 participants have updated their display names on relays
- **WHEN** the background batch refresh processes each batch and dispatches events
- **THEN** the participant names in message attribution and the chat header SHALL update incrementally as each batch completes
- **AND** the user SHALL NOT see all names change simultaneously at the end

#### Scenario: Group chat profiles in chat header re-read on profiles-updated event
- **GIVEN** the user is viewing a group chat
- **WHEN** a `nospeak:profiles-updated` event is dispatched
- **THEN** the ChatView SHALL re-read participant profiles from IndexedDB
- **AND** the `participantProfiles` map SHALL be updated with fresh names and pictures

### Requirement: In-Flight Deduplication
The system SHALL prevent duplicate concurrent relay discovery requests for the same contact. If a refresh for a given npub is already in progress, subsequent requests for that npub SHALL be skipped until the in-flight request completes. Once complete, the next visit SHALL always trigger a fresh refresh.

#### Scenario: Concurrent requests deduplicated
- **GIVEN** a relay discovery request is in progress for Alice
- **WHEN** the user navigates away and back to Alice's chat before the request completes
- **THEN** the system SHALL NOT start a second concurrent relay discovery for Alice

#### Scenario: Completed requests allow fresh refresh
- **GIVEN** a relay discovery request for Alice completed previously
- **WHEN** the user returns to Alice's chat
- **THEN** the system SHALL trigger a fresh relay discovery and profile refresh for Alice

### Requirement: Removal of Bulk Startup Contact Refresh
The system SHALL NOT perform a bulk relay discovery and profile refresh for all contacts on app startup. The 5-second delayed `setTimeout` in the root layout that iterates through all contacts SHALL be removed. The current user's own relay discovery at startup SHALL be preserved with a reduced delay.

#### Scenario: No bulk contact refresh on app reload
- **GIVEN** the user has 50 contacts
- **WHEN** the app reloads and authentication is restored
- **THEN** the system SHALL NOT initiate relay discovery or profile resolution for any contacts
- **AND** no "Refreshing profiles for N contacts" log message SHALL appear

#### Scenario: Current user relay discovery preserved at startup
- **GIVEN** the user reloads the app and authentication is restored
- **AND** the current user's cached profile has expired
- **WHEN** the startup sequence runs
- **THEN** the system SHALL call `discoverUserRelays(currentUserNpub, true)` to set up persistent messaging relay connections
- **AND** the profile refresh banner SHALL be shown during this process

#### Scenario: Startup delay reduced
- **GIVEN** the user reloads the app
- **WHEN** the startup sequence initiates the current user's relay discovery
- **THEN** the delay before initiating the refresh SHALL be approximately 2 seconds (reduced from 5 seconds)
