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

On the **web/PWA build**, ringback SHALL be played via Web Audio. On **Android**, the outgoing ringback SHALL be played by the native foreground service via `ToneGenerator` (see "Native Outgoing Ringback Tone on Android"); the JavaScript Web Audio ringback SHALL NOT play. The incoming ringtone on Android is driven by the system notification channel sound for the native incoming-call notification.

#### Scenario: Incoming ringtone plays during incoming ring
- **GIVEN** the local status transitions to `incoming-ringing`
- **WHEN** the incoming-call overlay is mounted (web) or the incoming-call notification is posted (Android)
- **THEN** the two-tone ringtone SHALL begin playing
- **WHEN** the status transitions away from `incoming-ringing`
- **THEN** the ringtone SHALL stop

#### Scenario: Ringback plays during outgoing ring on web
- **GIVEN** the local status transitions to `outgoing-ringing` on the web/PWA build
- **THEN** the single-tone Web Audio ringback SHALL begin playing
- **WHEN** the status transitions to `connecting`, `active`, or `ended`
- **THEN** the ringback SHALL stop

#### Scenario: Ringback plays from native on Android
- **GIVEN** the local status transitions to `outgoing-ringing` on Android
- **THEN** the foreground service SHALL play the single-tone ringback via native `ToneGenerator`
- **AND** the Web Audio ringback SHALL NOT play
- **WHEN** the status transitions to `connecting`, `active`, or `ended`
- **THEN** the native ringback SHALL stop

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
The system SHALL render an active-call user interface providing mute toggle, speaker toggle, hangup button, and a live duration display, and an incoming-call user interface providing accept and decline buttons. On the **web/PWA build**, both interfaces SHALL be Svelte overlays (`ActiveCallOverlay` and `IncomingCallOverlay`) mounted in the root layout so they are visible regardless of the active route. On **Android**, the active-call interface SHALL be the native `ActiveCallActivity` (see "Native Active-Call Activity on Android") and the Svelte `ActiveCallOverlay` SHALL be gated off (mirroring the existing `IncomingCallOverlay` gating). The incoming-call interface on Android remains the native `IncomingCallActivity`.

#### Scenario: Mute toggles audio track enabled state on web
- **GIVEN** the call is `active` on the web/PWA build
- **WHEN** the user presses the mute button in `ActiveCallOverlay`
- **THEN** the local audio track's `enabled` flag SHALL be set to `false`
- **AND** the mute button SHALL display the muted state
- **WHEN** the user presses the mute button again
- **THEN** the local audio track's `enabled` flag SHALL be set to `true`

#### Scenario: Mute toggles native audio track on Android
- **GIVEN** the call is `active` on Android
- **WHEN** the user presses the mute button in `ActiveCallActivity`
- **THEN** the activity SHALL invoke `NativeVoiceCallManager.toggleMute`
- **AND** the native local audio track's `enabled` flag SHALL be toggled

#### Scenario: Hangup ends the call
- **GIVEN** the call is `active`
- **WHEN** the user presses the hangup button (in either the Svelte overlay or the native ActiveCallActivity)
- **THEN** a `hangup` (kind 25053) signal SHALL be sent to the peer
- **AND** the call SHALL transition to `ended`
- **AND** an ended call event SHALL be persisted

#### Scenario: Incoming overlay accept transitions to connecting
- **GIVEN** the local status is `incoming-ringing`
- **WHEN** the user presses the accept button in the appropriate UI for the platform
- **THEN** the system SHALL request microphone access
- **AND** an `answer` (kind 25051) signal SHALL be sent to the caller
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
On Android, the lockscreen Accept tap on `IncomingCallActivity` SHALL start `VoiceCallForegroundService` directly with `ACTION_ACCEPT_NATIVE` (see "Native Cold-Start Accept on Android"); the JavaScript `incomingCallAcceptHandler` SHALL NOT be invoked. The persisted-offer SharedPreferences slot (`nospeak_pending_incoming_call`) SHALL be the source of truth for the offer SDP, read by the native call manager. The JavaScript layer SHALL receive a post-hoc `callStateChanged` event to update its store. A duplicate offer arriving via the live subscription for a call already in `incoming-ringing` for the same `callId` and same `peerNpub` SHALL be ignored rather than producing a `busy` response.

