## RENAMED Requirements

- FROM: `### Requirement: NIP-17 Anti-Impersonation Enforcement`
- TO: `### Requirement: NIP-AC Anti-Impersonation Enforcement`

- FROM: `### Requirement: Call History via Kind 16 Events`
- TO: `### Requirement: Call History via Kind 1405 Events`

## MODIFIED Requirements

### Requirement: Voice Call Lifecycle
The system SHALL support a complete one-to-one voice call lifecycle with the following statuses: `idle`, `outgoing-ringing`, `incoming-ringing`, `connecting`, `active`, `ended`. The system SHALL transition between statuses in response to local user actions (initiate, accept, decline, hangup, mute) and signaling events received from the remote peer (Call Offer kind 25050, Call Answer kind 25051, ICE Candidate kind 25052, Call Hangup kind 25053, Call Reject kind 25054). Only one call SHALL be active at any time per client. The `ended` state SHALL carry one of the following end reasons: `hangup`, `rejected`, `busy`, `timeout`, `ice-failed`, `error`, `answered-elsewhere`, `rejected-elsewhere`.

#### Scenario: Successful call setup and termination
- **GIVEN** the user is `idle` and authenticated
- **WHEN** the user initiates a call to a contact
- **THEN** the local status SHALL transition to `outgoing-ringing`
- **AND** a Call Offer (kind 25050) signaling event SHALL be sent to the recipient
- **WHEN** the recipient sends a Call Answer (kind 25051)
- **THEN** the local status SHALL transition to `connecting`
- **WHEN** the WebRTC ICE connection state becomes `connected` or `completed`
- **THEN** the local status SHALL transition to `active`
- **AND** the call duration timer SHALL start
- **WHEN** the user hangs up
- **THEN** a Call Hangup (kind 25053) signaling event SHALL be sent to the peer
- **AND** the local status SHALL transition to `ended` with reason `hangup`
- **AND** all media tracks SHALL be released and the peer connection SHALL be closed

#### Scenario: Recipient declines an incoming call
- **GIVEN** the user has status `incoming-ringing`
- **WHEN** the user declines the call
- **THEN** a Call Reject (kind 25054) signaling event SHALL be sent to the caller
- **AND** the local status SHALL transition to `ended` with reason `rejected`

#### Scenario: Initiator hangs up before answer
- **GIVEN** the user has status `outgoing-ringing`
- **WHEN** the user cancels the call before an answer arrives
- **THEN** a Call Hangup (kind 25053) signaling event SHALL be sent
- **AND** the local status SHALL transition to `ended`

#### Scenario: Concurrent call rejected with busy
- **GIVEN** the user has an `active` call with peer A
- **WHEN** a Call Offer (kind 25050) arrives from peer B
- **THEN** the system SHALL respond to peer B with a Call Reject (kind 25054) whose `content` is `"busy"`
- **AND** the existing call with peer A SHALL be unaffected

#### Scenario: Multi-device answered-elsewhere
- **GIVEN** the user is logged in on devices D1 and D2 and the local status on D1 is `incoming-ringing` for `call-id=X`
- **WHEN** D2 accepts the same call and publishes a self-addressed Call Answer (kind 25051) gift wrap with matching `call-id=X`
- **THEN** D1 SHALL transition to `ended` with reason `answered-elsewhere`
- **AND** D1 SHALL stop ringing

#### Scenario: Multi-device rejected-elsewhere
- **GIVEN** the user is logged in on devices D1 and D2 and the local status on D1 is `incoming-ringing` for `call-id=X`
- **WHEN** D2 rejects the same call and publishes a self-addressed Call Reject (kind 25054) gift wrap with matching `call-id=X`
- **THEN** D1 SHALL transition to `ended` with reason `rejected-elsewhere`
- **AND** D1 SHALL stop ringing

### Requirement: Voice Signaling Transport
The system SHALL transmit WebRTC signaling messages as NIP-AC ephemeral gift wraps of kind `21059`. The inner signaling event SHALL be one of the following kinds, signed by the sender's real key:

