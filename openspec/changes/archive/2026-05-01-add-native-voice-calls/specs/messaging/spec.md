## ADDED Requirements

### Requirement: Native NIP-AC Inner-Event Schnorr Verification
On Android, the native background messaging service SHALL verify the BIP-340 Schnorr signature of decrypted NIP-AC inner events (kinds 25050, 25051, 25052, 25053, 25054) before dispatching them to any handler. Verification SHALL use BouncyCastle (already a project dependency for `schnorrSign`). Events whose signature does not verify SHALL be silently dropped with a logged failure.

#### Scenario: Valid signature dispatched to handler
- **GIVEN** a decrypted NIP-AC inner event with a valid BIP-340 signature
- **WHEN** the native background messaging service inspects the event
- **THEN** the system SHALL pass verification
- **AND** the system SHALL dispatch the event to the appropriate handler (offer persistence, native call manager dispatch, etc.)

#### Scenario: Invalid signature dropped silently
- **GIVEN** a decrypted NIP-AC inner event whose BIP-340 signature does not verify against its event id and pubkey
- **WHEN** the native background messaging service inspects the event
- **THEN** the system SHALL log the verification failure with sufficient context for diagnosis
- **AND** the system SHALL NOT dispatch the event to any handler
- **AND** the system SHALL NOT persist any pending state for the event
- **AND** the system SHALL NOT post any notification

### Requirement: Native NIP-AC Inbound Dispatch Beyond Offers
On Android, the native background messaging service SHALL dispatch decrypted NIP-AC inner-event kinds 25051 (answer), 25052 (ICE), 25053 (hangup), and 25054 (reject) to the in-process `NativeVoiceCallManager` (when one is hosting a call) rather than dropping them. Kind 25050 (offer) continues to be persisted to SharedPreferences and trigger the full-screen-intent notification as before. The JavaScript-layer NIP-AC dispatch in `Messaging.ts` SHALL be skipped on Android for all NIP-AC inner kinds.

#### Scenario: Answer dispatched natively
- **GIVEN** the user has an outgoing call in `outgoing-ringing` on Android
- **WHEN** a kind-21059 gift wrap is decrypted to an inner event of kind 25051 for the active call
- **THEN** the native background messaging service SHALL invoke `NativeVoiceCallManager.handleAnswer` with the SDP
- **AND** the JavaScript layer SHALL NOT also process the same answer

#### Scenario: ICE dispatched natively
- **WHEN** a kind-21059 gift wrap is decrypted to an inner event of kind 25052 on Android
- **THEN** the native background messaging service SHALL invoke `NativeVoiceCallManager.handleIceCandidate` with the candidate, sdpMid, and sdpMLineIndex

#### Scenario: Hangup dispatched natively
- **WHEN** a kind-21059 gift wrap is decrypted to an inner event of kind 25053 on Android
- **THEN** the native background messaging service SHALL invoke `NativeVoiceCallManager.handleHangup` with the reason

#### Scenario: JS dispatch is skipped for all NIP-AC kinds on Android
- **GIVEN** the runtime platform is Android
- **WHEN** the live JavaScript subscription receives a kind-21059 gift wrap whose inner kind is in {25050, 25051, 25052, 25053, 25054}
- **THEN** `Messaging.ts` SHALL skip dispatching the inner event to any voice-call handler in the JavaScript runtime
- **AND** no duplicate state transitions SHALL occur

### Requirement: Native NIP-AC Outbound Senders for All Signal Kinds
On Android, the native background messaging service SHALL provide outbound senders for NIP-AC inner-event kinds 25050 (offer), 25051 (answer), 25052 (ICE), and 25053 (hangup), in addition to the existing kind-25054 (reject) sender. Each sender SHALL produce gift wraps that are byte-equivalent to the JavaScript senders in `Messaging.ts` for the same logical input, preserving NIP-AC wire compatibility. Each sender SHALL preserve the existing self-wrap behavior so multi-device "answered/rejected/hung-up elsewhere" works for every kind.

#### Scenario: All NIP-AC sender kinds available natively
- **GIVEN** the runtime platform is Android
- **WHEN** the native call manager needs to publish a NIP-AC signal of any kind in {25050, 25051, 25052, 25053, 25054}
- **THEN** the corresponding native helper (`sendVoiceCallOffer`, `sendVoiceCallAnswer`, `sendVoiceCallIce`, `sendVoiceCallHangup`, or the existing `sendVoiceCallReject`) SHALL be available

#### Scenario: Self-wrap behavior for all native NIP-AC senders
- **WHEN** any of the native NIP-AC senders publishes a gift wrap to a recipient
- **THEN** the system SHALL also publish a self-wrap copy addressed to the user's own pubkey using the user's NIP-17 messaging relays
- **AND** other devices logged in to the same account SHALL receive the self-wrap and update their state accordingly