#### Scenario: Lockscreen accept routes to native FGS
- **GIVEN** the device is locked and an incoming-call full-screen-intent notification is showing
- **WHEN** the user taps Accept on `IncomingCallActivity`
- **THEN** the system SHALL start `VoiceCallForegroundService` with action `ACTION_ACCEPT_NATIVE`
- **AND** `MainActivity` SHALL NOT be on the critical path for the accept
- **AND** the JavaScript `incomingCallAcceptHandler` SHALL NOT be invoked

#### Scenario: Pending offer SharedPreferences slot consumed by native FGS
- **GIVEN** the FGS has started with `ACTION_ACCEPT_NATIVE`
- **WHEN** `NativeVoiceCallManager` initializes
- **THEN** the manager SHALL read the offer SDP from the `nospeak_pending_incoming_call` SharedPreferences slot
- **AND** the manager SHALL clear the slot after consuming it

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
On Android, when the user taps the Decline action button on the incoming-call notification, the system SHALL clear the pending-call SharedPreferences and cancel the notification. The system SHALL additionally send a NIP-AC kind-25054 reject signal to the caller via the existing native `sendVoiceCallReject` helper, and SHALL author and gift-wrap a kind-1405 `declined` chat-history rumor via the native `sendVoiceCallHistoryRumor` helper. Both sends SHALL be best-effort (failures SHALL NOT crash or block the Decline action).

#### Scenario: Decline clears pending state and dismisses notification
- **GIVEN** an incoming-call notification is showing
- **WHEN** the user taps the Decline action button
- **THEN** the SharedPreferences `nospeak_pending_incoming_call` SHALL be cleared
- **AND** the notification SHALL be cancelled

#### Scenario: Decline sends native reject and declined chat-history rumor
- **GIVEN** the user has tapped Decline
- **AND** the messaging service is running with at least one connected relay
- **WHEN** the receiver processes the Decline action
- **THEN** the system SHALL invoke `sendVoiceCallReject` to publish a kind-25054 wrap to the caller's messaging relays
- **AND** the system SHALL invoke `sendVoiceCallHistoryRumor` (or `sendVoiceCallDeclinedEvent` which delegates to it) to gift-wrap and publish a kind-1405 `declined` chat-history rumor to both the caller and the user's own relays

#### Scenario: Decline tolerates offline or absent messaging service
- **GIVEN** the user has tapped Decline
- **AND** the messaging service is not running OR has no connected relays
- **WHEN** the receiver processes the Decline action
- **THEN** the receiver SHALL NOT throw or crash
- **AND** the pending state SHALL still be cleared and the notification SHALL still be cancelled
- **AND** the caller SHALL eventually see a `timeout` end reason for the call if neither send completed

### Requirement: Android Native WebRTC Peer Connection
On Android, the system SHALL host the WebRTC peer connection in a native `NativeVoiceCallManager` class owned by `VoiceCallForegroundService`, using the `io.getstream:stream-webrtc-android` library. The native peer connection SHALL own all WebRTC state (peer connection, ICE candidate buffer, local audio track, remote audio playback, call duration timer) for the entire call lifecycle. The WebView's JavaScript layer SHALL NOT host an `RTCPeerConnection` for calls placed or received on Android.

#### Scenario: Native peer connection used on Android
- **GIVEN** the user is on the Android app shell
- **WHEN** the user initiates or accepts a voice call
- **THEN** the system SHALL construct a native `org.webrtc.PeerConnection` inside `NativeVoiceCallManager`
- **AND** the system SHALL NOT construct an `RTCPeerConnection` in the WebView's JavaScript runtime for this call
- **AND** the peer connection SHALL be configured with the same ICE servers used by the web build

#### Scenario: Native peer connection survives WebView lifecycle
- **GIVEN** an active voice call is connected on Android
- **WHEN** the WebView is backgrounded, throttled, or briefly killed by the operating system
- **THEN** the native peer connection SHALL remain established
- **AND** call audio SHALL continue to play via the native `AudioDeviceModule`
- **AND** the call SHALL NOT enter `ended` state due to WebView lifecycle events alone

