## ADDED Requirements

### Requirement: Camera Permission Acquisition
The system SHALL request camera access only when the local call kind is `video`. On the **web/PWA build**, camera access SHALL be requested as part of `getUserMedia` for the video call's media constraints. On **Android**, the system SHALL expose an `AndroidCamera` Capacitor plugin that mirrors `AndroidMicrophone` with `checkPermission` and `requestPermission` methods backed by the `android.permission.CAMERA` runtime permission. The native voice-call backend SHALL invoke `AndroidCamera.requestPermission` before initiating or accepting any call whose kind is `video`. If the permission is denied, the call SHALL be aborted with a clear user-facing error; the system SHALL NOT silently downgrade a video call to a voice call.

#### Scenario: Web requests camera through getUserMedia
- **GIVEN** the user is on the web/PWA build
- **WHEN** the user initiates a video call
- **THEN** the system SHALL call `getUserMedia` with constraints that include `video: true` (with the configured resolution and `facingMode`)
- **AND** the browser SHALL present its native camera-permission prompt the first time

#### Scenario: Android requests camera permission before initiating video
- **GIVEN** the user is on Android
- **AND** the app does not currently hold the `CAMERA` runtime permission
- **WHEN** the user initiates a video call
- **THEN** the system SHALL invoke `AndroidCamera.requestPermission`
- **AND** the system SHALL NOT start the WebRTC peer connection until the permission is granted

#### Scenario: Android camera permission denied aborts video call
- **GIVEN** the user is on Android
- **WHEN** the user initiates or accepts a video call and the `CAMERA` runtime permission is denied
- **THEN** the call SHALL transition to `ended` with reason `error`
- **AND** the system SHALL surface a user-facing error indicating camera permission is required for video calls
- **AND** the system SHALL NOT downgrade the call to a voice-only call automatically

### Requirement: Local Self-View Rendering
The system SHALL render the local camera capture as a small picture-in-picture self-view during any call whose kind is `video`. On the **web/PWA build**, the self-view SHALL be a muted `<video autoplay playsinline>` element bound to the local `MediaStream`. On **Android**, the self-view SHALL be a small `org.webrtc.SurfaceViewRenderer` in `ActiveCallActivity` that subscribes to the local `VideoTrack` via `addSink`. The self-view SHALL be mirrored when the active camera is the front-facing camera, and SHALL NOT be mirrored when the active camera is the back-facing camera. The self-view SHALL NOT be rendered for calls whose kind is `voice`.

#### Scenario: Self-view appears on outgoing video call
- **GIVEN** the user initiates a video call
- **WHEN** the local status transitions to `outgoing-ringing`
- **THEN** a self-view SHALL be rendered in a corner of the active-call UI
- **AND** the self-view SHALL display frames from the local front-facing camera
- **AND** the self-view SHALL be horizontally mirrored

#### Scenario: Self-view hidden on voice call
- **GIVEN** the user is in any call with kind `voice`
- **WHEN** the active-call UI is rendered
- **THEN** no self-view SHALL be rendered

#### Scenario: Self-view mirroring tracks active camera
- **GIVEN** the user is in an active video call using the front camera
- **WHEN** the user flips to the back camera
- **THEN** the self-view SHALL stop being mirrored
- **WHEN** the user flips back to the front camera
- **THEN** the self-view SHALL resume being mirrored

### Requirement: Remote Video Rendering
The system SHALL render the remote peer's video stream full-screen during any call whose kind is `video`. On the **web/PWA build**, the remote video SHALL be displayed in an `<video autoplay playsinline>` element bound to the remote `MediaStream` returned by the existing `voiceCallService.getRemoteStream()`. On **Android**, the remote video SHALL be displayed in a full-screen `org.webrtc.SurfaceViewRenderer` in `ActiveCallActivity` to which the inbound `VideoTrack` is attached via `addSink` as soon as the track is reported by the peer connection. The active-call controls (mute, camera-off, flip-camera, hangup, speaker) SHALL be overlaid over the remote video with sufficient contrast.

#### Scenario: Remote video appears when first frame arrives
- **GIVEN** the user is in a video call that has transitioned to `active`
- **WHEN** the remote peer connection delivers its first inbound video track
- **THEN** the remote video element / renderer SHALL display the remote video frames

#### Scenario: Remote video element absent on voice call
- **GIVEN** the user is in any call with kind `voice`
- **WHEN** the active-call UI is rendered
- **THEN** no remote-video element / renderer SHALL be visible

