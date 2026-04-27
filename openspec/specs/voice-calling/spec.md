# voice-calling Specification

## Purpose
Define requirements for one-to-one peer-to-peer encrypted voice calls between Nostr users. Calls SHALL use WebRTC for media transport, NIP-17 gift wraps for signaling, NIP-40 expiration tags to mark signaling messages as ephemeral, and NIP-59 sealed Kind 16 events for persistent call history (missed/ended).

## Requirements

### Requirement: Voice Call Lifecycle
The system SHALL support a complete one-to-one voice call lifecycle with the following statuses: `idle`, `outgoing-ringing`, `incoming-ringing`, `connecting`, `active`, `ended`. The system SHALL transition between statuses in response to local user actions (initiate, accept, decline, hangup, mute) and signaling events received from the remote peer (offer, answer, ice-candidate, hangup, reject, busy). Only one call SHALL be active at any time per client.

#### Scenario: Successful call setup and termination
- **GIVEN** the user is `idle` and authenticated
- **WHEN** the user initiates a call to a contact
- **THEN** the local status SHALL transition to `outgoing-ringing`
- **AND** an `offer` signaling message SHALL be sent to the recipient
- **WHEN** the recipient sends an `answer`
- **THEN** the local status SHALL transition to `connecting`
- **WHEN** the WebRTC ICE connection state becomes `connected` or `completed`
- **THEN** the local status SHALL transition to `active`
- **AND** the call duration timer SHALL start
- **WHEN** the user hangs up
- **THEN** a `hangup` signaling message SHALL be sent to the peer
- **AND** the local status SHALL transition to `ended`
- **AND** all media tracks SHALL be released and the peer connection SHALL be closed

#### Scenario: Recipient declines an incoming call
- **GIVEN** the user has status `incoming-ringing`
- **WHEN** the user declines the call
- **THEN** a `reject` signaling message SHALL be sent to the caller
- **AND** the local status SHALL transition to `ended` with reason `rejected`

#### Scenario: Initiator hangs up before answer
- **GIVEN** the user has status `outgoing-ringing`
- **WHEN** the user cancels the call before an answer arrives
- **THEN** a `hangup` signaling message SHALL be sent
- **AND** the local status SHALL transition to `ended`

### Requirement: Call Initiation Restrictions
The system SHALL only allow voice call initiation in one-to-one conversations. The phone-icon call button SHALL NOT be rendered in group conversations. The system SHALL only allow one concurrent call; if the user is already in a non-`idle` call state, attempts to initiate or accept a new call SHALL be rejected.

#### Scenario: Call button hidden in group chats
- **GIVEN** the user is viewing a group conversation
- **WHEN** the chat header is rendered
- **THEN** the call button SHALL NOT appear

#### Scenario: Call button visible in 1-on-1 chats
- **GIVEN** the user is viewing a one-to-one conversation with a contact
- **WHEN** the chat header is rendered
- **THEN** the call button SHALL appear and be clickable

#### Scenario: Concurrent call rejected with busy
- **GIVEN** the user has an `active` call with peer A
- **WHEN** an `offer` arrives from peer B
- **THEN** the system SHALL respond to peer B with a `busy` signaling message
- **AND** the existing call with peer A SHALL be unaffected

### Requirement: Voice Signaling Transport
The system SHALL transmit WebRTC signaling messages (offer, answer, ice-candidate, hangup, reject, busy) as NIP-17 gift wraps (Kind 1059) containing a Kind 14 rumor. The rumor SHALL include a `['type', 'voice-call']` tag to discriminate signals from chat messages. The rumor `content` SHALL be the JSON-encoded signaling payload `{ type: 'voice-call', action, callId, sdp?, candidate? }`. The system SHALL NOT persist signaling rumors to the local database. The system SHALL NOT create a self-wrap (sender-targeted gift wrap) for signaling rumors.

#### Scenario: Signal sent as gift-wrapped Kind 14 rumor with discriminator
- **WHEN** the system sends a voice-call signal
- **THEN** the inner rumor SHALL have `kind: 14`
- **AND** the rumor `tags` SHALL include `['type', 'voice-call']`
- **AND** the rumor `content` SHALL be the JSON-encoded signaling payload
- **AND** the rumor SHALL be wrapped in a NIP-17 gift wrap (Kind 1059) addressed to the recipient

