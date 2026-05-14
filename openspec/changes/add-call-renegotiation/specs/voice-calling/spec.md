# voice-calling delta — Add NIP-AC Call Renegotiate (kind 25055)

## MODIFIED Requirements

### Requirement: Voice Signaling Transport
The system SHALL transmit WebRTC signaling messages as NIP-AC ephemeral gift wraps of kind `21059`. The inner signaling event SHALL be one of the following kinds, signed by the sender's real key:

| Kind  | Name              | `content`                                                                                       |
|-------|-------------------|--------------------------------------------------------------------------------------------------|
| 25050 | Call Offer        | Raw SDP offer string                                                                             |
| 25051 | Call Answer       | Raw SDP answer string                                                                            |
| 25052 | ICE Candidate     | JSON string `{"candidate":...,"sdpMid":...,"sdpMLineIndex":...}`                                 |
| 25053 | Call Hangup       | Empty string OR human-readable reason                                                            |
| 25054 | Call Reject       | Empty string OR `"busy"` for auto-reject from a non-idle state                                   |
| 25055 | Call Renegotiate  | Raw SDP offer string for a mid-call SDP change                                                   |

Every inner signaling event SHALL include the tags `['p', <recipient-hex>]`, `['call-id', <UUID>]`, and `['alt', <human-readable-description>]`. Call Offer events (kind 25050) SHALL additionally include `['call-type', <'voice'|'video'>]`. Call Renegotiate events (kind 25055) SHALL NOT carry a `['call-type', ...]` tag — the original kind-25050 offer is the sole authority for the call's `call-type`. Inner signaling events SHALL NOT carry an `expiration` tag — the ephemeral kind range conveys transience. The gift wrap (kind 21059) SHALL have a single `['p', <recipient-hex>]` tag, no `expiration` tag, and SHALL be signed with a freshly generated ephemeral key. The wrap content SHALL be the NIP-44 v2 ciphertext of the signed inner event JSON. The system SHALL NOT use the NIP-13 seal layer for signaling. The system SHALL NOT persist signaling events to the local database. The system SHALL NOT create a self-wrap for Call Offer (25050), ICE Candidate (25052), Call Hangup (25053), or Call Renegotiate (25055) events.

#### Scenario: Call Offer event structure
- **WHEN** the system sends a Call Offer
- **THEN** the inner event SHALL have `kind: 25050` and `content` equal to the raw SDP offer string
- **AND** the inner event tags SHALL include `['p', <recipient-hex>]`, `['call-id', <UUID>]`, `['call-type', <'voice'|'video'>]`, and `['alt', <human-readable>]`
- **AND** the inner event SHALL be signed by the sender's real key
- **AND** the wrap SHALL have `kind: 21059`, a single `['p', <recipient-hex>]` tag, no `expiration` tag, and SHALL be signed by a fresh ephemeral key
- **AND** the wrap `content` SHALL be the NIP-44 v2 ciphertext of the signed inner event

#### Scenario: ICE Candidate content shape
- **WHEN** the system sends an ICE Candidate
- **THEN** the inner event SHALL have `kind: 25052`
- **AND** `content` SHALL be a JSON string with exactly the fields `candidate`, `sdpMid`, and `sdpMLineIndex`
- **AND** quotes and backslashes in the SDP fragment SHALL be JSON-escaped

#### Scenario: Call Renegotiate event structure
- **WHEN** the system sends a Call Renegotiate
- **THEN** the inner event SHALL have `kind: 25055` and `content` equal to the raw SDP offer string for the renegotiation
- **AND** the inner event tags SHALL include `['p', <recipient-hex>]`, `['call-id', <UUID matching the active call>]`, and `['alt', 'WebRTC call renegotiation']`
- **AND** the inner event tags SHALL NOT include any `['call-type', ...]` tag
- **AND** the inner event SHALL be signed by the sender's real key
- **AND** the wrap SHALL have `kind: 21059`, a single `['p', <recipient-hex>]` tag, no `expiration` tag, and SHALL be signed by a fresh ephemeral key
- **AND** the system SHALL NOT publish a self-wrap copy for the renegotiate event