#### Scenario: Controls visible over remote video
- **GIVEN** the user is in an active video call
- **WHEN** the active-call UI is rendered
- **THEN** the mute, camera-off, flip-camera, hangup, and speaker controls SHALL be overlaid over the remote video
- **AND** they SHALL remain reachable by tap

### Requirement: Camera On/Off Control
The system SHALL allow the local user to disable and re-enable their outgoing camera during an active video call. The control SHALL be exposed in the active-call UI alongside the existing mute/speaker/hangup controls. On both platforms the control SHALL toggle the local video track's `enabled` flag (`localVideoTrack.enabled = false/true`); the system SHALL NOT renegotiate the SDP, remove the track, or stop the camera capturer when toggling. The peer SHALL receive black/empty frames while the camera is off.

#### Scenario: Camera-off pauses outgoing video without renegotiation
- **GIVEN** the user is in an active video call with the camera on
- **WHEN** the user taps the camera-off button
- **THEN** the local video track's `enabled` flag SHALL be set to `false`
- **AND** the camera capturer SHALL continue running
- **AND** no SDP renegotiation SHALL occur
- **AND** the remote peer SHALL receive black/empty frames

#### Scenario: Camera-on resumes outgoing video
- **GIVEN** the user has the camera off in an active video call
- **WHEN** the user taps the camera-on button
- **THEN** the local video track's `enabled` flag SHALL be set to `true`
- **AND** the remote peer SHALL receive live frames again

#### Scenario: Camera-off control absent on voice call
- **GIVEN** the user is in any call with kind `voice`
- **WHEN** the active-call UI is rendered
- **THEN** the camera-off control SHALL NOT be visible

### Requirement: Camera Flip Control
The system SHALL allow the local user to switch between the front-facing and back-facing camera during an active video call. The control SHALL be exposed in the active-call UI when the call kind is `video`. On the **web/PWA build**, the system SHALL request a new video track via `getUserMedia({video:{facingMode}})` for the opposite facing mode and SHALL swap it into the existing video sender via `RTCRtpSender.replaceTrack`; the previous track SHALL be stopped. On **Android**, the system SHALL invoke `CameraVideoCapturer.switchCamera(handler)` on the active capturer. Neither path SHALL renegotiate the SDP. The local self-view SHALL update its mirroring to match the new active camera.

#### Scenario: Web flip swaps tracks via replaceTrack
- **GIVEN** the user is on the web/PWA build in an active video call using the front camera
- **WHEN** the user taps the flip-camera button
- **THEN** the system SHALL request a new video track with `facingMode: 'environment'`
- **AND** the system SHALL call `replaceTrack(newVideoTrack)` on the existing video sender
- **AND** the previous video track SHALL be stopped
- **AND** the SDP SHALL NOT be renegotiated

#### Scenario: Android flip swaps physical cameras via switchCamera
- **GIVEN** the user is on Android in an active video call using the front camera
- **WHEN** the user taps the flip-camera button
- **THEN** the system SHALL invoke `CameraVideoCapturer.switchCamera` on the active capturer
- **AND** the same `VideoSource` and `VideoTrack` SHALL continue serving the peer connection
- **AND** the SDP SHALL NOT be renegotiated

#### Scenario: Self-view mirroring updates after flip
- **GIVEN** the user has flipped from the front camera to the back camera
- **WHEN** the flip completes successfully
- **THEN** the local self-view SHALL stop being mirrored

### Requirement: Default Speaker Routing on Video Calls
The system SHALL default the speaker output to ON when a call whose kind is `video` transitions to `active`. The user SHALL still be able to toggle the speaker off via the existing speaker control. For calls whose kind is `voice`, the existing audio routing behavior SHALL be unchanged.

#### Scenario: Video call defaults to speakerphone on Android
- **GIVEN** the user is on Android
- **WHEN** a video call transitions from `connecting` to `active`
- **THEN** `AudioManager.setSpeakerphoneOn(true)` SHALL be invoked
- **AND** the in-call store flag `isSpeakerOn` SHALL be set to `true`

#### Scenario: User can toggle speaker off during video call
- **GIVEN** a video call is `active` with speakerphone on
- **WHEN** the user taps the speaker control
- **THEN** the speaker output SHALL toggle off
- **AND** the in-call store flag `isSpeakerOn` SHALL be set to `false`

#### Scenario: Voice call audio routing unchanged
- **GIVEN** a call whose kind is `voice` transitions to `active`
- **THEN** speaker routing SHALL follow the existing default (off; user-controlled)