#### Scenario: Received signal routed to call service and not persisted
- **WHEN** a gift wrap is decrypted to a Kind 14 rumor with the `type:voice-call` tag
- **THEN** the parsed signal SHALL be dispatched to the voice call service
- **AND** the rumor SHALL NOT be saved to the message database
- **AND** the rumor SHALL NOT be rendered as a chat message

### Requirement: Ephemeral Signaling via NIP-40
The system SHALL mark voice-call signaling events as ephemeral by adding a NIP-40 `['expiration', <unix-seconds>]` tag with a value of `now + 60` seconds to the inner rumor (Kind 14), the seal (Kind 13), and the outer gift wrap (Kind 1059). On receive, the system SHALL silently drop any decrypted rumor whose `expiration` tag value is in the past, before any kind-specific routing. A rumor with no `expiration` tag SHALL be processed normally. A rumor with a non-numeric `expiration` tag value SHALL be processed normally.

#### Scenario: Outgoing voice signal carries 60-second expiration on all three layers
- **WHEN** the system sends a voice-call signal at wall-clock time T
- **THEN** the inner rumor's `tags` SHALL include `['expiration', String(T + 60)]`
- **AND** the seal's `tags` SHALL include `['expiration', String(T + 60)]`
- **AND** the gift wrap's `tags` SHALL include `['expiration', String(T + 60)]`

#### Scenario: Expired rumor silently dropped on receive
- **GIVEN** a gift wrap is decrypted to a rumor with `['expiration', <past-unix-time>]`
- **WHEN** the system finishes seal/rumor pubkey verification and the my-pubkey-in-p-tags check
- **THEN** the system SHALL NOT dispatch the rumor to any kind-specific handler (reactions, voice signals, normal message processing)
- **AND** the system SHALL NOT save the rumor to the database

#### Scenario: Future-expiration rumor processed normally
- **GIVEN** a gift wrap is decrypted to a voice-call signal rumor with `['expiration', String(now + 60)]`
- **WHEN** the system completes the expiration check
- **THEN** the rumor SHALL be dispatched to the voice call service handler

#### Scenario: Rumor without expiration tag processed normally
- **GIVEN** a gift wrap is decrypted to a Kind 14 rumor with no `expiration` tag
- **WHEN** the system completes the expiration check
- **THEN** the rumor SHALL be processed by the normal message-handling pipeline

#### Scenario: Read receipts continue to function under generic expiration check
- **GIVEN** a gift wrap is decrypted to a Kind 7 reaction rumor with a 7-day-future `expiration` tag
- **WHEN** the system completes the expiration check
- **THEN** the rumor SHALL be dispatched to the reaction handler

### Requirement: Voice Signal Publishing Performance
The system SHALL publish voice-call signaling gift wraps only to relays that are already connected at the time of send, to avoid triggering subscription replays caused by adding temporary relays. The system SHALL cache the recipient's messaging-relay list for 60 seconds to avoid repeated profile lookups during ICE candidate trickle. The system SHALL emit ICE candidates fire-and-forget (without awaiting publish completion) so that candidates can be sent concurrently. The system SHALL apply a 5-second per-publish deadline to voice signal sends.

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

### Requirement: NIP-17 Anti-Impersonation Enforcement
On receive, the system SHALL verify that the seal's pubkey equals the rumor's pubkey to prevent sender impersonation. The system SHALL verify the seal's signature using `verifyEvent`. The system SHALL drop any rumor whose decrypted seal fails either check.

#### Scenario: Mismatched seal/rumor pubkey rejected
- **GIVEN** a gift wrap is decrypted to a seal whose `pubkey` does not equal the inner rumor's `pubkey`
- **WHEN** the system processes the gift wrap
- **THEN** the rumor SHALL NOT be dispatched to any handler
- **AND** an error SHALL be logged

#### Scenario: Invalid seal signature rejected
- **GIVEN** a gift wrap is decrypted to a seal whose signature is invalid
- **WHEN** the system processes the gift wrap
- **THEN** the rumor SHALL NOT be dispatched to any handler