#### Scenario: Received signal routed to call service and not persisted
- **WHEN** a kind 21059 gift wrap is decrypted to a signed inner event of kind 25050, 25051, 25052, 25053, 25054, or 25055
- **THEN** the inner event SHALL be dispatched to the voice call service
- **AND** the inner event SHALL NOT be saved to the message database
- **AND** the inner event SHALL NOT be rendered as a chat message

#### Scenario: Legacy kind-14 voice-call rumor silently ignored
- **GIVEN** an older client publishes a kind 14 rumor with `['type','voice-call']`
- **WHEN** the new client decrypts the wrap
- **THEN** the rumor SHALL NOT be dispatched to the voice call service
- **AND** the rumor SHALL NOT trigger any user-facing notification

### Requirement: NIP-AC Self-Event Filter
On receive, the system SHALL apply the following filter to inner signaling events whose `pubkey` equals the user's own public key:

- Kind **25052 (ICE Candidate)**, kind **25053 (Call Hangup)**, and kind **25055 (Call Renegotiate)** from self SHALL always be ignored.
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

#### Scenario: Self renegotiate ignored
- **GIVEN** the local status is `connecting` or `active`
- **WHEN** a kind 25055 inner event arrives whose `pubkey` equals the user's own pubkey
- **THEN** the event SHALL NOT be applied to any peer connection
- **AND** the local status SHALL be unchanged
- **AND** the local renegotiation state SHALL be unchanged

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

### Requirement: Active Call Controls
The system SHALL render an active-call user interface providing mute toggle, speaker toggle, hangup button, and a live duration display, and an incoming-call user interface providing accept and decline buttons. On the **web/PWA build**, both interfaces SHALL be Svelte overlays (`ActiveCallOverlay` and `IncomingCallOverlay`) mounted in the root layout so they are visible regardless of the active route. On **Android**, the active-call interface SHALL be the native `ActiveCallActivity` (see "Native Active-Call Activity on Android") and the Svelte `ActiveCallOverlay` SHALL be gated off (mirroring the existing `IncomingCallOverlay` gating). The incoming-call interface on Android remains the native `IncomingCallActivity`.

The active-call user interface SHALL additionally render an "Add video" button when ALL of the following conditions hold:

- the call's `callKind` is `'voice'`
- the local status is `'active'`
- the renegotiation state is `'idle'`

The button SHALL invoke `voiceCallService.requestVideoUpgrade()` on activation. While the renegotiation state is not `'idle'`, the button SHALL be visually disabled or replaced with a progress affordance and SHALL NOT trigger another upgrade. After a successful voice→video upgrade, the button SHALL be hidden because `callKind` is no longer `'voice'`.

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

#### Scenario: Add-video button visible only when eligible
- **GIVEN** the call is `active` AND `callKind === 'voice'` AND `renegotiationState === 'idle'`
- **WHEN** the active-call user interface renders
- **THEN** an "Add video" button SHALL be visible

#### Scenario: Add-video button hidden during voice→video upgrade
- **GIVEN** the user has tapped "Add video" and the renegotiation state is `'outgoing'`
- **WHEN** the active-call user interface renders
- **THEN** the "Add video" button SHALL be either hidden or visually disabled
- **AND** activating the button SHALL NOT initiate a second upgrade

#### Scenario: Add-video button hidden after upgrade succeeds
- **GIVEN** a voice call was upgraded to video and `callKind` is now `'video'`
- **WHEN** the active-call user interface renders
- **THEN** the "Add video" button SHALL NOT be visible

## ADDED Requirements