## MODIFIED Requirements

### Requirement: Voice Call Lifecycle
The system SHALL support a complete one-to-one call lifecycle for both voice and video calls with the following statuses: `idle`, `outgoing-ringing`, `incoming-ringing`, `connecting`, `active`, `ended`. Each call SHALL carry a `callKind` value of `'voice'` or `'video'` that is fixed for the lifetime of the call (no mid-call upgrade). The system SHALL transition between statuses in response to local user actions (initiate, accept, decline, hangup, mute, camera-off, camera-flip) and signaling events received from the remote peer (Call Offer kind 25050, Call Answer kind 25051, ICE Candidate kind 25052, Call Hangup kind 25053, Call Reject kind 25054). Only one call SHALL be active at any time per client. The `ended` state SHALL carry one of the following end reasons: `hangup`, `rejected`, `busy`, `timeout`, `ice-failed`, `error`, `answered-elsewhere`, `rejected-elsewhere`.

#### Scenario: Successful call setup and termination
- **GIVEN** the user is `idle` and authenticated
- **WHEN** the user initiates a call to a contact
- **THEN** the local status SHALL transition to `outgoing-ringing`
- **AND** the local `callKind` SHALL be set to the kind chosen by the initiator
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

#### Scenario: Incoming offer with call-type video sets video kind
- **GIVEN** the user is `idle` and the offer's sender is in the user's contact list
- **WHEN** a Call Offer (kind 25050) arrives carrying tag `['call-type', 'video']`
- **THEN** the local status SHALL transition to `incoming-ringing`
- **AND** the local `callKind` SHALL be set to `'video'`

#### Scenario: Incoming offer without call-type tag defaults to voice
- **GIVEN** the user is `idle` and the offer's sender is in the user's contact list
- **WHEN** a Call Offer (kind 25050) arrives that does NOT carry a `call-type` tag
- **THEN** the local status SHALL transition to `incoming-ringing`
- **AND** the local `callKind` SHALL default to `'voice'`

### Requirement: Voice Signaling Transport
The system SHALL transmit WebRTC signaling messages as NIP-AC ephemeral gift wraps of kind `21059`. The inner signaling event SHALL be one of the following kinds, signed by the sender's real key:

| Kind  | Name           | `content`                                                                                       |
|-------|----------------|--------------------------------------------------------------------------------------------------|
| 25050 | Call Offer     | Raw SDP offer string                                                                             |
| 25051 | Call Answer    | Raw SDP answer string                                                                            |
| 25052 | ICE Candidate  | JSON string `{"candidate":...,"sdpMid":...,"sdpMLineIndex":...}`                                 |
| 25053 | Call Hangup    | Empty string OR human-readable reason                                                            |
| 25054 | Call Reject    | Empty string OR `"busy"` for auto-reject from a non-idle state                                   |

Every inner signaling event SHALL include the tags `['p', <recipient-hex>]`, `['call-id', <UUID>]`, and `['alt', <human-readable-description>]`. Call Offer events (kind 25050) SHALL additionally include a `['call-type', <kind>]` tag where `<kind>` is one of `'voice'` or `'video'`. Receivers SHALL default to `'voice'` when the `call-type` tag is missing on a Call Offer. Inner signaling events for kinds 25051, 25052, 25053, and 25054 SHALL NOT carry a `call-type` tag — those kinds are media-agnostic and the SDP carried in 25051 is the source of truth for negotiated tracks. Inner signaling events SHALL NOT carry an `expiration` tag — the ephemeral kind range conveys transience. The gift wrap (kind 21059) SHALL have a single `['p', <recipient-hex>]` tag, no `expiration` tag, and SHALL be signed with a freshly generated ephemeral key. The wrap content SHALL be the NIP-44 v2 ciphertext of the signed inner event JSON. The system SHALL NOT use the NIP-13 seal layer for signaling. The system SHALL NOT persist signaling events to the local database. The system SHALL NOT create a self-wrap for Call Offer (25050), ICE Candidate (25052), or Call Hangup (25053) events.

#### Scenario: Voice Call Offer event structure
- **WHEN** the system sends a Call Offer for a voice call
- **THEN** the inner event SHALL have `kind: 25050` and `content` equal to the raw SDP offer string
- **AND** the inner event tags SHALL include `['p', <recipient-hex>]`, `['call-id', <UUID>]`, `['call-type', 'voice']`, and `['alt', <human-readable>]`
- **AND** the inner event SHALL be signed by the sender's real key
- **AND** the wrap SHALL have `kind: 21059`, a single `['p', <recipient-hex>]` tag, no `expiration` tag, and SHALL be signed by a fresh ephemeral key
- **AND** the wrap `content` SHALL be the NIP-44 v2 ciphertext of the signed inner event

