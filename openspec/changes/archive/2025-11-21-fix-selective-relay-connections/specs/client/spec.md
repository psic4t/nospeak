# client Specification

## Purpose
Defines the client behavior for selective relay connections, ensuring only user's read relays are persistently connected while using temporary connections for message delivery.

## ADDED Requirements

### Requirement: Selective Startup Connections
The client SHALL only connect to the user's cached read relays at startup, using discovery relays only as fallback when user relays are not cached.

#### Scenario: Startup with cached user read relays
- **GIVEN** the client is starting up
- **AND** the user's read relays are cached
- **WHEN** `Connect()` is called
- **THEN** the client SHALL connect only to the user's cached read relays
- **THEN** the client SHALL NOT connect to discovery relays
- **THEN** the client SHALL NOT connect to any contact relays

#### Scenario: Startup without cached user read relays
- **GIVEN** the client is starting up
- **AND** the user's read relays are not cached
- **WHEN** `Connect()` is called
- **THEN** the client SHALL connect to discovery relays as fallback
- **THEN** the client SHALL attempt to discover and cache the user's read relays
- **THEN** the client SHALL switch to user's read relays once discovered

#### Scenario: Persistent connection management
- **GIVEN** the client is running
- **WHEN** user's read relays are available
- **THEN** the client SHALL maintain persistent connections only to user's read relays
- **THEN** the client SHALL automatically reconnect to user's read relays if connections are lost

### Requirement: Temporary Message Delivery Connections
The client SHALL use temporary connections for contacting recipient's read relays during message sending without adding them to persistent management.

#### Scenario: Sending message to contact
- **GIVEN** the user wants to send a message to a contact
- **WHEN** `SendChatMessage()` is called
- **THEN** the client SHALL send the message to user's persistent read relays
- **THEN** the client SHALL establish temporary connections to contact's read relays
- **THEN** the client SHALL send the message to contact's read relays
- **THEN** the client SHALL clean up temporary connections after message delivery

#### Scenario: Temporary connection failure handling
- **GIVEN** temporary connection to contact's relay fails
- **WHEN** message sending is attempted
- **THEN** the client SHALL continue with available temporary connections
- **THEN** the client SHALL log the failure for debugging
- **THEN** the client SHALL NOT add failed relays to persistent management

#### Scenario: Cleanup of temporary connections
- **GIVEN** message delivery is complete (successful or failed)
- **WHEN** cleanup is performed
- **THEN** the client SHALL close all temporary connections
- **THEN** the client SHALL remove temporary relays from connection tracking
- **THEN** the client SHALL preserve persistent connections to user's read relays

### Requirement: Connection Type Distinction
The ConnectionManager SHALL distinguish between persistent and temporary relay connections with appropriate lifecycle management.

#### Scenario: Adding persistent connections
- **GIVEN** a user's read relay needs to be connected
- **WHEN** `AddPersistentRelay()` is called
- **THEN** the relay SHALL be added to persistent management
- **THEN** the relay SHALL be included in automatic reconnection logic
- **THEN** the relay SHALL be monitored for health statistics

#### Scenario: Adding temporary connections
- **GIVEN** a contact's read relay needs temporary connection
- **WHEN** `AddTemporaryRelay()` is called
- **THEN** the relay SHALL be connected for immediate use
- **THEN** the relay SHALL NOT be included in automatic reconnection logic
- **THEN** the relay SHALL be excluded from persistent health monitoring

#### Scenario: Connection status reporting
- **GIVEN** the TUI requests connection status
- **WHEN** `GetConnectionStats()` is called
- **THEN** the stats SHALL distinguish between persistent and temporary connections
- **THEN** persistent connections SHALL be prominently displayed
- **THEN** temporary connections SHALL be marked as temporary

### Requirement: Relay Discovery and Caching Integration
The client SHALL integrate relay discovery with selective connection logic, ensuring proper caching and fallback behavior.

#### Scenario: User relay discovery
- **GIVEN** the user's read relays are not cached
- **WHEN** discovery is performed during startup
- **THEN** the client SHALL use discovery relays temporarily
- **THEN** the client SHALL discover the user's read relays
- **THEN** the client SHALL cache the user's read relays
- **THEN** the client SHALL switch to persistent connections with user's read relays

#### Scenario: Contact relay discovery for messaging
- **GIVEN** a message needs to be sent to a contact
- **WHEN** contact's read relays are not cached
- **THEN** the client SHALL discover contact's read relays using persistent connections
- **THEN** the client SHALL cache the discovered relays for future use
- **THEN** the client SHALL use temporary connections for message delivery

#### Scenario: Cache invalidation and refresh
- **GIVEN** cached relay information is expired
- **WHEN** relay information is accessed
- **THEN** the client SHALL detect the expiration
- **THEN** the client SHALL refresh the relay information
- **THEN** the client SHALL update the cache with new information