### Requirement: Mid-Call Renegotiation
The system SHALL support NIP-AC kind 25055 (Call Renegotiate) on both send and receive for one-to-one calls. The system SHALL maintain a `renegotiationState` field with values `'idle'`, `'outgoing'`, `'incoming'`, and `'glare'`. Renegotiation does not change the call's `status` (`connecting` or `active` is preserved). Renegotiation reuses the call's existing `call-id`. The response to a kind-25055 event SHALL be a kind-25051 Call Answer with the same `call-id`, no `call-type` tag, and `alt` `'WebRTC call answer'` (i.e. an ordinary Call Answer). Renegotiation does NOT generate a new call entry in call history; the existing call's history rumor reflects the latest media kind at hangup time.

The system SHALL only accept a received kind-25055 event when the local status is `connecting` or `active`, the inner event's `call-id` matches the active call, and a live `RTCPeerConnection` exists. Events failing any of these guards SHALL be silently dropped.

#### Scenario: Renegotiate accepted in active state
- **GIVEN** the local status is `active` for `call-id=X`
- **AND** a live `RTCPeerConnection` exists
- **AND** the renegotiation state is `'idle'`
- **WHEN** a kind 25055 inner event arrives from the peer with `call-id=X`
- **THEN** the system SHALL set `renegotiationState` to `'incoming'`
- **AND** the system SHALL apply the SDP via `setRemoteDescription`
- **AND** the system SHALL create an answer via `createAnswer`, set it as the local description, and publish it as a kind-25051 Call Answer with the same `call-id` and no `call-type` tag
- **AND** the local `status` SHALL remain `active`
- **AND** after the kind-25051 Call Answer has been published the system SHALL set `renegotiationState` back to `'idle'`

#### Scenario: Renegotiate accepted in connecting state
- **GIVEN** the local status is `connecting` for `call-id=X`
- **WHEN** a kind 25055 inner event arrives from the peer with `call-id=X`
- **THEN** the system SHALL apply it identically to the `active` case
- **AND** the local `status` SHALL remain `connecting`

#### Scenario: Renegotiate dropped in idle
- **GIVEN** the local status is `idle`
- **WHEN** a kind 25055 inner event arrives
- **THEN** the event SHALL be dropped silently
- **AND** no kind-25051 answer SHALL be sent

#### Scenario: Renegotiate dropped in outgoing-ringing or incoming-ringing
- **GIVEN** the local status is `outgoing-ringing` or `incoming-ringing`
- **WHEN** a kind 25055 inner event arrives
- **THEN** the event SHALL be dropped silently
- **AND** no kind-25051 answer SHALL be sent

#### Scenario: Renegotiate dropped in ended
- **GIVEN** the local status is `ended`
- **WHEN** a kind 25055 inner event arrives
- **THEN** the event SHALL be dropped silently

#### Scenario: Renegotiate with mismatched call-id dropped
- **GIVEN** the local status is `active` for `call-id=X`
- **WHEN** a kind 25055 inner event arrives with `call-id=Y` (Y ≠ X)
- **THEN** the event SHALL be dropped silently
- **AND** no kind-25051 answer SHALL be sent

#### Scenario: Renegotiate dropped when no peer connection
- **GIVEN** the local status is `active` for `call-id=X` but the `RTCPeerConnection` has been closed
- **WHEN** a kind 25055 inner event arrives with `call-id=X`
- **THEN** the event SHALL be dropped silently

#### Scenario: Outgoing renegotiation timeout rolls back
- **GIVEN** the system has sent a kind 25055 and the renegotiation state is `'outgoing'`
- **WHEN** 30 seconds pass without a matching kind-25051 Call Answer arriving
- **THEN** the system SHALL call `setLocalDescription({type: 'rollback'})` on the peer connection
- **AND** any video track that was attached as part of the outgoing upgrade SHALL be removed and its capture stopped
- **AND** the local `callKind` SHALL be unchanged from its pre-upgrade value
- **AND** the underlying call SHALL remain `active`
- **AND** the renegotiation state SHALL be reset to `'idle'`