#### Scenario: Video Call Offer event structure
- **WHEN** the system sends a Call Offer for a video call
- **THEN** the inner event SHALL have `kind: 25050` and `content` equal to the raw SDP offer string
- **AND** the inner event tags SHALL include `['p', <recipient-hex>]`, `['call-id', <UUID>]`, `['call-type', 'video']`, and `['alt', <human-readable>]`
- **AND** the SDP SHALL describe both an audio m-line and a video m-line in the offer

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

#### Scenario: Missing call-type tag defaults to voice
- **WHEN** the system receives a Call Offer (kind 25050) whose tags do NOT include a `call-type` entry
- **THEN** the receiving system SHALL treat the offer as if `['call-type', 'voice']` were present
- **AND** the receiving system SHALL not raise any error

### Requirement: Audio Capture Constraints
The system SHALL request microphone access with `echoCancellation`, `noiseSuppression`, and `autoGainControl` enabled for every call regardless of kind. For calls whose kind is `voice`, the system SHALL NOT request video. For calls whose kind is `video`, the system SHALL additionally request video with the constraints defined in the Video Capture Constraints requirement. On call end, all captured media tracks (audio and, where applicable, video) SHALL be stopped and released, the camera capturer (Android) SHALL be stopped and disposed, and the `RTCPeerConnection` SHALL be closed.

#### Scenario: Microphone requested with audio processing enabled for voice
- **WHEN** the system calls `getUserMedia` for a voice call
- **THEN** the constraints SHALL specify `audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }`
- **AND** the constraints SHALL specify `video: false`

#### Scenario: Microphone and camera requested for video
- **WHEN** the system calls `getUserMedia` for a video call
- **THEN** the constraints SHALL specify `audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }`
- **AND** the constraints SHALL specify `video` per the Video Capture Constraints requirement

#### Scenario: Media tracks released on call end
- **GIVEN** a call has been `active`
- **WHEN** the call transitions to `ended`
- **THEN** every track on the local stream SHALL be stopped
- **AND** if a video capturer was running on Android it SHALL be stopped and disposed
- **AND** the `RTCPeerConnection` SHALL be closed

### Requirement: Active Call Controls
The system SHALL render an active-call user interface providing mute toggle, speaker toggle, hangup button, and a live duration display, and an incoming-call user interface providing accept and decline buttons. When the call kind is `video`, the active-call UI SHALL additionally render a camera-off toggle and a camera-flip control as specified in the Camera On/Off Control and Camera Flip Control requirements. On the **web/PWA build**, both interfaces SHALL be Svelte overlays (`ActiveCallOverlay` and `IncomingCallOverlay`) mounted in the root layout so they are visible regardless of the active route. On **Android**, the active-call interface SHALL be the native `ActiveCallActivity` (see "Native Active-Call Activity on Android") and the Svelte `ActiveCallOverlay` SHALL be gated off (mirroring the existing `IncomingCallOverlay` gating). The incoming-call interface on Android remains the native `IncomingCallActivity`.

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
- **THEN** the system SHALL request microphone access (and camera access if `callKind === 'video'`)
- **AND** an `answer` (kind 25051) signal SHALL be sent to the caller
- **AND** the local status SHALL transition to `connecting`

#### Scenario: Video controls hidden for voice calls
- **GIVEN** the call is `active` and `callKind === 'voice'`
- **WHEN** the active-call UI is rendered
- **THEN** the camera-off control SHALL NOT be visible
- **AND** the camera-flip control SHALL NOT be visible

#### Scenario: Video controls visible for video calls
- **GIVEN** the call is `active` and `callKind === 'video'`
- **WHEN** the active-call UI is rendered
- **THEN** the camera-off control SHALL be visible and clickable
- **AND** the camera-flip control SHALL be visible and clickable