### Requirement: Call Timeouts
The system SHALL apply a 60-second timeout to outgoing call offers; if no `answer` arrives within this window the call SHALL transition to `ended` with reason `timeout`. The system SHALL apply a 30-second timeout to ICE connection establishment after answer exchange; if the peer connection does not reach `connected`/`completed` within this window the call SHALL transition to `ended` with reason `ice-failed`. The system SHALL also transition to `ended` with reason `ice-failed` if the ICE connection state becomes `failed` or `disconnected`.

#### Scenario: Call offer times out without answer
- **GIVEN** the user initiated a call and the status is `outgoing-ringing`
- **WHEN** 60 seconds pass without an `answer` signal
- **THEN** the local status SHALL transition to `ended` with reason `timeout`
- **AND** an outgoing call event message SHALL be created in the conversation

#### Scenario: ICE establishment times out
- **GIVEN** an `answer` has been processed and the status is `connecting`
- **WHEN** 30 seconds pass without the ICE state reaching `connected` or `completed`
- **THEN** the local status SHALL transition to `ended` with reason `ice-failed`

#### Scenario: ICE connection fails after being established
- **GIVEN** the call is `active`
- **WHEN** the ICE connection state becomes `failed` or `disconnected`
- **THEN** the local status SHALL transition to `ended` with reason `ice-failed`

### Requirement: Audio Capture Constraints
The system SHALL request microphone access with `echoCancellation`, `noiseSuppression`, and `autoGainControl` enabled. The system SHALL NOT request video. On call end, all captured media tracks SHALL be stopped and released.

#### Scenario: Microphone requested with audio processing enabled
- **WHEN** the system calls `getUserMedia` for a voice call
- **THEN** the constraints SHALL specify `audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }`
- **AND** the constraints SHALL specify `video: false`

#### Scenario: Media tracks released on call end
- **GIVEN** a call has been `active`
- **WHEN** the call transitions to `ended`
- **THEN** every track on the local stream SHALL be stopped
- **AND** the `RTCPeerConnection` SHALL be closed

### Requirement: ICE Server Configuration
The system SHALL load ICE server configuration (STUN and TURN servers, with optional credentials) from runtime configuration at call setup. ICE servers SHALL be configurable via the runtime configuration mechanism so deployments can supply their own STUN/TURN infrastructure without rebuilding the client.

#### Scenario: Peer connection uses configured ICE servers
- **WHEN** the system constructs a new `RTCPeerConnection` for a call
- **THEN** the configuration SHALL include the ICE servers returned by the runtime configuration getter
- **AND** each ICE server entry SHALL include `urls` and (where present) `username` and `credential`

### Requirement: Ringtone and Ringback
The system SHALL play a two-tone ringtone (alternating 440 Hz and 480 Hz, every 3 seconds) on the recipient's device while status is `incoming-ringing`. The system SHALL play a single-tone ringback every 4 seconds on the initiator's device while status is `outgoing-ringing`. The system SHALL stop all ringtone/ringback audio on transition out of the ringing states.

#### Scenario: Incoming ringtone plays during incoming ring
- **GIVEN** the local status transitions to `incoming-ringing`
- **WHEN** the incoming-call overlay is mounted
- **THEN** the two-tone ringtone SHALL begin playing
- **WHEN** the status transitions away from `incoming-ringing`
- **THEN** the ringtone SHALL stop

#### Scenario: Ringback plays during outgoing ring
- **GIVEN** the local status transitions to `outgoing-ringing`
- **THEN** the single-tone ringback SHALL begin playing
- **WHEN** the status transitions to `connecting`, `active`, or `ended`
- **THEN** the ringback SHALL stop

### Requirement: Call History via Kind 16 Events
The system SHALL persist call history as NIP-17 gift-wrapped Kind 16 rumor events sent to both the initiator and the recipient (via standard NIP-59 self-wrap behavior). Each call-event rumor SHALL include the following tags: `['p', <recipient-pubkey>]`, `['type', 'call-event']`, `['call-event-type', <type>]` where `<type>` is one of `missed`, `outgoing`, `incoming`, `ended`, and `['call-initiator', <initiator-pubkey>]`. When the call event represents a completed conversation, the rumor SHALL include a `['call-duration', <seconds>]` tag with the call duration in seconds. The rumor `content` SHALL be the empty string. Call events SHALL be saved to the local message database and rendered as system-style entries in the conversation timeline.