| Kind  | Name           | `content`                                                                                       |
|-------|----------------|--------------------------------------------------------------------------------------------------|
| 25050 | Call Offer     | Raw SDP offer string                                                                             |
| 25051 | Call Answer    | Raw SDP answer string                                                                            |
| 25052 | ICE Candidate  | JSON string `{"candidate":...,"sdpMid":...,"sdpMLineIndex":...}`                                 |
| 25053 | Call Hangup    | Empty string OR human-readable reason                                                            |
| 25054 | Call Reject    | Empty string OR `"busy"` for auto-reject from a non-idle state                                   |

Every inner signaling event SHALL include the tags `['p', <recipient-hex>]`, `['call-id', <UUID>]`, and `['alt', <human-readable-description>]`. Call Offer events (kind 25050) SHALL additionally include `['call-type', 'voice']`. Inner signaling events SHALL NOT carry an `expiration` tag — the ephemeral kind range conveys transience. The gift wrap (kind 21059) SHALL have a single `['p', <recipient-hex>]` tag, no `expiration` tag, and SHALL be signed with a freshly generated ephemeral key. The wrap content SHALL be the NIP-44 v2 ciphertext of the signed inner event JSON. The system SHALL NOT use the NIP-13 seal layer for signaling. The system SHALL NOT persist signaling events to the local database. The system SHALL NOT create a self-wrap for Call Offer (25050), ICE Candidate (25052), or Call Hangup (25053) events.

#### Scenario: Call Offer event structure
- **WHEN** the system sends a Call Offer
- **THEN** the inner event SHALL have `kind: 25050` and `content` equal to the raw SDP offer string
- **AND** the inner event tags SHALL include `['p', <recipient-hex>]`, `['call-id', <UUID>]`, `['call-type', 'voice']`, and `['alt', <human-readable>]`
- **AND** the inner event SHALL be signed by the sender's real key
- **AND** the wrap SHALL have `kind: 21059`, a single `['p', <recipient-hex>]` tag, no `expiration` tag, and SHALL be signed by a fresh ephemeral key
- **AND** the wrap `content` SHALL be the NIP-44 v2 ciphertext of the signed inner event

#### Scenario: ICE Candidate content shape
- **WHEN** the system sends an ICE Candidate
- **THEN** the inner event SHALL have `kind: 25052`
- **AND** `content` SHALL be a JSON string with exactly the fields `candidate`, `sdpMid`, and `sdpMLineIndex`
- **AND** quotes and backslashes in the SDP fragment SHALL be JSON-escaped

#### Scenario: Received signal routed to call service and not persisted
- **WHEN** a kind 21059 gift wrap is decrypted to a signed inner event of kind 25050, 25051, 25052, 25053, or 25054
- **THEN** the inner event SHALL be dispatched to the voice call service
- **AND** the inner event SHALL NOT be saved to the message database
- **AND** the inner event SHALL NOT be rendered as a chat message

#### Scenario: Legacy kind-14 voice-call rumor silently ignored
- **GIVEN** an older client publishes a kind 14 rumor with `['type','voice-call']`
- **WHEN** the new client decrypts the wrap
- **THEN** the rumor SHALL NOT be dispatched to the voice call service
- **AND** the rumor SHALL NOT trigger any user-facing notification

### Requirement: NIP-AC Anti-Impersonation Enforcement
On receive, the system SHALL verify the inner signed event's signature against its declared `pubkey` using `verifyEvent`. The system SHALL drop any inner event whose signature is invalid. Because the NIP-AC gift wrap has no seal layer, the inner-event signature is the sole authentication mechanism for sender identity.

#### Scenario: Invalid inner-event signature rejected
- **GIVEN** a kind 21059 gift wrap is decrypted to an inner event whose signature does not verify against its `pubkey`
- **WHEN** the system processes the gift wrap
- **THEN** the inner event SHALL NOT be dispatched to any handler
- **AND** an error SHALL be logged

#### Scenario: Valid signature accepted
- **GIVEN** a kind 21059 gift wrap is decrypted to a kind 25050 inner event whose signature is valid
- **WHEN** the system completes signature verification
- **THEN** the inner event SHALL proceed to subsequent receive-path checks (staleness, dedup, self-event filter, follow-gate)