### Requirement: Renegotiation Glare Resolution
When the local peer has a pending outgoing kind-25055 (i.e., `peerConnection.signalingState === 'have-local-offer'`) and a remote kind-25055 arrives for the same `call-id`, the system SHALL resolve the glare by lexicographic comparison of the lowercase hexadecimal pubkey strings of the two peers. The peer with the **higher** hex pubkey SHALL win and SHALL keep its outgoing offer; the peer with the **lower** hex pubkey SHALL lose, SHALL invoke `setLocalDescription({type: 'rollback'})` to discard its pending local offer, SHALL remove any local media artifacts attached as part of its outgoing upgrade attempt, and SHALL then process the winner's renegotiation as a normal incoming kind-25055 (apply SDP, create kind-25051 answer, publish).

#### Scenario: Glare winner ignores incoming renegotiate
- **GIVEN** the local peer has sent a kind 25055 and `peerConnection.signalingState === 'have-local-offer'`
- **AND** the local lowercase hex pubkey is lexicographically greater than the peer's
- **WHEN** a kind 25055 inner event arrives from the peer with the same `call-id`
- **THEN** the system SHALL set `renegotiationState` to `'glare'` for diagnostics
- **AND** the system SHALL NOT call `setRemoteDescription`
- **AND** the system SHALL NOT publish a kind-25051 in response to the peer's offer
- **AND** the system SHALL keep waiting for the peer's kind-25051 answer to its own outgoing kind-25055

#### Scenario: Glare loser rolls back and accepts
- **GIVEN** the local peer has sent a kind 25055 and `peerConnection.signalingState === 'have-local-offer'`
- **AND** the local lowercase hex pubkey is lexicographically less than the peer's
- **WHEN** a kind 25055 inner event arrives from the peer with the same `call-id`
- **THEN** the system SHALL invoke `setLocalDescription({type: 'rollback'})` on the peer connection
- **AND** the system SHALL remove any video track that was attached as part of the local outgoing upgrade attempt and stop its capture
- **AND** the system SHALL then apply the peer's SDP via `setRemoteDescription`
- **AND** the system SHALL create a kind-25051 Call Answer and publish it
- **AND** the system SHALL eventually reset `renegotiationState` to `'idle'`

#### Scenario: Glare resolution uses lowercase hex pubkey lex compare
- **GIVEN** the two peers' pubkeys differ
- **WHEN** glare resolution runs on either side
- **THEN** the comparison SHALL be a JavaScript-style `>` / `<` comparison of the two pubkey hex strings, both normalized to lowercase
- **AND** the comparison SHALL be deterministic and yield the same winner on both sides

### Requirement: Voice-to-Video Mid-Call Upgrade
The system SHALL allow the local user to upgrade an `active` voice call to a video call without ending and re-establishing the call. The user-facing entry point SHALL be the "Add video" button defined under "Active Call Controls". On activation, the system SHALL:

1. Verify the guard (`callKind === 'voice'` AND `status === 'active'` AND `renegotiationState === 'idle'`) and abort the upgrade if the guard fails.
2. Set `renegotiationState` to `'outgoing'`.
3. Acquire the camera (web: `navigator.mediaDevices.getUserMedia({video: VIDEO_MEDIA_CONSTRAINTS.video})`; Android: the existing `AndroidCamera` plugin permission flow followed by `attachLocalVideoTrack`). On permission denial: revert `renegotiationState` to `'idle'`, surface a non-blocking error to the user, and abort.
4. Attach the new video track to the existing `RTCPeerConnection` via `addTrack` (web) or `peerConnection.addTrack` (Android native), so the next `createOffer` SDP includes a video m-line.
5. Call `createOffer` on the existing peer connection, `setLocalDescription` on the resulting offer, and publish it as a kind 25055 with the call's existing `call-id`.
6. Arm a 30-second timeout (per "Mid-Call Renegotiation").
7. On receipt of a matching kind-25051 Call Answer for the renegotiation: apply via `setRemoteDescription`, flip the local `callKind` to `'video'`, re-emit `setActive` on the voice-call store so subscribers see the new media kind, set `renegotiationState` to `'idle'`, and clear the timeout.