#### Scenario: Ended-call event includes duration
- **GIVEN** a call between A and B was `active` for 47 seconds
- **WHEN** either party hangs up
- **THEN** a Kind 16 rumor SHALL be sent with tags including `['call-event-type', 'ended']` and `['call-duration', '47']`
- **AND** the rumor SHALL be persisted to the local message database
- **AND** the rumor SHALL be rendered as a centered system-style entry in the conversation

#### Scenario: Missed-call event sent when incoming call goes unanswered
- **GIVEN** the user is `incoming-ringing` and the caller hangs up before the user accepts
- **WHEN** the system processes the caller's `hangup` signal
- **THEN** a Kind 16 rumor SHALL be sent with `['call-event-type', 'missed']` and no `call-duration` tag

#### Scenario: Call event rendered with initiator and direction
- **WHEN** the conversation timeline includes a Kind 16 message with tags `['call-event-type', 'ended']`, `['call-duration', '47']`, `['call-initiator', <my-pubkey>]`
- **THEN** the message SHALL be rendered with text indicating an outgoing call lasting 47 seconds

### Requirement: Active Call Controls
The system SHALL render an active-call overlay providing mute toggle, speaker toggle, hangup button, and a live duration display. The system SHALL render an incoming-call overlay providing accept and decline buttons. Both overlays SHALL be mounted in the root layout so they are visible regardless of the active route.

#### Scenario: Mute toggles audio track enabled state
- **GIVEN** the call is `active`
- **WHEN** the user presses the mute button
- **THEN** the local audio track's `enabled` flag SHALL be set to `false`
- **AND** the mute button SHALL display the muted state
- **WHEN** the user presses the mute button again
- **THEN** the local audio track's `enabled` flag SHALL be set to `true`

#### Scenario: Hangup ends the call
- **GIVEN** the call is `active`
- **WHEN** the user presses the hangup button
- **THEN** a `hangup` signal SHALL be sent to the peer
- **AND** the call SHALL transition to `ended`
- **AND** an ended call event SHALL be persisted

#### Scenario: Incoming overlay accept transitions to connecting
- **GIVEN** the local status is `incoming-ringing`
- **WHEN** the user presses the accept button
- **THEN** the system SHALL request microphone access
- **AND** an `answer` signal SHALL be sent to the caller
- **AND** the local status SHALL transition to `connecting`

### Requirement: Android Voice-Call Foreground Service Lifecycle
On Android, the system SHALL run a foreground service of type `phoneCall` for the entire duration of any call, starting when the local status enters `outgoing-ringing` or `incoming-ringing` and stopping when the status enters `ended`. The service SHALL acquire a `PARTIAL_WAKE_LOCK` while running and SHALL release it when stopped. The service SHALL NOT auto-restart if killed by the system (`START_NOT_STICKY`); a system-killed call is unrecoverable and the user will see the call drop.

#### Scenario: Outgoing call starts the foreground service
- **GIVEN** the user initiates a call on Android
- **WHEN** the local status transitions to `outgoing-ringing`
- **THEN** the JS layer SHALL invoke the Android voice-call plugin's `startCallSession` method with the callId, peer npub, peer display name, and role `outgoing`
- **AND** the native `VoiceCallForegroundService` SHALL start with foreground service type `phoneCall`
- **AND** the service SHALL acquire a partial wake lock named `nospeak:voice-call`

#### Scenario: Incoming call accept starts the foreground service
- **GIVEN** the user accepts an incoming call on Android (whether from the in-app overlay or the lockscreen full-screen-intent)
- **WHEN** the local status transitions to `connecting`
- **THEN** the JS layer SHALL invoke `startCallSession` with role `incoming`

#### Scenario: Call end stops the foreground service
- **GIVEN** an Android voice call is active
- **WHEN** the local status transitions to `ended`
- **THEN** the JS layer SHALL invoke the plugin's `endCallSession` method
- **AND** the native service SHALL release the wake lock and call `stopForeground` and `stopSelf`