#### Scenario: Web build continues to use JavaScript RTCPeerConnection
- **GIVEN** the user is on the web/PWA build (not Android)
- **WHEN** the user initiates or accepts a voice call
- **THEN** the system SHALL construct an `RTCPeerConnection` in the JavaScript runtime as before
- **AND** the native code path SHALL not be invoked

### Requirement: Native Active-Call Activity on Android
On Android, the active-call user interface SHALL be a native Android `ActiveCallActivity` with XML layout. The activity SHALL display the peer's avatar, display name, current call status text, a live duration display, a mute toggle button, a speaker toggle button, and a hangup button. The activity SHALL set `FLAG_SHOW_WHEN_LOCKED` and `FLAG_TURN_SCREEN_ON` so it can be displayed over the device lockscreen. The Svelte `ActiveCallOverlay` SHALL be suppressed on Android via the same gating pattern used for `IncomingCallOverlay`.

#### Scenario: Active-call Activity replaces Svelte overlay on Android
- **GIVEN** the user is on the Android app shell
- **WHEN** the local status transitions to `outgoing-ringing`, `connecting`, or `active`
- **THEN** the system SHALL launch `ActiveCallActivity`
- **AND** the `ActiveCallOverlay.svelte` component SHALL NOT be mounted in the WebView

#### Scenario: Active-call Activity shows over lockscreen
- **GIVEN** the device is locked
- **WHEN** the user accepts a call from the incoming-call full-screen-intent activity
- **THEN** `ActiveCallActivity` SHALL launch with `FLAG_SHOW_WHEN_LOCKED` and `FLAG_TURN_SCREEN_ON`
- **AND** the activity SHALL render without requiring a manual unlock

#### Scenario: Active-call Activity controls drive the native call manager
- **GIVEN** an `ActiveCallActivity` is displayed for an active call
- **WHEN** the user taps the mute button
- **THEN** the system SHALL invoke the native `NativeVoiceCallManager.toggleMute` method
- **AND** the native local audio track's `enabled` flag SHALL be toggled
- **WHEN** the user taps the hangup button
- **THEN** the system SHALL invoke the native hangup path which sends a kind-25053 hangup signal and closes the peer connection
- **WHEN** the user taps the speaker button
- **THEN** the system SHALL invoke `AudioManager.setSpeakerphoneOn` with the toggled value

#### Scenario: Web/PWA continues to use Svelte ActiveCallOverlay
- **GIVEN** the user is on the web/PWA build
- **WHEN** the local status transitions to `outgoing-ringing`, `connecting`, or `active`
- **THEN** the `ActiveCallOverlay.svelte` component SHALL render in the browser as before

### Requirement: Native NIP-AC Inbound Dispatch on Android
On Android, the native background messaging service SHALL dispatch all decrypted NIP-AC inner-event kinds (25050 offer, 25051 answer, 25052 ICE, 25053 hangup, 25054 reject) directly into `NativeVoiceCallManager`. The JavaScript-layer NIP-AC dispatch in `Messaging.ts` SHALL be skipped on Android for these inner kinds. The native handler SHALL verify the inner event's Schnorr (BIP-340) signature before dispatch and SHALL silently drop events whose signature is invalid.

#### Scenario: Inbound answer dispatched to native call manager
- **GIVEN** the user has an outgoing call in `outgoing-ringing` on Android
- **WHEN** a kind-21059 gift wrap is decrypted to an inner event of kind 25051 (answer) for the active call
- **THEN** the native handler SHALL verify the inner event's Schnorr signature
- **AND** on success the system SHALL invoke `NativeVoiceCallManager.handleAnswer` with the SDP
- **AND** the JavaScript layer SHALL NOT also process the same answer

#### Scenario: Inbound ICE candidate dispatched to native call manager
- **WHEN** a kind-21059 gift wrap is decrypted to an inner event of kind 25052 (ICE) for the active call
- **THEN** the system SHALL invoke `NativeVoiceCallManager.handleIceCandidate` with the candidate, sdpMid, and sdpMLineIndex

