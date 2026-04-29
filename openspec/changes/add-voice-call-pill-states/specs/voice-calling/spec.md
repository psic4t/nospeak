## MODIFIED Requirements

### Requirement: Call History via Kind 16 Events
The system SHALL persist call history as NIP-17 Kind 16 rumor events. Each call-event rumor SHALL include the following tags: `['p', <recipient-pubkey>]`, `['type', 'call-event']`, `['call-event-type', <type>]` where `<type>` is one of `missed`, `ended`, `no-answer`, `declined`, `busy`, `failed`, `cancelled`, and `['call-initiator', <initiator-pubkey>]`. The rumor MAY include a `['call-id', <callId>]` tag carrying the WebRTC call identifier; clients SHALL ignore unknown tags. When the call event represents a completed conversation that reached the `active` state, the rumor SHALL include a `['call-duration', <seconds>]` tag with the call duration in seconds. The rumor `content` SHALL be the empty string. Call events SHALL be saved to the local message database and rendered as system-style entries in the conversation timeline.

The `call-initiator` tag SHALL contain the pubkey of the **WebRTC call initiator** — the side that originally invoked `voiceCallService.initiateCall` for this call. This SHALL be the case regardless of which side authors the rumor. In particular:

| `call-event-type` | Author | `call-initiator` value |
|---|---|---|
| `ended` | hangup initiator (either side) | the original caller's pubkey |
| `missed` | callee | the caller's pubkey (NOT the rumor author) |
| `cancelled` | caller | the caller's pubkey (= rumor author) |
| `no-answer` | caller | the caller's pubkey (= rumor author) |
| `declined` | callee | the caller's pubkey (NOT the rumor author) |
| `busy` | caller | the caller's pubkey (= rumor author) |
| `failed` | caller | the caller's pubkey (= rumor author) |

The system SHALL author exactly one terminal call-event rumor per call from the side responsible for that outcome. The authoring side and the delivery mode are determined per type as follows:

| `call-event-type` | Authored by | Delivery |
|---|---|---|
| `ended` | The peer that calls hangup while `active` | Gift-wrapped to peer (NIP-17) and to self (NIP-59 self-wrap) |
| `missed` | The callee | Local-only — saved to local DB, NOT gift-wrapped or published |
| `cancelled` | The caller | Local-only — saved to local DB, NOT gift-wrapped or published |
| `no-answer` | The caller | Gift-wrapped to peer and to self |
| `declined` | The callee | Gift-wrapped to peer and to self |
| `busy` | The caller | Gift-wrapped to peer and to self |
| `failed` | The caller (only; callee SHALL NOT author) | Gift-wrapped to peer and to self |

For gift-wrapped types the peer receives the rumor through standard NIP-59 delivery and SHALL NOT author a duplicate locally. For local-only types the peer SHALL NOT receive any rumor for that outcome; this is intentional because each side observes a different reality (the caller observes "I cancelled it" while the callee observes "I missed it").

The renderer SHALL pick role-aware copy for asymmetric outcomes (`declined`, `busy`, `no-answer`) by comparing the rumor's `call-initiator` tag value to the local user's pubkey. When the local user is the call initiator, the renderer SHALL use the caller-side wording; otherwise the renderer SHALL use the callee-side wording. Symmetric outcomes (`ended`, `failed`) SHALL render the same wording regardless of role. Local-only outcomes (`missed`, `cancelled`) only ever appear on the authoring side, so role disambiguation is unnecessary.

#### Scenario: Ended-call event includes duration
- **GIVEN** a call between A and B was `active` for 47 seconds
- **WHEN** either party hangs up
- **THEN** a Kind 16 rumor SHALL be sent with tags including `['call-event-type', 'ended']` and `['call-duration', '47']`
- **AND** the rumor SHALL be persisted to the local message database
- **AND** the rumor SHALL be gift-wrapped to the peer
- **AND** the rumor SHALL be rendered as a centered system-style entry in the conversation on both sides

#### Scenario: Missed-call rumor is local-only on the callee
- **GIVEN** the user is `incoming-ringing` and the caller hangs up before the user accepts
- **WHEN** the system processes the caller's `hangup` signal
- **THEN** a Kind 16 rumor SHALL be persisted to the local message database with `['call-event-type', 'missed']` and no `call-duration` tag
- **AND** the rumor SHALL NOT be published to any relay
- **AND** the caller SHALL NOT receive this rumor

#### Scenario: Cancelled-call rumor is local-only on the caller
- **GIVEN** the local status is `outgoing-ringing`
- **WHEN** the user invokes hangup before any answer is received
- **THEN** a Kind 16 rumor SHALL be persisted to the local message database with `['call-event-type', 'cancelled']` and no `call-duration` tag
- **AND** the rumor SHALL NOT be published to any relay
- **AND** the callee SHALL NOT receive this rumor
- **AND** a `hangup` voice-call signal SHALL be sent to the callee
- **AND** the local status SHALL transition to `ended` with reason `hangup`

#### Scenario: Caller offer-timeout authors a no-answer event
- **GIVEN** the local status is `outgoing-ringing`
- **WHEN** the 60-second offer timeout fires without an `answer` signal arriving
- **THEN** a Kind 16 rumor SHALL be sent with `['call-event-type', 'no-answer']` and no `call-duration` tag
- **AND** the rumor SHALL be gift-wrapped to the callee
- **AND** the local status SHALL transition to `ended` with reason `timeout`