### Requirement: Android Voice-Call Audio Mode
On Android, the voice-call foreground service SHALL set the system audio mode to `AudioManager.MODE_IN_COMMUNICATION` on start and SHALL restore the previous mode on stop. This engages the OS-level voice acoustic-echo-cancellation pipeline.

#### Scenario: Audio mode set on call start
- **GIVEN** the `VoiceCallForegroundService` `onStartCommand` is invoked
- **WHEN** the service finishes calling `startForeground`
- **THEN** the service SHALL read and remember the current `AudioManager.getMode()` value
- **AND** the service SHALL call `AudioManager.setMode(MODE_IN_COMMUNICATION)`

#### Scenario: Audio mode restored on call end
- **GIVEN** the `VoiceCallForegroundService` had previously applied `MODE_IN_COMMUNICATION`
- **WHEN** the service `onDestroy` runs
- **THEN** the service SHALL call `AudioManager.setMode(...)` with the previously remembered mode value

### Requirement: Lock-Screen Incoming Call Notification
On Android, when the existing background messaging service decrypts a NIP-17 gift-wrapped rumor whose `tags` include `['type', 'voice-call']` and whose parsed signal `action` is `offer` and whose NIP-40 `expiration` is in the future, the service SHALL persist the offer to SharedPreferences and post a high-priority notification on a dedicated channel `nospeak_voice_call_incoming`. The notification SHALL include a full-screen intent targeting `MainActivity` with extras `accept_pending_call=true`, `call_id=<callId>`, and `nospeak_route_kind=voice-call-accept`. The notification SHALL include Accept and Decline action buttons. For voice-call rumors with any other `action` (`answer`, `ice-candidate`, `hangup`, `reject`, `busy`) received while the app is closed, the service SHALL discard the rumor without posting any notification.

#### Scenario: Voice-call offer triggers full-screen-intent notification
- **GIVEN** the background messaging service is running and connected to relays
- **WHEN** a kind 1059 gift wrap arrives whose decrypted rumor has `['type','voice-call']` and content with `action: 'offer'` and a future `expiration`
- **THEN** the service SHALL write the parsed signal, sender npub, sender pubkey hex, callId, receivedAt timestamp, and expiresAt to SharedPreferences `nospeak_pending_incoming_call`
- **AND** the service SHALL post a notification on channel `nospeak_voice_call_incoming` with `setFullScreenIntent` set to a `MainActivity` PendingIntent carrying the route extras
- **AND** the service SHALL NOT post a chat-message notification for this rumor

#### Scenario: Foreground app suppresses native ringtone
- **GIVEN** the background messaging service detects an incoming voice-call offer
- **WHEN** `MainActivity.isAppVisible()` returns `true`
- **THEN** the posted notification SHALL be built with `setSilent(true)` so the system ringtone does not play
- **AND** the JS layer's existing in-app ringtone path SHALL handle the audible ring

#### Scenario: Stale voice-call signal is dropped
- **GIVEN** an incoming voice-call rumor whose `expiration` tag value is less than the current Unix time
- **WHEN** the background messaging service decrypts and inspects the rumor
- **THEN** the service SHALL discard the rumor without persisting state and without posting any notification

#### Scenario: Non-offer voice-call signals are discarded while app is closed
- **GIVEN** an incoming voice-call rumor whose `action` is `answer`, `ice-candidate`, `hangup`, `reject`, or `busy`
- **WHEN** the background messaging service inspects the parsed signal
- **THEN** the service SHALL discard the rumor without persisting state and without posting any notification

### Requirement: Pending Incoming Call Handoff
On Android, when the activity launches via the Accept full-screen intent, the JS layer SHALL read the persisted incoming-call signal via the plugin's `getPendingIncomingCall` method, clear it via `clearPendingIncomingCall`, dispatch the parsed signal to `voiceCallService.handleSignal`, and immediately invoke `voiceCallService.acceptCall` without showing the in-app `IncomingCallOverlay`. If the persisted signal is missing or expired, the JS layer SHALL surface a "missed call" toast and SHALL NOT enter `incoming-ringing`. A duplicate offer arriving via the live subscription for a call already in `incoming-ringing` for the same `callId` and same `peerNpub` SHALL be ignored rather than producing a `busy` response.