### Requirement: Lock-Screen Incoming Call Notification
On Android, when the existing background messaging service decrypts a kind 21059 ephemeral gift wrap whose inner event is a Call Offer (kind 25050) with a future-or-present `created_at` (no older than 60 seconds), and whose sender pubkey passes the follow-gate (is in the user's NIP-02 contact list), the service SHALL persist the offer to SharedPreferences and post a high-priority notification on a dedicated channel `nospeak_voice_call_incoming`. The notification SHALL include a full-screen intent targeting `MainActivity` with extras `accept_pending_call=true`, `call_id=<callId>`, and `nospeak_route_kind=voice-call-accept`. The notification SHALL include Accept and Decline action buttons. The notification's title and small icon SHALL reflect the offer's `call-type` tag value: `"Voice call from <name>"` with a phone icon when the value is `'voice'` (or absent), and `"Video call from <name>"` with a video-camera icon when the value is `'video'`. For NIP-AC inner events of any other kind (25051, 25052, 25053, 25054) received while the app is closed, the service SHALL discard the event without posting any notification. The persisted SharedPreferences slot `nospeak_pending_incoming_call` SHALL include `callId`, `sdp`, `peerHex`, `callType`, `alt`, `innerEventId`, and `createdAt`. The `callType` field SHALL contain the literal string `'voice'` or `'video'` extracted from the inner event's `call-type` tag (defaulting to `'voice'` when absent). Old-shape entries from prior versions (lacking the new keys) SHALL be ignored on first read after upgrade.

#### Scenario: Voice Call Offer triggers full-screen-intent notification
- **GIVEN** the background messaging service is running and connected to relays
- **WHEN** a kind 21059 gift wrap arrives whose decrypted signed inner event is kind 25050 with `created_at` within the last 60 seconds, whose `call-type` tag equals `'voice'` (or is absent), and whose sender is in the user's contact list
- **THEN** the service SHALL write `callId`, `sdp`, `peerHex`, `callType='voice'`, `alt`, `innerEventId`, and `createdAt` to SharedPreferences `nospeak_pending_incoming_call`
- **AND** the service SHALL post a notification on channel `nospeak_voice_call_incoming` whose title reads `"Voice call from <name>"` and whose small icon is the phone icon
- **AND** the service SHALL set the notification's `setFullScreenIntent` to a `MainActivity` PendingIntent carrying the route extras
- **AND** the service SHALL NOT post a chat-message notification for this event

#### Scenario: Video Call Offer triggers full-screen-intent notification
- **GIVEN** the background messaging service is running and connected to relays
- **WHEN** a kind 21059 gift wrap arrives whose decrypted signed inner event is kind 25050 with `created_at` within the last 60 seconds, whose `call-type` tag equals `'video'`, and whose sender is in the user's contact list
- **THEN** the service SHALL write `callType='video'` (along with the other fields) to SharedPreferences `nospeak_pending_incoming_call`
- **AND** the service SHALL post a notification whose title reads `"Video call from <name>"` and whose small icon is the video-camera icon

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
On Android, when the activity launches via the Accept full-screen intent, the JS layer SHALL read the persisted incoming-call payload via the plugin's `getPendingIncomingCall` method, clear it via `clearPendingIncomingCall`, hand the parsed Call Offer to `voiceCallService.handleNipAcEvent`, and immediately invoke `voiceCallService.acceptCall` without showing the in-app `IncomingCallOverlay`. The persisted payload's `callType` field SHALL be propagated to the call backend so the backend's local `callKind` matches the offer. If the persisted payload is missing or its `createdAt` is more than 60 seconds in the past, the JS layer SHALL surface a "missed call" toast and SHALL NOT enter `incoming-ringing`. A duplicate Call Offer arriving via the live subscription for a call already in `incoming-ringing` for the same `callId` and same `peerNpub` SHALL be ignored rather than producing a `busy` response. The PIN-locked-nsec resumption flow (see "PIN-Locked nsec Accept Flow on Android") SHALL preserve the persisted `callType` across the unlock cycle so the resumed accept negotiates the correct media constraints.

#### Scenario: Activity launch via Accept consumes pending offer
- **GIVEN** the user tapped Accept on the lockscreen full-screen-intent notification
- **WHEN** `MainActivity` launches with intent extra `accept_pending_call=true`
- **THEN** the activity SHALL call `setShowWhenLocked(true)` and `setTurnScreenOn(true)`
- **AND** the activity SHALL call `KeyguardManager.requestDismissKeyguard`
- **AND** the notification router SHALL emit a `routeReceived` event with `kind: 'voice-call-accept'`
- **AND** the JS handler SHALL call `getPendingIncomingCall`, then `clearPendingIncomingCall`, then `voiceCallService.handleNipAcEvent`, then `voiceCallService.acceptCall`
- **AND** the call backend's `callKind` SHALL equal the persisted payload's `callType`

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

#### Scenario: Video call kind preserved across PIN-unlock resumption
- **GIVEN** the user has signing mode `nsec` with the secret PIN-locked
- **AND** an incoming video Call Offer has been persisted to SharedPreferences with `callType='video'`
- **WHEN** the user enters their PIN and the FGS resumes the accept
- **THEN** the resumed accept SHALL build the peer connection with both audio and video transceivers
- **AND** the `NativeVoiceCallManager.acceptIncomingCall` invocation SHALL receive `callKind=video`

### Requirement: Native Active-Call Activity on Android
On Android, the active-call user interface SHALL be a native Android `ActiveCallActivity` with XML layout. The activity SHALL display the peer's avatar, display name, current call status text, a live duration display, a mute toggle button, a speaker toggle button, and a hangup button. When the active call's kind is `video`, the activity SHALL additionally display a full-screen `org.webrtc.SurfaceViewRenderer` for the remote video, a small picture-in-picture `org.webrtc.SurfaceViewRenderer` for the local self-view, a camera-off toggle button, and a camera-flip button; both renderers SHALL share the same `EglBase` context as the `NativeVoiceCallManager`. The renderers SHALL be hidden (`View.GONE`) when the active call's kind is `voice`. The activity SHALL set `FLAG_SHOW_WHEN_LOCKED` and `FLAG_TURN_SCREEN_ON` so it can be displayed over the device lockscreen. The Svelte `ActiveCallOverlay` SHALL be suppressed on Android via the same gating pattern used for `IncomingCallOverlay`.

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

#### Scenario: SurfaceViewRenderers attached on video call
- **GIVEN** an `ActiveCallActivity` is displayed for a video call
- **WHEN** the activity binds to the foreground service
- **THEN** the activity SHALL retrieve the `EglBase` from `NativeVoiceCallManager`
- **AND** the activity SHALL call `init` on both the remote and local `SurfaceViewRenderer` views with that `EglBase`'s `getEglBaseContext()`
- **AND** when the manager reports the inbound `VideoTrack`, the activity SHALL call `addSink(remoteRenderer)` on the track
- **AND** when the manager reports the local `VideoTrack`, the activity SHALL call `addSink(localRenderer)` on the track
- **AND** on `onDestroy`, the activity SHALL `release` both renderers but SHALL NOT release the `EglBase`

#### Scenario: SurfaceViewRenderers hidden on voice call
- **GIVEN** an `ActiveCallActivity` is displayed for a voice call
- **WHEN** the activity is rendered
- **THEN** the remote and local `SurfaceViewRenderer` views SHALL be `View.GONE`
- **AND** the camera-off and camera-flip buttons SHALL be `View.GONE`

### Requirement: Android Voice-Call Foreground Service Lifecycle
On Android, the system SHALL run a foreground service of type `phoneCall` for the entire duration of any call (voice or video), starting when the local status enters `outgoing-ringing` or `incoming-ringing` and stopping when the status enters `ended`. The service SHALL acquire a `PARTIAL_WAKE_LOCK` while running and SHALL release it when stopped. The service SHALL NOT auto-restart if killed by the system (`START_NOT_STICKY`); a system-killed call is unrecoverable and the user will see the call drop. The service's ongoing notification title SHALL reflect the call's kind: `"Voice call with <name>"` (and a phone icon) for `callKind === 'voice'`, and `"Video call with <name>"` (and a video-camera icon) for `callKind === 'video'`.

#### Scenario: Outgoing call starts the foreground service
- **GIVEN** the user initiates a call on Android
- **WHEN** the local status transitions to `outgoing-ringing`
- **THEN** the JS layer SHALL invoke the Android voice-call plugin's `initiateCall` method with the callId, peer hex, peer display name, role `outgoing`, and call kind
- **AND** the native `VoiceCallForegroundService` SHALL start with foreground service type `phoneCall`
- **AND** the service SHALL acquire a partial wake lock named `nospeak:voice-call`

#### Scenario: Incoming call accept starts the foreground service
- **GIVEN** the user accepts an incoming call on Android (whether from the in-app overlay or the lockscreen full-screen-intent)
- **WHEN** the local status transitions to `connecting`
- **THEN** the JS layer SHALL invoke `acceptCall` with the callId; the FGS reads the persisted `callType` from SharedPreferences

#### Scenario: Call end stops the foreground service
- **GIVEN** an Android call is active
- **WHEN** the local status transitions to `ended`
- **THEN** the JS layer SHALL invoke the plugin's `endCallSession` method
- **AND** the native service SHALL release the wake lock and call `stopForeground` and `stopSelf`

#### Scenario: Notification reflects call kind
- **GIVEN** an Android call is in any non-`ended` state
- **WHEN** the foreground service builds its ongoing notification
- **THEN** the notification's title SHALL contain `"Voice call"` if the active call's kind is `voice` and `"Video call"` if it is `video`
- **AND** the notification's small icon SHALL be a phone icon for `voice` calls and a video-camera icon for `video` calls

### Requirement: VoiceCallBackend Abstraction in JavaScript
The JavaScript layer SHALL expose voice and video calling through a `VoiceCallBackend` interface implemented by two concrete classes: `VoiceCallServiceWeb` (the existing JavaScript WebRTC implementation, used on web/PWA) and `VoiceCallServiceNative` (a thin proxy that forwards method calls to the `AndroidVoiceCall` Capacitor plugin and mirrors plugin events into the existing `voiceCallState` Svelte store, used on Android). The interface SHALL expose the following methods relevant to call kind:

- `initiateCall(recipientNpub: string, kind?: CallKind): Promise<void>` — `kind` defaults to `'voice'`.
- `acceptCall(): Promise<void>` — uses the kind already determined from the inbound offer.
- `getCallKind(): CallKind` — returns the current call's kind, or `'voice'` when idle.
- `getLocalStream(): MediaStream | null` — returns the local capture stream on web for self-view; returns `null` on Android (renderers consume the native track directly).
- `toggleCamera(): Promise<void>` — flips the local video track's `enabled` flag; no-op on voice calls.
- `flipCamera(): Promise<void>` — switches between front and back camera; no-op on voice calls.
- `isCameraOff(): boolean` — current camera-off state; always `false` on voice calls.

A factory module SHALL select the implementation at runtime based on `Capacitor.getPlatform()`. UI components SHALL consume the same `voiceCallService` reference and the same `voiceCallState` store on both platforms without platform-specific branching.

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
- **THEN** the method SHALL return null because remote audio (and remote video) are rendered by native code

#### Scenario: initiateCall accepts a kind parameter
- **WHEN** a UI component calls `voiceCallService.initiateCall(npub, 'video')`
- **THEN** the backend SHALL set its internal `callKind` to `'video'`
- **AND** the outgoing kind 25050 offer SHALL include `['call-type', 'video']`
- **AND** the local store's `callKind` field SHALL be updated to `'video'`

#### Scenario: getLocalStream returns a stream on web for video calls
- **GIVEN** `voiceCallService` is a `VoiceCallServiceWeb` instance during an active video call
- **WHEN** a UI component calls `voiceCallService.getLocalStream()`
- **THEN** the method SHALL return the local `MediaStream` containing the audio and video tracks

### Requirement: Call History via Kind 1405 Events
The system SHALL persist call history as NIP-17 gift-wrapped Kind 1405 rumor events sent to both the initiator and the recipient (via standard NIP-59 self-wrap behavior). Each call-event rumor SHALL include the following tags: `['p', <recipient-pubkey>]`, `['type', 'call-event']`, `['call-event-type', <type>]` where `<type>` is one of `missed`, `ended`, `no-answer`, `declined`, `busy`, `failed`, `cancelled`, `['call-initiator', <initiator-pubkey>]`, and `['call-media-type', <kind>]` where `<kind>` is one of `'voice'` or `'video'`. Receivers SHALL default the media type to `'voice'` when the `call-media-type` tag is absent (back-compat with rumors written by older builds). When the call event represents a completed conversation, the rumor SHALL include a `['call-duration', <seconds>]` tag with the call duration in seconds. The rumor `content` SHALL be the empty string. Call events SHALL be saved to the local message database and rendered as system-style entries in the conversation timeline. Call-event rumors are nospeak-specific and are NOT defined by NIP-AC; they continue to use the existing 3-layer NIP-17 gift-wrap pipeline (kind 14 rumor inside kind 13 seal inside kind 1059 wrap), distinct from the NIP-AC kind 21059 signaling pipeline.

#### Scenario: Ended-call event includes duration and media type
- **GIVEN** a video call between A and B was `active` for 47 seconds
- **WHEN** either party hangs up
- **THEN** a Kind 1405 rumor SHALL be sent with tags including `['call-event-type', 'ended']`, `['call-duration', '47']`, and `['call-media-type', 'video']`
- **AND** the rumor SHALL be persisted to the local message database
- **AND** the rumor SHALL be rendered as a centered system-style entry in the conversation

#### Scenario: Voice call ended event includes voice media type
- **GIVEN** a voice call between A and B was `active` for 30 seconds
- **WHEN** either party hangs up
- **THEN** the Kind 1405 rumor SHALL include `['call-media-type', 'voice']`

#### Scenario: Missed-call event sent when incoming call goes unanswered
- **GIVEN** the user is `incoming-ringing` and the caller hangs up before the user accepts
- **WHEN** the system processes the caller's Call Hangup (kind 25053)
- **THEN** a Kind 1405 rumor SHALL be sent with `['call-event-type', 'missed']`, the kind-appropriate `['call-media-type', <kind>]`, and no `call-duration` tag

#### Scenario: Call event rendered with initiator and direction
- **WHEN** the conversation timeline includes a Kind 1405 message with tags `['call-event-type', 'ended']`, `['call-duration', '47']`, `['call-initiator', <my-pubkey>]`
- **THEN** the message SHALL be rendered with text indicating an outgoing call lasting 47 seconds
- **AND** if the message includes `['call-media-type', 'video']`, the rendering SHALL include a video-camera affordance to distinguish it from a voice call

#### Scenario: Older rumor without call-media-type defaults to voice
- **GIVEN** a Kind 1405 rumor written by an older build lacks the `call-media-type` tag
- **WHEN** the rumor is rendered in the conversation timeline
- **THEN** the rendering SHALL treat the call as `voice` (default) without raising any error

### Requirement: Android Video-Call Chrome Auto-Hide
On the Android build, the active-call UI SHALL auto-hide its top header (status, peer name, duration) and bottom control row (mute, camera-off, hangup, flip-camera, speaker) after 3 seconds of touch inactivity once a video call has reached the `active` state and the remote `SurfaceViewRenderer` has rendered its first frame. Any touch on the activity SHALL fade the chrome back in within ~200 ms and restart the 3-second auto-hide timer. While the chrome is hidden, the system status and navigation bars SHALL also be hidden using `WindowInsetsController` with `BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE` so the remote video occupies the full display, and SHALL be re-shown together with the chrome on the next touch. The local self-view picture-in-picture SHALL remain visible at all times regardless of chrome state. Chrome SHALL remain visible (and the auto-hide timer cancelled) whenever the call status is `outgoing-ringing`, `incoming-ringing`, `connecting`, or `ended`, or whenever Accessibility touch-exploration (TalkBack) is active. Voice calls and the web/PWA build SHALL NOT be affected by this behavior.

#### Scenario: Chrome auto-hides after inactivity
- **GIVEN** the user is on Android in a video call that has reached the `active` state
- **AND** the remote `SurfaceViewRenderer` has rendered its first frame
- **WHEN** the user does not touch the screen for 3 seconds
- **THEN** the top header and bottom controls SHALL fade to invisible
- **AND** the system status and navigation bars SHALL be hidden
- **AND** the local self-view PiP SHALL remain visible

#### Scenario: Tap reveals chrome and resets timer
- **GIVEN** the chrome is currently hidden during an active video call
- **WHEN** the user taps anywhere on the screen
- **THEN** the top header, bottom controls, and system bars SHALL fade back in
- **AND** a fresh 3-second auto-hide timer SHALL be started

#### Scenario: Pre-active call keeps chrome visible
- **GIVEN** the user is on Android in a video call whose status is `outgoing-ringing`, `incoming-ringing`, or `connecting`
- **WHEN** any amount of time passes without touch input
- **THEN** the top header and bottom controls SHALL remain visible
- **AND** no auto-hide timer SHALL be in flight

#### Scenario: Ended-call linger keeps chrome visible
- **GIVEN** an Android video call has just transitioned to `ended`
- **THEN** any pending auto-hide SHALL be cancelled
- **AND** the chrome SHALL be visible for the entire ended-state linger so the user can read the end-reason text

#### Scenario: Accessibility services keep chrome visible
- **GIVEN** TalkBack / touch-exploration is enabled on the device
- **WHEN** the user is in any Android video call
- **THEN** the chrome SHALL remain visible for the entire call regardless of touch inactivity

#### Scenario: Voice calls unaffected
- **GIVEN** the user is on Android in an active voice (non-video) call
- **THEN** the centered voice-call layout SHALL behave exactly as before
- **AND** no auto-hide SHALL apply to its controls
