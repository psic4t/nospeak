## MODIFIED Requirements

### Requirement: ICE Server Configuration
The system SHALL load ICE server configuration (STUN and TURN servers, with optional credentials) from runtime configuration at call setup. ICE servers SHALL be configurable via the runtime configuration mechanism so deployments can supply their own STUN/TURN infrastructure without rebuilding the client. The runtime-config defaults SHALL include at least one STUN entry and SHALL include a TURN entry whose `urls` field is an array enumerating both UDP (`transport=udp`) and TCP (`transport=tcp`) transport variants on the same TURN server and port, so clients on networks that filter UDP can still allocate a relay candidate over TCP. TURN credentials (`username` and `credential`) SHALL be present on every TURN entry in the defaults.

#### Scenario: Peer connection uses configured ICE servers
- **WHEN** the system constructs a new `RTCPeerConnection` for a call
- **THEN** the configuration SHALL include the ICE servers returned by the runtime configuration getter
- **AND** each ICE server entry SHALL include `urls` and (where present) `username` and `credential`

#### Scenario: Default iceServers include plain TURN over UDP and TCP
- **GIVEN** the runtime configuration has not been overridden by environment variable or injected config
- **WHEN** the system reads `iceServers` from the runtime-config defaults
- **THEN** the list SHALL include at least one STUN entry
- **AND** the list SHALL include a TURN entry whose `urls` field is an array containing both `turn:turn.data.haus:3478?transport=udp` and `turn:turn.data.haus:3478?transport=tcp`
- **AND** that TURN entry SHALL carry a `username` and a `credential`

#### Scenario: Peer connection fans out an array urls entry to multiple ICE servers
- **GIVEN** a TURN entry whose `urls` field is a 2-element array of `transport=udp` and `transport=tcp` URLs
- **WHEN** the system constructs an `RTCPeerConnection` or the Android FGS builds the `PeerConnection.RTCConfiguration`
- **THEN** the resulting peer connection SHALL be configured with both transport variants as candidate sources
- **AND** the `username` and `credential` from the source entry SHALL be applied to both transport variants