#### Scenario: Activity launch via Accept consumes pending offer
- **GIVEN** the user tapped Accept on the lockscreen full-screen-intent notification
- **WHEN** `MainActivity` launches with intent extra `accept_pending_call=true`
- **THEN** the activity SHALL call `setShowWhenLocked(true)` and `setTurnScreenOn(true)`
- **AND** the activity SHALL call `KeyguardManager.requestDismissKeyguard`
- **AND** the notification router SHALL emit a `routeReceived` event with `kind: 'voice-call-accept'`
- **AND** the JS handler SHALL call `getPendingIncomingCall`, then `clearPendingIncomingCall`, then `voiceCallService.handleSignal`, then `voiceCallService.acceptCall`

#### Scenario: Missing pending offer surfaces missed-call toast
- **GIVEN** the activity launches with `accept_pending_call=true`
- **WHEN** the JS handler calls `getPendingIncomingCall` and receives `{ pending: null }`
- **THEN** the handler SHALL display a missed-call toast
- **AND** the handler SHALL NOT invoke `voiceCallService.handleSignal`

#### Scenario: Duplicate offer for active call is ignored
- **GIVEN** the local status is `incoming-ringing` for a call with `callId=X` and `peerNpub=Y`
- **WHEN** a second `offer` signal arrives with the same `callId=X` from the same `peerNpub=Y`
- **THEN** the system SHALL ignore the duplicate
- **AND** the system SHALL NOT send a `busy` reply

### Requirement: Full-Screen Intent Permission UX
On Android 14+, the system SHALL detect via `NotificationManager.canUseFullScreenIntent()` whether the user has granted full-screen-intent permission. The first time the user initiates or accepts a call, if the permission is not granted, the system SHALL show an explanation modal offering to open the system settings page. If the user skips, the system SHALL record that fact in client storage and SHALL NOT prompt again automatically. Calls SHALL still function via heads-up notifications when the permission is denied; only the lockscreen full-screen ringing UI is degraded.

#### Scenario: First call attempt prompts when permission missing
- **GIVEN** the user initiates a call for the first time on Android 14+
- **AND** `canUseFullScreenIntent()` returns `false`
- **AND** localStorage has no record of a previous skip
- **WHEN** the call is initiated
- **THEN** the system SHALL display a modal explaining full-screen-intent permission with Open-Settings and Skip buttons

#### Scenario: Skip is remembered
- **GIVEN** the user has previously tapped Skip on the full-screen-intent permission modal
- **WHEN** the user initiates another call
- **THEN** the modal SHALL NOT be shown again

#### Scenario: Permission denied falls back to heads-up
- **GIVEN** `canUseFullScreenIntent()` returns `false`
- **WHEN** an incoming voice-call offer is received
- **THEN** the notification SHALL still post on channel `nospeak_voice_call_incoming` at IMPORTANCE_HIGH
- **AND** the notification SHALL display as a heads-up banner
- **AND** tapping Accept SHALL still open the activity (after manual unlock if the device is locked)

### Requirement: Decline Action Best-Effort Reject Signal
On Android, when the user taps the Decline action button on the incoming-call notification, the system SHALL clear the pending-call SharedPreferences and cancel the notification. The system MAY additionally attempt to send a `reject` voice-call signal to the caller through the messaging service's already-connected WebSocket relays; this is best-effort. If no reject is sent, or sending fails, the caller will eventually see a `timeout` end reason. The Phase A implementation accepts the timeout fallback in lieu of a Java-side NIP-59 gift-wrap helper; a future phase MAY implement the actual reject send.

#### Scenario: Decline clears pending state and dismisses notification
- **GIVEN** an incoming-call notification is showing
- **WHEN** the user taps the Decline action button
- **THEN** the SharedPreferences `nospeak_pending_incoming_call` SHALL be cleared
- **AND** the notification SHALL be cancelled

#### Scenario: Decline tolerates offline or absent messaging service
- **GIVEN** the user has tapped Decline
- **AND** the messaging service is not running OR has no connected relays OR the reject helper is a no-op
- **WHEN** the receiver processes the Decline action
- **THEN** the receiver SHALL NOT throw or crash
- **AND** the pending state SHALL still be cleared and the notification SHALL still be cancelled
- **AND** the caller SHALL eventually see a `timeout` end reason for the call