#### Scenario: User taps Add video on an active voice call
- **GIVEN** the local status is `active` AND `callKind === 'voice'` AND `renegotiationState === 'idle'`
- **AND** the user has granted (or grants in this flow) camera permission
- **WHEN** the user taps the "Add video" button
- **THEN** the system SHALL acquire a local video capture stream
- **AND** the system SHALL attach the video track to the existing peer connection
- **AND** the system SHALL publish a kind 25055 inner event with the call's existing `call-id` and a new SDP offer containing audio + video m-lines
- **AND** the renegotiation state SHALL transition to `'outgoing'`

#### Scenario: Peer accepts upgrade and answers
- **GIVEN** the local renegotiation state is `'outgoing'`
- **WHEN** a kind 25051 Call Answer arrives from the peer with the call's `call-id` and an SDP carrying a video m-line in `recvonly` or `sendrecv`
- **THEN** the system SHALL apply the answer via `setRemoteDescription`
- **AND** the local `callKind` SHALL flip to `'video'`
- **AND** the active-call user interface SHALL re-render to the video layout (full-screen remote video with self-view PiP)
- **AND** the renegotiation state SHALL transition to `'idle'`

#### Scenario: Camera permission denied during upgrade attempt
- **GIVEN** the local status is `active` AND `callKind === 'voice'`
- **WHEN** the user taps "Add video" and the camera permission request is denied
- **THEN** the system SHALL NOT publish a kind 25055
- **AND** the renegotiation state SHALL remain `'idle'` (or be reset to `'idle'` if briefly transitioned to `'outgoing'`)
- **AND** a non-blocking error message SHALL be surfaced to the user
- **AND** the underlying voice call SHALL remain `active`

#### Scenario: Upgrade attempt while another renegotiation is in flight
- **GIVEN** the renegotiation state is `'outgoing'`, `'incoming'`, or `'glare'`
- **WHEN** the user attempts to initiate another voice→video upgrade
- **THEN** the second attempt SHALL be rejected
- **AND** no kind 25055 SHALL be published

#### Scenario: Peer with no camera permission upgrades anyway
- **GIVEN** the local status is `active` AND `callKind === 'voice'`
- **WHEN** a kind 25055 arrives from the peer adding a video m-line and the local user denies camera permission to render their own video
- **THEN** the system SHALL build the kind-25051 answer with the video transceiver direction set to `recvonly`
- **AND** the answer SHALL still be published so the peer's renegotiation completes
- **AND** the local `callKind` SHALL flip to `'video'` because the local user is now rendering remote video
- **AND** the local self-view SHALL display a placeholder indicating the camera is blocked

### Requirement: Renegotiation State Field
The voice-call store SHALL expose a `renegotiationState` field with values `'idle'` (no renegotiation in flight), `'outgoing'` (we have sent a kind 25055 and are awaiting the peer's kind 25051), `'incoming'` (we are processing a kind 25055 received from the peer), and `'glare'` (transient state on the side that wins glare while the loser's rollback and our completion are still in flight). The field SHALL be reset to `'idle'` on every transition into `'idle'` (after successful renegotiation, after timeout, after error, and on call termination).

The store SHALL initialize `renegotiationState` to `'idle'` on every fresh call. The state SHALL NOT survive a transition to `'ended'` or `'idle'` status.

#### Scenario: Renegotiation state initialized at call start
- **GIVEN** a fresh call has just transitioned out of `'idle'`
- **WHEN** subscribers read `renegotiationState`
- **THEN** the value SHALL be `'idle'`

#### Scenario: Renegotiation state cleared on call end
- **GIVEN** a renegotiation was in progress (`renegotiationState !== 'idle'`)
- **WHEN** the call transitions to `'ended'`
- **THEN** the renegotiation state SHALL be reset to `'idle'`
