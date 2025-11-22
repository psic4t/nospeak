# messaging Specification

## Purpose
Defines the messaging behavior for selective relay connections, ensuring messages are sent to both user's persistent relays and contact's temporary relays.

## ADDED Requirements

### Requirement: Dual Relay Message Publishing
The messaging system SHALL publish messages to both the user's persistent read relays and the contact's temporary read relays during message sending.

#### Scenario: Message publishing to dual relay sets
- **GIVEN** a user wants to send a message to a contact
- **WHEN** `SendChatMessage()` is called
- **THEN** the message SHALL be published to all user's persistent read relays
- **THEN** the message SHALL be published to all contact's temporary read relays
- **THEN** the publishing SHALL use appropriate retry logic for both relay sets

#### Scenario: Message publishing with relay failures
- **GIVEN** some relays in either set fail to publish
- **WHEN** publishing is attempted
- **THEN** successful relays SHALL be counted in the success count
- **THEN** failed relays SHALL be queued for retry according to their connection type
- **THEN** temporary relay failures SHALL not affect persistent relay operations

#### Scenario: Gift wrap creation for dual relay publishing
- **GIVEN** a message needs to be encrypted and wrapped
- **WHEN** creating the gift wrap
- **THEN** the gift wrap SHALL be suitable for publishing to both relay sets
- **THEN** the recipient information SHALL include contact's read relay information
- **THEN** the encryption SHALL use the contact's public key correctly

### Requirement: Temporary Relay Management for Messaging
The messaging system SHALL manage temporary relay connections specifically for message delivery without affecting persistent connection management.

#### Scenario: Establishing temporary connections
- **GIVEN** a contact's read relays need to be connected for messaging
- **WHEN** preparing to send a message
- **THEN** temporary connections SHALL be established to all contact's read relays
- **THEN** connection establishment SHALL have appropriate timeout
- **THEN** failed temporary connections SHALL be logged but not block messaging

#### Scenario: Publishing with temporary connections
- **GIVEN** temporary connections are established
- **WHEN** publishing the message
- **THEN** publishing SHALL use the temporary connections alongside persistent connections
- **THEN** publishing SHALL wait for both connection types to complete
- **THEN** success count SHALL include successful publishes from both connection types

#### Scenario: Cleanup after message delivery
- **GIVEN** message publishing is complete (success or failure)
- **WHEN** cleanup is performed
- **THEN** all temporary connections SHALL be closed
- **THEN** temporary relays SHALL be removed from active connection tracking
- **THEN** persistent connections SHALL remain unaffected

### Requirement: Fallback and Error Handling
The messaging system SHALL handle connection and publishing failures gracefully with appropriate fallback mechanisms.

#### Scenario: Contact relay discovery failure
- **GIVEN** contact's read relays cannot be discovered
- **WHEN** attempting to send a message
- **THEN** the system SHALL fall back to discovery relays for temporary connections
- **THEN** the message SHALL still be published to user's persistent relays
- **THEN** the fallback behavior SHALL be logged for debugging

#### Scenario: Temporary connection establishment failure
- **GIVEN** temporary connections to contact's relays fail
- **WHEN** message sending is attempted
- **THEN** the message SHALL still be published to user's persistent relays
- **THEN** the failure SHALL be logged with appropriate detail
- **THEN** the operation SHALL not fail completely due to temporary connection issues

#### Scenario: Mixed success and failure publishing
- **GIVEN** publishing succeeds on some relays and fails on others
- **WHEN** publishing completes
- **THEN** the success count SHALL accurately reflect successful publishes
- **THEN** failed relays SHALL be queued for retry according to their type
- **THEN** the method SHALL return appropriate success count and error information

### Requirement: Integration with Connection Manager
The messaging system SHALL integrate with the enhanced connection manager to support both persistent and temporary connection types.

#### Scenario: Coordinating with connection manager
- **GIVEN** the connection manager supports persistent and temporary connections
- **WHEN** sending a message
- **THEN** messaging SHALL use persistent connections for user's relays
- **THEN** messaging SHALL request temporary connections for contact's relays
- **THEN** messaging SHALL coordinate cleanup of temporary connections

#### Scenario: Retry queue integration
- **GIVEN** some message publishes fail and need retry
- **WHEN** retry queue processes failed publishes
- **THEN** persistent connection failures SHALL use standard retry logic
- **THEN** temporary connection failures SHALL not trigger persistent retries
- **THEN** retry attempts SHALL respect the connection type of each relay

#### Scenario: Status reporting integration
- **GIVEN** the messaging operation completes
- **WHEN** reporting status
- **THEN** the report SHALL distinguish between persistent and temporary relay results
- **THEN** the report SHALL provide detailed success/failure information
- **THEN** the report SHALL be suitable for UI display and debugging