## ADDED Requirements

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

## MODIFIED Requirements

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