#### Scenario: Inbound hangup dispatched to native call manager
- **WHEN** a kind-21059 gift wrap is decrypted to an inner event of kind 25053 (hangup) for the active call
- **THEN** the system SHALL invoke `NativeVoiceCallManager.handleHangup` with the reason
- **AND** the call SHALL transition to `ended` with the indicated reason

#### Scenario: Invalid Schnorr signature dropped silently
- **GIVEN** the user is on Android
- **WHEN** a decrypted inner event of any NIP-AC kind has an invalid BIP-340 signature
- **THEN** the system SHALL log the failure
- **AND** the system SHALL NOT dispatch the event to `NativeVoiceCallManager`
- **AND** the system SHALL NOT raise any user-facing notification or state change

### Requirement: Native NIP-AC Outbound Senders on Android
On Android, the system SHALL author and publish NIP-AC inner-event kinds 25050 (offer), 25051 (answer), 25052 (ICE), and 25053 (hangup) from native code via `NativeBackgroundMessagingService` helpers modeled on the existing native `sendVoiceCallReject` (kind 25054) helper. The native senders SHALL produce gift wraps that are byte-equivalent to the JavaScript senders for the same logical input, preserving NIP-AC wire compatibility with the web build and any other NIP-AC-capable client. Each sender SHALL preserve the existing self-wrap behavior so multi-device "answered/rejected/hung-up elsewhere" continues to work for every signal kind.

#### Scenario: Native offer is byte-equivalent to JS offer
- **GIVEN** the same logical inputs (recipientHex, callId, sdp, sender keys, timestamp)
- **WHEN** the native `sendVoiceCallOffer` builds the inner event
- **AND** the JavaScript `sendCallOffer` in `Messaging.ts` builds the inner event with the same inputs
- **THEN** the resulting inner event JSON (with normalized property order) SHALL be byte-equivalent

#### Scenario: Native answer/ICE/hangup self-wrap to sender
- **WHEN** the native call manager sends any of kinds 25051, 25052, or 25053
- **THEN** the system SHALL also publish a self-wrap copy addressed to the sender's own pubkey
- **AND** the self-wrap SHALL use the sender's NIP-17 messaging relay list

#### Scenario: ICE candidates from native target connected relays only
- **WHEN** the native local peer connection emits multiple ICE candidates in rapid succession
- **THEN** the corresponding kind-25052 wraps SHALL be published only to relays already connected at the time of send
- **AND** the system SHALL NOT open transient WebSockets for ICE candidate trickle

### Requirement: Native Cold-Start Accept on Android
On Android, the lockscreen Accept tap on `IncomingCallActivity` SHALL start `VoiceCallForegroundService` directly with an Accept intent. The service SHALL initialize `NativeVoiceCallManager`, build the peer connection, set the remote description from the persisted offer, and send the kind-25051 Answer signal — all without booting `MainActivity` or the JavaScript layer onto the critical path. The system SHALL launch `ActiveCallActivity` as the user-facing surface. The JavaScript layer SHALL receive a `callStateChanged` plugin event after the fact and SHALL update `voiceCallState` in response.

#### Scenario: Lockscreen accept starts FGS without booting MainActivity
- **GIVEN** the device is locked and an incoming-call full-screen-intent notification is showing
- **WHEN** the user taps Accept on `IncomingCallActivity`
- **THEN** the system SHALL start `VoiceCallForegroundService` with action `ACTION_ACCEPT_NATIVE` and the callId extra
- **AND** the system SHALL launch `ActiveCallActivity` over the lockscreen
- **AND** `MainActivity` SHALL NOT be required to render before media establishes
- **AND** `incomingCallAcceptHandler.ts` SHALL NOT be invoked as part of this flow

