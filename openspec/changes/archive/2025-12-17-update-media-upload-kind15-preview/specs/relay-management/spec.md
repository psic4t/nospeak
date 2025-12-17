## ADDED Requirements
### Requirement: Temporary Messaging Relays and Retry Behavior
The messaging stack SHALL manage temporary relay connections used for sending NIP-17 direct messages in a way that avoids silently dropping events sent in quick succession (such as a Kind 15 file message followed immediately by a Kind 14 caption message).

#### Scenario: Temporary messaging relays stay alive long enough for queued DMs
- **GIVEN** the messaging service opens one or more temporary relay connections to send encrypted gift-wrap events (kind 1059) for a NIP-17 conversation
- **WHEN** multiple gift-wrap events are enqueued for the same conversation within a short time window (for example, a Kind 15 file message followed immediately by a Kind 14 caption reply)
- **THEN** those temporary relay connections SHALL remain managed and eligible for publish attempts by the retry queue for at least 15 seconds after the first event is enqueued
- **AND** the retry queue SHALL be allowed to perform its normal retry/backoff behavior for each enqueued event before any associated temporary relay connection is torn down.

#### Scenario: Retry queue does not silently drop DMs due to early relay cleanup
- **GIVEN** an encrypted gift-wrap event (kind 1059) for a NIP-17 conversation has been enqueued to the retry queue for delivery to a particular relay
- **WHEN** the underlying relay connection is cleaned up as a temporary connection
- **THEN** the retry queue SHALL NOT immediately drop the pending event solely because the relay is no longer managed
- **AND** instead SHALL either keep the event until its retry limit is exhausted while the connection lifecycle honors the minimum 15 second window, or re-establish a temporary connection for that relay according to relay-management policies.
