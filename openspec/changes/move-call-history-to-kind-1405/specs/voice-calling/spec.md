# Voice-calling delta

## MODIFIED Requirements

### Requirement: Call History via Kind 1405 Events
The system SHALL persist call history as NIP-17 sealed Kind `1405` rumor
events. Each call-event rumor SHALL include the following tags:
`['p', <recipient-pubkey>]`, `['type', 'call-event']`,
`['call-event-type', <type>]` where `<type>` is one of `missed`, `ended`,
`no-answer`, `declined`, `busy`, `failed`, `cancelled`, and
`['call-initiator', <initiator-pubkey>]`. The rumor MAY include a
`['call-id', <callId>]` tag carrying the WebRTC call identifier; clients
SHALL ignore unknown tags. When the call event represents a completed
conversation that reached the `active` state, the rumor SHALL include a
`['call-duration', <seconds>]` tag with the call duration in seconds. The
rumor `content` SHALL be the empty string. Call events SHALL be saved to
the local message database and rendered as system-style entries in the
conversation timeline.

Kind 1405 was selected as an unassigned regular-range kind adjacent to
NIP-17's kinds 14 (chat) and 15 (file message), reflecting that
call-history rumors share the same persistence semantics as other NIP-17
sealed rumors. Kind 16 (NIP-18 "Generic Repost") MUST NOT be used; it has
unrelated public semantics.

#### Scenario: Ended-call event includes duration
- **GIVEN** a call between A and B was `active` for 47 seconds
- **WHEN** either party hangs up
- **THEN** a Kind 1405 rumor SHALL be sent with tags including
  `['call-event-type', 'ended']` and `['call-duration', '47']`
- **AND** the rumor SHALL be persisted to the local message database
- **AND** the rumor SHALL be rendered as a centered system-style entry
  in the conversation

#### Scenario: Missed-call event sent when incoming call goes unanswered
- **GIVEN** the user is `incoming-ringing` and the caller hangs up before
  the user accepts
- **WHEN** the system processes the caller's `hangup` signal
- **THEN** a Kind 1405 rumor SHALL be persisted to the local message
  database with `['call-event-type', 'missed']` and no `call-duration`
  tag

#### Scenario: Call event rendered with initiator and direction
- **WHEN** the conversation timeline includes a Kind 1405 message with
  tags `['call-event-type', 'ended']`, `['call-duration', '47']`,
  `['call-initiator', <my-pubkey>]`
- **THEN** the message SHALL be rendered with text indicating an outgoing
  call lasting 47 seconds

#### Scenario: Receive path rejects legacy Kind 16 rumors
- **GIVEN** an incoming gift-wrap whose decrypted rumor has `kind: 16`
- **WHEN** `Messaging.processGiftWrap` (and the native-queue equivalent)
  validates the rumor kind
- **THEN** the rumor SHALL be rejected
- **AND** no message row SHALL be created from it

#### Scenario: Local DB migration rewrites legacy rumorKind 16 rows
- **GIVEN** a local Dexie database from an earlier client version that
  contains `messages` rows with `rumorKind: 16` and a populated
  `callEventType`
- **WHEN** the user opens the upgraded client for the first time
- **THEN** the Dexie upgrade step SHALL rewrite every such row's
  `rumorKind` to `1405`
- **AND** all other fields on those rows SHALL be preserved
- **AND** rows whose `rumorKind` is not 16, or whose `callEventType` is
  unset, SHALL NOT be modified