#### Scenario: Native call manager builds PC and sends Answer immediately
- **GIVEN** the FGS has started with `ACTION_ACCEPT_NATIVE`
- **WHEN** `NativeVoiceCallManager` initializes for the call
- **THEN** the manager SHALL read the persisted offer from `nospeak_pending_incoming_call` SharedPreferences
- **AND** the manager SHALL build the `PeerConnection` and call `setRemoteDescription` with the offer SDP
- **AND** the manager SHALL acquire microphone audio via `PeerConnectionFactory.createAudioSource`
- **AND** the manager SHALL create the answer, set local description, and publish the kind-25051 Answer wrap
- **AND** the local status SHALL transition to `connecting`

#### Scenario: JS state store mirrors native call state
- **GIVEN** the WebView is alive while a native-managed call is in progress
- **WHEN** the native call manager emits a `callStateChanged` plugin event
- **THEN** `VoiceCallServiceNative` SHALL apply the corresponding store mutation (`setOutgoingRinging`, `setIncomingRinging`, `setConnecting`, `setActive`, `endCall`, etc.)
- **AND** existing UI bindings (e.g., chat header call status indicators in JS) SHALL render correctly without modification

### Requirement: PIN-Locked nsec Accept Flow on Android
On Android, when the user has signing mode `nsec` and the local secret key is not currently loaded into memory by `NativeBackgroundMessagingService`, the native call manager SHALL NOT silently fail to send the kind-25051 Answer. Instead, the system SHALL persist the pending accept intent (callId) to the `nospeak_pending_call_unlock` SharedPreferences slot, start the FGS in `ACTION_AWAIT_UNLOCK` mode (which arms a 30-second unlock timeout), and launch `MainActivity` with intent extra `EXTRA_UNLOCK_FOR_CALL=<callId>` and route kind `voice-call-unlock`. The JavaScript unlock handler SHALL wait for the user to enter their PIN AND for `currentUser` to be populated, then call `AndroidVoiceCall.notifyUnlockComplete({ callId })` which fires the `nospeak.ACTION_UNLOCK_COMPLETE` LocalBroadcast. The FGS SHALL receive the broadcast, reload the secret from `EncryptedSharedPreferences`, and resume the accept (build the peer connection, send the Answer). If no unlock broadcast arrives within 30 seconds, the system SHALL send a kind-25054 reject to the caller, clear pending SharedPreferences slots, and stop the FGS.

#### Scenario: Locked nsec accept launches MainActivity with unlock intent
- **GIVEN** signing mode is `nsec` and the local secret key is null in memory (and a cheap reload from `EncryptedSharedPreferences` did not succeed)
- **WHEN** the user taps Accept on the lockscreen incoming-call activity
- **THEN** the native call manager SHALL persist the callId to SharedPreferences key `nospeak_pending_call_unlock`
- **AND** the system SHALL start `VoiceCallForegroundService` with action `ACTION_AWAIT_UNLOCK`
- **AND** the system SHALL launch `MainActivity` with `EXTRA_UNLOCK_FOR_CALL=<callId>` and `FLAG_ACTIVITY_NEW_TASK`

#### Scenario: Successful unlock resumes accept
- **GIVEN** the user has a pending call accept awaiting unlock
- **WHEN** the user successfully enters their PIN AND `currentUser` is populated
- **THEN** the JavaScript handler SHALL call `AndroidVoiceCall.notifyUnlockComplete({ callId })`
- **AND** the plugin SHALL emit a `LocalBroadcastManager` broadcast with action `nospeak.ACTION_UNLOCK_COMPLETE` and the callId extra
- **AND** the FGS SHALL receive the broadcast, reload the local secret, and start itself in `ACTION_ACCEPT_NATIVE`
- **AND** a kind-25051 Answer SHALL be sent to the caller

#### Scenario: Unlock timeout falls back to reject
- **GIVEN** the user has a pending call accept awaiting unlock
- **WHEN** 30 seconds pass without an `ACTION_UNLOCK_COMPLETE` broadcast for this callId
- **THEN** the system SHALL send a kind-25054 reject signal to the caller
- **AND** the system SHALL clear the pending unlock SharedPreferences key
- **AND** the system SHALL clear the `nospeak_pending_incoming_call` slot
- **AND** the system SHALL cancel the incoming-call notification
- **AND** the FGS SHALL stop itself