### Requirement: Voice Signal Publishing Performance
The system SHALL publish voice-call signaling gift wraps only to relays that are already connected at the time of send, to avoid triggering subscription replays caused by adding temporary relays. The system SHALL cache the recipient's messaging-relay list for 60 seconds to avoid repeated profile lookups during ICE candidate trickle. The system SHALL emit ICE candidates fire-and-forget (without awaiting publish completion) so that candidates can be sent concurrently. The system SHALL apply a 5-second per-publish deadline to voice signal sends. For Call Answer (kind 25051) and Call Reject (kind 25054), the system SHALL additionally publish a self-wrap (a second kind 21059 wrap addressed to the sender's own pubkey) to enable multi-device "answered/rejected elsewhere" handling. The system SHALL NOT self-wrap Call Offer (25050), ICE Candidate (25052), or Call Hangup (25053).

#### Scenario: Voice signals only target connected relays
- **GIVEN** the recipient has three configured messaging relays, of which one is currently connected
- **WHEN** a voice-call signal is sent
- **THEN** the gift wrap SHALL be published to the one connected relay
- **AND** the system SHALL NOT add the two unconnected relays as temporary connections

#### Scenario: Recipient relay list cached for 60 seconds
- **GIVEN** a voice-call signal was sent to recipient R within the last 60 seconds
- **WHEN** another voice-call signal is sent to R
- **THEN** the recipient relay lookup SHALL reuse the cached relay list without performing a profile resolution

#### Scenario: ICE candidates emitted fire-and-forget
- **WHEN** the local WebRTC peer connection emits multiple ICE candidates in rapid succession
- **THEN** each candidate SHALL be sent without blocking the next
- **AND** the publish promises SHALL NOT be awaited inside the `onicecandidate` handler

#### Scenario: Call Answer is also self-wrapped
- **WHEN** the user accepts an incoming call and a Call Answer (kind 25051) is sent
- **THEN** the system SHALL publish one kind 21059 gift wrap addressed to the caller
- **AND** the system SHALL publish a second kind 21059 gift wrap addressed to the sender's own pubkey
- **AND** both wraps SHALL contain the same signed inner kind-25051 event

#### Scenario: Call Reject is also self-wrapped
- **WHEN** the user declines an incoming call and a Call Reject (kind 25054) is sent
- **THEN** the system SHALL publish one kind 21059 gift wrap addressed to the caller
- **AND** the system SHALL publish a second kind 21059 gift wrap addressed to the sender's own pubkey

#### Scenario: Call Offer is not self-wrapped
- **WHEN** the user initiates a call and a Call Offer (kind 25050) is sent
- **THEN** the system SHALL publish exactly one kind 21059 gift wrap addressed to the recipient
- **AND** the system SHALL NOT publish a self-wrap for the offer

### Requirement: Call History via Kind 1405 Events
The system SHALL persist call history as NIP-17 gift-wrapped Kind 1405 rumor events sent to both the initiator and the recipient (via standard NIP-59 self-wrap behavior). Each call-event rumor SHALL include the following tags: `['p', <recipient-pubkey>]`, `['type', 'call-event']`, `['call-event-type', <type>]` where `<type>` is one of `missed`, `ended`, `no-answer`, `declined`, `busy`, `failed`, `cancelled`, and `['call-initiator', <initiator-pubkey>]`. When the call event represents a completed conversation, the rumor SHALL include a `['call-duration', <seconds>]` tag with the call duration in seconds. The rumor `content` SHALL be the empty string. Call events SHALL be saved to the local message database and rendered as system-style entries in the conversation timeline. Call-event rumors are nospeak-specific and are NOT defined by NIP-AC; they continue to use the existing 3-layer NIP-17 gift-wrap pipeline (kind 14 rumor inside kind 13 seal inside kind 1059 wrap), distinct from the NIP-AC kind 21059 signaling pipeline.

#### Scenario: Ended-call event includes duration
- **GIVEN** a call between A and B was `active` for 47 seconds
- **WHEN** either party hangs up
- **THEN** a Kind 1405 rumor SHALL be sent with tags including `['call-event-type', 'ended']` and `['call-duration', '47']`
- **AND** the rumor SHALL be persisted to the local message database
- **AND** the rumor SHALL be rendered as a centered system-style entry in the conversation