#### Scenario: Receiver decline authors a single declined event
- **GIVEN** the local status is `incoming-ringing` and the peer (caller) pubkey is `P_caller`
- **WHEN** the user invokes the local decline action
- **THEN** a Kind 16 rumor SHALL be sent with `['call-event-type', 'declined']`
- **AND** the rumor's `['call-initiator', ...]` tag value SHALL be `P_caller` (NOT the local user, who is the rumor author)
- **AND** the rumor SHALL be gift-wrapped to the caller
- **AND** a `reject` voice-call signal SHALL be sent to the caller
- **AND** the local status SHALL transition to `ended` with reason `rejected`

#### Scenario: Native Android lockscreen decline authors a Kind 16 declined rumor
- **GIVEN** the user is the callee on Android, the app is closed or the device is locked, and the lockscreen full-screen-intent notification for an incoming call is showing
- **AND** the caller's pubkey is `P_caller` and the call id is `C`
- **WHEN** the user taps the Decline action on the notification
- **THEN** the native Java layer SHALL send a `reject` voice-call signal to `P_caller` (existing `sendVoiceCallReject` path)
- **AND** the native Java layer SHALL also build a Kind 16 rumor with tags including `['call-event-type', 'declined']`, `['call-initiator', P_caller]`, `['call-id', C]`, `['p', P_caller]`
- **AND** the Kind 16 rumor SHALL be gift-wrapped to BOTH `P_caller` AND the local user (self-wrap), so that both peers' chat histories receive the rumor
- **AND** the rumor SHALL NOT carry a NIP-40 `expiration` tag (call-history rumors are persistent)
- **AND** when the local user's JS layer next runs, the self-wrap SHALL be received through the standard NIP-17 path and the rumor SHALL be saved to the local message database

#### Scenario: Caller receives reject without authoring a duplicate
- **GIVEN** the local status is `outgoing-ringing`
- **WHEN** a `reject` voice-call signal arrives from the callee
- **THEN** the local status SHALL transition to `ended` with reason `rejected`
- **AND** the caller SHALL NOT author a Kind 16 rumor of any type
- **AND** the caller SHALL receive the callee-authored `declined` rumor through standard NIP-17 delivery

#### Scenario: Caller receives busy and authors a busy event
- **GIVEN** the local status is `outgoing-ringing`
- **WHEN** a `busy` voice-call signal arrives from the callee
- **THEN** a Kind 16 rumor SHALL be sent with `['call-event-type', 'busy']`
- **AND** the rumor SHALL be gift-wrapped to the callee
- **AND** the local status SHALL transition to `ended` with reason `busy`

#### Scenario: ICE failure on the caller side authors a failed event
- **GIVEN** the local status is `connecting` or `active` and the local peer is the call initiator
- **WHEN** the ICE connection state becomes `failed` or `disconnected`, or the 30 s ICE timeout elapses without `connected`/`completed`
- **THEN** a Kind 16 rumor SHALL be sent with `['call-event-type', 'failed']`
- **AND** the rumor SHALL be gift-wrapped to the callee
- **AND** the local status SHALL transition to `ended` with reason `ice-failed`

#### Scenario: ICE failure on the callee side does not author
- **GIVEN** the local status is `connecting` or `active` and the local peer is the callee
- **WHEN** the ICE connection state becomes `failed` or `disconnected`
- **THEN** the callee SHALL NOT author a Kind 16 rumor of any type
- **AND** the local status SHALL transition to `ended` with reason `ice-failed`
- **AND** the callee SHALL still receive the caller-authored `failed` rumor via standard NIP-17 delivery if the caller's publish reaches it

#### Scenario: Declined call rendered with role-aware copy
- **GIVEN** a Kind 16 rumor with `['call-event-type', 'declined']` and `['call-initiator', <pubkey>]`
- **WHEN** the renderer displays the rumor on the device of the user whose pubkey equals `<pubkey>`
- **THEN** the pill SHALL display the caller-side declined copy ("Call declined" in English)
- **WHEN** the renderer displays the same rumor on the other peer's device
- **THEN** the pill SHALL display the callee-side declined copy ("Declined" in English)

#### Scenario: Busy call rendered with role-aware copy
- **GIVEN** a Kind 16 rumor with `['call-event-type', 'busy']` and `['call-initiator', <pubkey>]`
- **WHEN** the renderer displays the rumor on the device of the user whose pubkey equals `<pubkey>`
- **THEN** the pill SHALL display the caller-side busy copy ("User busy" in English)
- **WHEN** the renderer displays the same rumor on the other peer's device
- **THEN** the pill SHALL display the callee-side busy copy ("Missed voice call (busy)" in English)

#### Scenario: No-answer call rendered with role-aware copy
- **GIVEN** a Kind 16 rumor with `['call-event-type', 'no-answer']` and `['call-initiator', <pubkey>]`
- **WHEN** the renderer displays the rumor on the device of the user whose pubkey equals `<pubkey>`
- **THEN** the pill SHALL display the caller-side no-answer copy ("No answer" in English)
- **WHEN** the renderer displays the same rumor on the other peer's device
- **THEN** the pill SHALL display the callee-side no-answer copy ("Missed voice call" in English)

#### Scenario: Exactly one pill per call per side
- **GIVEN** any single voice call between peers A and B
- **WHEN** the call reaches a terminal state and all signaling has been delivered
- **THEN** peer A's local message database SHALL contain exactly one Kind 16 rumor for that call
- **AND** peer B's local message database SHALL contain exactly one Kind 16 rumor for that call

#### Scenario: Legacy and forward-compat call-event-type values render generically
- **GIVEN** a Kind 16 rumor whose `call-event-type` is not one of the seven canonical values (e.g. a stale `'outgoing'`/`'incoming'` row from an older schema, or a value introduced by a future client version)
- **WHEN** the conversation timeline renders the rumor
- **THEN** the pill SHALL display the generic "Voice call" copy rather than going blank