### Requirement: VoiceCallBackend Abstraction in JavaScript
The JavaScript layer SHALL expose voice calling through a `VoiceCallBackend` interface implemented by two concrete classes: `VoiceCallServiceWeb` (the existing JavaScript WebRTC implementation, used on web/PWA) and `VoiceCallServiceNative` (a thin proxy that forwards method calls to the `AndroidVoiceCall` Capacitor plugin and mirrors plugin events into the existing `voiceCallState` Svelte store, used on Android). A factory module SHALL select the implementation at runtime based on `Capacitor.getPlatform()`. UI components SHALL consume the same `voiceCallService` reference and the same `voiceCallState` store on both platforms without platform-specific branching.

#### Scenario: Factory selects native implementation on Android
- **GIVEN** `Capacitor.getPlatform()` returns `'android'`
- **WHEN** the factory module is imported
- **THEN** the exported `voiceCallService` SHALL be an instance of `VoiceCallServiceNative`

#### Scenario: Factory selects web implementation on browsers
- **GIVEN** `Capacitor.getPlatform()` returns `'web'`
- **WHEN** the factory module is imported
- **THEN** the exported `voiceCallService` SHALL be an instance of `VoiceCallServiceWeb`

#### Scenario: VoiceCallServiceNative mirrors native events into Svelte store
- **GIVEN** `voiceCallService` is a `VoiceCallServiceNative` instance
- **WHEN** the native plugin emits a `callStateChanged` event with `status: 'active'`
- **THEN** the service SHALL update the existing `voiceCallState` store via `setActive`
- **AND** UI components subscribed to the store SHALL re-render without platform-specific code

#### Scenario: VoiceCallServiceNative.getRemoteStream returns null on Android
- **GIVEN** `voiceCallService` is a `VoiceCallServiceNative` instance
- **WHEN** a UI component calls `voiceCallService.getRemoteStream()`
- **THEN** the method SHALL return null because remote audio is played by the native `AudioDeviceModule`

### Requirement: Local-Only Call History Bridge on Android
On Android, the native call manager SHALL emit a `callHistoryWriteRequested` plugin event when a local-only chat-history entry is required (call-event types `missed` and `cancelled`, which are not gift-wrapped over Nostr but are written directly to the local message database). A JavaScript handler in `VoiceCallServiceNative` SHALL receive this event and call the registered `LocalCallEventCreator` (`messageRepo.saveMessage` via `Messaging.createLocalCallEventMessage`) with the corresponding rumor.

#### Scenario: Local-only missed-call event bridged to JS
- **GIVEN** the WebView is alive on Android
- **WHEN** the native call manager determines a missed-call history entry is required
- **THEN** the system SHALL emit a `callHistoryWriteRequested` plugin event with payload `{ type: 'missed', callId, peerHex, initiatorHex }`
- **AND** the JavaScript handler SHALL call the registered `LocalCallEventCreator` with the corresponding rumor
- **AND** the call event SHALL render as a system-style entry in the conversation timeline

### Requirement: Native Outgoing Ringback Tone on Android
On Android, the outgoing ringback tone SHALL be played by the native foreground service using `ToneGenerator` with `TONE_SUP_RINGTONE`, decoupled from the WebView lifecycle. The tone SHALL play for 2 seconds every 4 seconds while in `outgoing-ringing`, matching the JavaScript Web Audio profile. The tone SHALL stop on transition out of `outgoing-ringing`. The JavaScript-layer Web Audio ringback SHALL NOT play on Android.

#### Scenario: Ringback plays from native on outgoing call
- **GIVEN** the user is on Android
- **WHEN** the native call manager transitions to `outgoing-ringing`
- **THEN** the foreground service SHALL begin playing the single-tone ringback via `ToneGenerator`
- **AND** the JavaScript-layer Web Audio ringback SHALL NOT play

#### Scenario: Ringback stops on transition out of outgoing-ringing
- **GIVEN** native ringback is playing during `outgoing-ringing`
- **WHEN** the local status transitions to `connecting`, `active`, or `ended`
- **THEN** the foreground service SHALL stop the ringback playback