#### Scenario: Missed-call event sent when incoming call goes unanswered
- **GIVEN** the user is `incoming-ringing` and the caller hangs up before the user accepts
- **WHEN** the system processes the caller's Call Hangup (kind 25053)
- **THEN** a Kind 1405 rumor SHALL be sent with `['call-event-type', 'missed']` and no `call-duration` tag

#### Scenario: Call event rendered with initiator and direction
- **WHEN** the conversation timeline includes a Kind 1405 message with tags `['call-event-type', 'ended']`, `['call-duration', '47']`, `['call-initiator', <my-pubkey>]`
- **THEN** the message SHALL be rendered with text indicating an outgoing call lasting 47 seconds

### Requirement: Lock-Screen Incoming Call Notification
On Android, when the existing background messaging service decrypts a kind 21059 ephemeral gift wrap whose inner event is a Call Offer (kind 25050) with a future-or-present `created_at` (no older than 60 seconds), and whose sender pubkey passes the follow-gate (is in the user's NIP-02 contact list), the service SHALL persist the offer to SharedPreferences and post a high-priority notification on a dedicated channel `nospeak_voice_call_incoming`. The notification SHALL include a full-screen intent targeting `MainActivity` with extras `accept_pending_call=true`, `call_id=<callId>`, and `nospeak_route_kind=voice-call-accept`. The notification SHALL include Accept and Decline action buttons. For NIP-AC inner events of any other kind (25051, 25052, 25053, 25054) received while the app is closed, the service SHALL discard the event without posting any notification. The persisted SharedPreferences slot `nospeak_pending_incoming_call` SHALL include `callId`, `sdp`, `peerHex`, `callType`, `alt`, `innerEventId`, and `createdAt`. Old-shape entries from prior versions (lacking the new keys) SHALL be ignored on first read after upgrade.

#### Scenario: Call Offer triggers full-screen-intent notification
- **GIVEN** the background messaging service is running and connected to relays
- **WHEN** a kind 21059 gift wrap arrives whose decrypted signed inner event is kind 25050 with `created_at` within the last 60 seconds and whose sender is in the user's contact list
- **THEN** the service SHALL write `callId`, `sdp`, `peerHex`, `callType`, `alt`, `innerEventId`, and `createdAt` to SharedPreferences `nospeak_pending_incoming_call`
- **AND** the service SHALL post a notification on channel `nospeak_voice_call_incoming` with `setFullScreenIntent` set to a `MainActivity` PendingIntent carrying the route extras
- **AND** the service SHALL NOT post a chat-message notification for this event

#### Scenario: Foreground app suppresses native ringtone
- **GIVEN** the background messaging service detects an incoming Call Offer
- **WHEN** `MainActivity.isAppVisible()` returns `true`
- **THEN** the posted notification SHALL be built with `setSilent(true)` so the system ringtone does not play
- **AND** the JS layer's existing in-app ringtone path SHALL handle the audible ring

#### Scenario: Stale Call Offer is dropped
- **GIVEN** an incoming kind 25050 inner event whose `created_at` is more than 60 seconds before the current Unix time
- **WHEN** the background messaging service inspects the event
- **THEN** the service SHALL discard the event without persisting state and without posting any notification

#### Scenario: Non-offer NIP-AC events are discarded while app is closed
- **GIVEN** an incoming kind 21059 inner event whose kind is 25051, 25052, 25053, or 25054
- **WHEN** the background messaging service inspects the event
- **THEN** the service SHALL discard the event without persisting state and without posting any notification

#### Scenario: Old-shape pending-call slot ignored on first boot
- **GIVEN** a pre-upgrade SharedPreferences `nospeak_pending_incoming_call` entry exists, lacking the keys `callType`, `alt`, `innerEventId`, or `createdAt`
- **WHEN** the new build reads the slot
- **THEN** the entry SHALL be treated as missing
- **AND** the slot SHALL be cleared

### Requirement: Pending Incoming Call Handoff
On Android, when the activity launches via the Accept full-screen intent, the JS layer SHALL read the persisted incoming-call payload via the plugin's `getPendingIncomingCall` method, clear it via `clearPendingIncomingCall`, hand the parsed Call Offer to `voiceCallService.handleNipAcEvent`, and immediately invoke `voiceCallService.acceptCall` without showing the in-app `IncomingCallOverlay`. If the persisted payload is missing or its `createdAt` is more than 60 seconds in the past, the JS layer SHALL surface a "missed call" toast and SHALL NOT enter `incoming-ringing`. A duplicate Call Offer arriving via the live subscription for a call already in `incoming-ringing` for the same `callId` and same `peerNpub` SHALL be ignored rather than producing a `busy` response.

#### Scenario: Activity launch via Accept consumes pending offer
- **GIVEN** the user tapped Accept on the lockscreen full-screen-intent notification
- **WHEN** `MainActivity` launches with intent extra `accept_pending_call=true`
- **THEN** the activity SHALL call `setShowWhenLocked(true)` and `setTurnScreenOn(true)`
- **AND** the activity SHALL call `KeyguardManager.requestDismissKeyguard`
- **AND** the notification router SHALL emit a `routeReceived` event with `kind: 'voice-call-accept'`
- **AND** the JS handler SHALL call `getPendingIncomingCall`, then `clearPendingIncomingCall`, then `voiceCallService.handleNipAcEvent`, then `voiceCallService.acceptCall`

#### Scenario: Missing pending offer surfaces missed-call toast
- **GIVEN** the activity launches with `accept_pending_call=true`
- **WHEN** the JS handler calls `getPendingIncomingCall` and receives `{ pending: null }`
- **THEN** the handler SHALL display a missed-call toast
- **AND** the handler SHALL NOT invoke `voiceCallService.handleNipAcEvent`

#### Scenario: Duplicate offer for active call is ignored
- **GIVEN** the local status is `incoming-ringing` for a call with `callId=X` and `peerNpub=Y`
- **WHEN** a second Call Offer (kind 25050) arrives with the same `callId=X` from the same `peerNpub=Y`
- **THEN** the system SHALL ignore the duplicate
- **AND** the system SHALL NOT send a Call Reject

### Requirement: Decline Action Best-Effort Reject Signal
On Android, when the user taps the Decline action button on the incoming-call notification, the system SHALL clear the pending-call SharedPreferences and cancel the notification. The system MAY additionally attempt to send a Call Reject (kind 25054) signal to the caller through the messaging service's already-connected WebSocket relays, with a self-wrap to the sender's own pubkey for multi-device dismissal; this is best-effort. If no reject is sent, or sending fails, the caller will eventually see a `timeout` end reason.

#### Scenario: Decline clears pending state and dismisses notification
- **GIVEN** an incoming-call notification is showing
- **WHEN** the user taps the Decline action button
- **THEN** the SharedPreferences `nospeak_pending_incoming_call` SHALL be cleared
- **AND** the notification SHALL be cancelled

#### Scenario: Decline tolerates offline or absent messaging service
- **GIVEN** the user has tapped Decline
- **AND** the messaging service is not running OR has no connected relays
- **WHEN** the receiver processes the Decline action
- **THEN** the receiver SHALL NOT throw or crash
- **AND** the pending state SHALL still be cleared and the notification SHALL still be cancelled
- **AND** the caller SHALL eventually see a `timeout` end reason for the call

#### Scenario: Decline best-effort send uses kind 25054 with self-wrap
- **GIVEN** the user has tapped Decline
- **AND** the messaging service has at least one connected relay
- **WHEN** the receiver attempts the best-effort reject send
- **THEN** the inner event SHALL be a signed kind 25054 with tags `['p', <caller-hex>]`, `['call-id', <callId>]`, and `['alt', ...]`
- **AND** the inner event SHALL be wrapped twice in kind 21059: once addressed to the caller and once addressed to the user's own pubkey

## REMOVED Requirements

### Requirement: Ephemeral Signaling via NIP-40
**Reason**: NIP-AC uses the ephemeral kind range (20000–29999) to signal transience to relays. Carrying a redundant NIP-40 `expiration` tag would be non-conformant with NIP-AC and adds two layers (seal + rumor) that do not exist in the new gift-wrap shape. Stale-event protection is now provided by a `created_at` staleness check on receive (see new requirement "NIP-AC Receive-Path Staleness and Deduplication").

**Migration**: Outgoing kind 21059 wraps and inner kinds 25050–25054 events do not carry an `expiration` tag. On receive, the inner event's `created_at` is checked against a 60-second staleness window; events older than 60 seconds are dropped. The check on chat (kind 14 rumors inside kind 1059 wraps) and call-history (kind 1405 rumors) pipelines is unaffected and continues to honor any `expiration` tag those layers may carry.

## ADDED Requirements

### Requirement: NIP-AC Receive-Path Staleness and Deduplication
The system SHALL discard any decrypted kind-21059 inner event whose `created_at` is more than 60 seconds before the current Unix time. The system SHALL maintain a recent processed-event-ID set (at least 256 entries, FIFO eviction) and SHALL drop any inner event whose ID has already been processed. Both checks SHALL run before kind-specific dispatch.

#### Scenario: Stale offer dropped silently
- **GIVEN** a kind 21059 wrap whose decrypted inner kind-25050 event has `created_at` more than 60 seconds in the past
- **WHEN** the receive path processes the event
- **THEN** the event SHALL NOT be dispatched to the voice call service
- **AND** no user-facing notification SHALL be raised

#### Scenario: Duplicate event dropped silently
- **GIVEN** a kind 21059 wrap whose decrypted inner event ID is present in the processed-event-ID set
- **WHEN** the receive path processes the event
- **THEN** the event SHALL NOT be dispatched to the voice call service

#### Scenario: Fresh first-delivery event processed
- **GIVEN** a kind 21059 wrap whose decrypted inner kind-25050 event has `created_at` within the last 60 seconds
- **AND** the inner event ID is not in the processed-event-ID set
- **WHEN** the receive path processes the event
- **THEN** the event SHALL proceed to the self-event filter and follow-gate, then dispatch to the voice call service

### Requirement: NIP-AC Self-Event Filter
On receive, the system SHALL apply the following filter to inner signaling events whose `pubkey` equals the user's own public key:

- Kind **25052 (ICE Candidate)** and kind **25053 (Call Hangup)** from self SHALL always be ignored.
- Kind **25051 (Call Answer)** and kind **25054 (Call Reject)** from self SHALL be ignored UNLESS the local status is `incoming-ringing` AND the event's `call-id` matches the currently ringing call. When both conditions hold, the system SHALL transition to `ended` with reason `answered-elsewhere` (for kind 25051) or `rejected-elsewhere` (for kind 25054), and SHALL stop ringing.

#### Scenario: Self ICE candidate ignored
- **GIVEN** the local status is `connecting` or `active`
- **WHEN** a kind 25052 inner event arrives whose `pubkey` equals the user's own pubkey
- **THEN** the event SHALL NOT be applied to any peer connection
- **AND** the local status SHALL be unchanged

#### Scenario: Self hangup ignored
- **GIVEN** the local status is `active`
- **WHEN** a kind 25053 inner event arrives whose `pubkey` equals the user's own pubkey
- **THEN** the event SHALL be ignored
- **AND** the local status SHALL remain `active`

#### Scenario: Self answer in incoming-ringing triggers answered-elsewhere
- **GIVEN** the local status is `incoming-ringing` for `call-id=X`
- **WHEN** a kind 25051 inner event arrives whose `pubkey` equals the user's own pubkey and whose `call-id` tag equals `X`
- **THEN** the local status SHALL transition to `ended` with reason `answered-elsewhere`
- **AND** ringtones SHALL stop

#### Scenario: Self reject in incoming-ringing triggers rejected-elsewhere
- **GIVEN** the local status is `incoming-ringing` for `call-id=X`
- **WHEN** a kind 25054 inner event arrives whose `pubkey` equals the user's own pubkey and whose `call-id` tag equals `X`
- **THEN** the local status SHALL transition to `ended` with reason `rejected-elsewhere`
- **AND** ringtones SHALL stop

#### Scenario: Self answer in offering ignored
- **GIVEN** the local status is `outgoing-ringing`
- **WHEN** a kind 25051 inner event arrives whose `pubkey` equals the user's own pubkey
- **THEN** the event SHALL be ignored
- **AND** the local status SHALL remain `outgoing-ringing`

### Requirement: Spam Prevention via Follow-Gating
The system SHALL only display incoming-call notifications and SHALL only enter `incoming-ringing` state for Call Offer (kind 25050) events whose sender's pubkey appears in the user's NIP-02 contact list. Offers from non-followed pubkeys SHALL be silently dropped. If the user's contact list has not been loaded in the current session at the time the offer is processed, the offer SHALL be silently dropped (no ringing, no notification). Follow-gating applies only to Call Offer (kind 25050); Call Answer, ICE Candidate, Call Hangup, and Call Reject events SHALL pass without follow-gating because they belong to in-progress calls. The follow-gate SHALL be enforced both in the JavaScript receive path and in the Android `NativeBackgroundMessagingService` so that the lockscreen full-screen-intent ringer respects the same gate when the app is closed. There is no user-facing toggle for follow-gating in this version.

#### Scenario: Offer from followed user rings
- **GIVEN** the user's contact list is loaded and contains pubkey P
- **WHEN** a kind 25050 Call Offer arrives with sender pubkey P
- **THEN** the local status SHALL transition to `incoming-ringing`
- **AND** the in-app ringtone SHALL play
- **AND** on Android the lockscreen FSI notification SHALL be posted

#### Scenario: Offer from non-followed user dropped silently
- **GIVEN** the user's contact list is loaded and does NOT contain pubkey P
- **WHEN** a kind 25050 Call Offer arrives with sender pubkey P
- **THEN** the local status SHALL remain `idle`
- **AND** no ringtone SHALL play
- **AND** no notification SHALL be posted
- **AND** no error SHALL be returned to the sender

#### Scenario: Offer dropped on cold start before contacts loaded
- **GIVEN** the contact list has not yet been loaded in the current session
- **WHEN** a kind 25050 Call Offer arrives
- **THEN** the local status SHALL remain `idle`
- **AND** no ringtone SHALL play
- **AND** no notification SHALL be posted

#### Scenario: Native lockscreen FSI also respects follow-gate
- **GIVEN** the app is closed and the Android `NativeBackgroundMessagingService` is the only listener
- **AND** an incoming Call Offer arrives from a pubkey not in the user's NIP-02 contact list
- **WHEN** the service decrypts the wrap and inspects the inner event
- **THEN** the service SHALL discard the event
- **AND** no full-screen-intent notification SHALL be posted

#### Scenario: Non-offer events bypass follow-gating
- **GIVEN** the local status is `outgoing-ringing` for a call to peer P
- **WHEN** a kind 25051 Call Answer arrives from peer P
- **THEN** the answer SHALL be processed normally
- **AND** the follow-gate SHALL NOT block in-progress call signaling

### Requirement: ICE Candidate Buffering
The system SHALL implement two layers of ICE candidate buffering:

1. A **global buffer** keyed by sender pubkey, holding ICE candidates received before any `RTCPeerConnection` exists for that sender. When a `RTCPeerConnection` is later created for that peer, the buffered candidates SHALL be moved to the per-session buffer and the global buffer entry SHALL be cleared.
2. A **per-session buffer** holding ICE candidates received after the `RTCPeerConnection` exists but before `setRemoteDescription()` has resolved. Once `setRemoteDescription()` resolves successfully, the system SHALL flush the per-session buffer by calling `addIceCandidate()` for each buffered candidate, in arrival order.

ICE candidates that arrive after both `setRemoteDescription()` and a live `RTCPeerConnection` exist SHALL be applied directly via `addIceCandidate()` without buffering. Candidates buffered while ringing SHALL NOT be cleared when accepting the call — they SHALL be drained into the new session. Both buffers SHALL be cleared on call cleanup (transition out of any non-`idle` state into `idle`).

#### Scenario: Candidate before peer connection buffered globally
- **GIVEN** the local status is `incoming-ringing` and no `RTCPeerConnection` has been created
- **WHEN** a kind 25052 ICE Candidate arrives from the caller
- **THEN** the candidate SHALL be appended to the global buffer keyed by the caller's pubkey
- **AND** no `addIceCandidate()` call SHALL be made

#### Scenario: Global buffer drains into session on peer-connection creation
- **GIVEN** the global buffer holds 3 candidates for caller pubkey P
- **WHEN** the user accepts the call and a `RTCPeerConnection` is created for peer P
- **THEN** all 3 candidates SHALL be moved to the per-session buffer in arrival order
- **AND** the global buffer entry for P SHALL be cleared

#### Scenario: Per-session buffer flushed after setRemoteDescription
- **GIVEN** the per-session buffer holds N candidates and `setRemoteDescription()` has been awaited
- **WHEN** `setRemoteDescription()` resolves successfully
- **THEN** `addIceCandidate()` SHALL be called for each buffered candidate in arrival order
- **AND** the per-session buffer SHALL be empty afterward

#### Scenario: Late candidate applied directly
- **GIVEN** the `RTCPeerConnection` exists and `setRemoteDescription()` has already resolved
- **WHEN** a kind 25052 ICE Candidate arrives from the peer
- **THEN** the candidate SHALL be applied directly via `addIceCandidate()` without entering any buffer

#### Scenario: Buffers cleared on call cleanup
- **GIVEN** a call ends (transition to `idle` after the `ended` display window)
- **WHEN** the cleanup routine runs
- **THEN** the global buffer SHALL be cleared
- **AND** the per-session buffer SHALL be cleared

### Requirement: Multi-Device Self-Notification
To support a user logged in on multiple devices, when the user accepts an incoming call (sending a Call Answer, kind 25051) or rejects an incoming call (sending a Call Reject, kind 25054), the system SHALL publish two kind 21059 gift wraps containing the same signed inner event: one addressed to the peer and one addressed to the sender's own pubkey. Other devices owned by the same user that receive the self-addressed wrap and are currently in `incoming-ringing` for the matching `call-id` SHALL transition to `ended` with reason `answered-elsewhere` or `rejected-elsewhere` respectively, and SHALL stop ringing. On Android, the JS layer SHALL invoke a new plugin method `dismissIncomingCall(callId)` to cancel the lockscreen full-screen-intent notification, finish the `IncomingCallActivity` if it is showing, and stop the ringer foreground service if it is running.

#### Scenario: Answer self-wrap dismisses ringer on another device
- **GIVEN** device D1 is in `incoming-ringing` for `call-id=X`
- **AND** device D2 of the same user accepts the call and publishes a self-addressed kind 25051
- **WHEN** D1 receives and decrypts the self-addressed wrap
- **THEN** D1 SHALL transition to `ended` with reason `answered-elsewhere`
- **AND** D1's in-app ringtone SHALL stop
- **AND** on Android, D1 SHALL invoke `dismissIncomingCall(X)` to cancel the lockscreen FSI notification

#### Scenario: Reject self-wrap dismisses ringer on another device
- **GIVEN** device D1 is in `incoming-ringing` for `call-id=X`
- **AND** device D2 of the same user rejects the call and publishes a self-addressed kind 25054
- **WHEN** D1 receives and decrypts the self-addressed wrap
- **THEN** D1 SHALL transition to `ended` with reason `rejected-elsewhere`
- **AND** D1's in-app ringtone SHALL stop
- **AND** on Android, D1 SHALL invoke `dismissIncomingCall(X)` to cancel the lockscreen FSI notification

#### Scenario: Self-addressed wrap with mismatched call-id ignored
- **GIVEN** device D1 is in `incoming-ringing` for `call-id=X`
- **WHEN** D1 receives a self-addressed kind 25051 whose `call-id` tag is `Y` (Y ≠ X)
- **THEN** the event SHALL be ignored
- **AND** D1 SHALL remain in `incoming-ringing`

#### Scenario: Self-addressed wrap outside incoming-ringing ignored
- **GIVEN** device D1 is in `idle`
- **WHEN** D1 receives a self-addressed kind 25051 (echo of D2's answer)
- **THEN** the event SHALL be ignored
- **AND** D1 SHALL remain in `idle`
