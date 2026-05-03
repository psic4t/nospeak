# Spec Delta: voice-calling

## MODIFIED Requirements

### Requirement: Native NIP-AC Outbound Senders on Android
On Android, the system SHALL author and publish NIP-AC inner-event kinds 25050 (offer), 25051 (answer), 25052 (ICE), 25053 (hangup), 25054 (reject), and 25055 (renegotiate) from native code via `NativeBackgroundMessagingService` helpers modeled on the existing native sender pattern. The native senders SHALL produce gift wraps that are byte-equivalent to the JavaScript senders for the same logical input, preserving NIP-AC wire compatibility with the web build and any other NIP-AC-capable client. Each sender SHALL preserve the existing self-wrap behavior so multi-device "answered/rejected/hung-up elsewhere" continues to work for every signal kind that requires it (25051 and 25054).

The native `sendVoiceCallReject` helper SHALL accept a `reason` parameter and SHALL place the non-empty `reason` value into the inner kind-25054 event's `content` field byte-equivalently with the JavaScript `sendCallReject`. When `reason` is null or empty the inner event's `content` SHALL be the empty string. The `"busy"` reason in particular SHALL propagate intact so remote peers can distinguish a user-initiated decline from a busy auto-reject.

#### Scenario: Native offer is byte-equivalent to JS offer
- **GIVEN** the same logical inputs (recipientHex, callId, sdp, sender keys, timestamp)
- **WHEN** the native `sendVoiceCallOffer` builds the inner event
- **AND** the JavaScript `sendCallOffer` in `Messaging.ts` builds the inner event with the same inputs
- **THEN** the resulting inner event JSON (with normalized property order) SHALL be byte-equivalent

#### Scenario: Native answer/ICE/hangup self-wrap to sender
- **WHEN** the native call manager sends any of kinds 25051, 25052, or 25053
- **THEN** the system SHALL also publish a self-wrap copy addressed to the sender's own pubkey (only kinds 25051 and 25054 require self-wrap per the multi-device requirements; 25052 and 25053 self-wrap is preserved for legacy parity but does not affect compliance)
- **AND** the self-wrap SHALL use the sender's NIP-17 messaging relay list

#### Scenario: ICE candidates from native target connected relays only
- **WHEN** the native local peer connection emits multiple ICE candidates in rapid succession
- **THEN** the corresponding kind-25052 wraps SHALL be published only to relays already connected at the time of send
- **AND** the system SHALL NOT open transient WebSockets for ICE candidate trickle

#### Scenario: Native reject with `"busy"` reason propagates content byte-for-byte
- **GIVEN** the native call manager has determined that an incoming kind-25050 offer SHALL be auto-rejected because a different call is already in progress
- **WHEN** native `sendVoiceCallReject(recipientHex, callId, "busy")` is invoked
- **THEN** the inner kind-25054 event's `content` field SHALL be the string `"busy"`
- **AND** the inner event SHALL be byte-equivalent to the JavaScript `sendCallReject(recipientNpub, callId, "busy")` output for the same logical inputs

#### Scenario: Native reject with null reason produces empty content
- **WHEN** native `sendVoiceCallReject(recipientHex, callId, null)` is invoked from the lockscreen Decline path
- **THEN** the inner kind-25054 event's `content` field SHALL be the empty string
- **AND** the inner event SHALL be byte-equivalent to the JavaScript `sendCallReject(recipientNpub, callId)` output (no reason argument)

### Requirement: Native NIP-AC Inbound Dispatch on Android
On Android, the native background messaging service SHALL dispatch all decrypted NIP-AC inner-event kinds (25050 offer, 25051 answer, 25052 ICE, 25053 hangup, 25054 reject, 25055 renegotiate) directly into `NativeVoiceCallManager` when a manager is present. The JavaScript-layer NIP-AC dispatch in `Messaging.ts` SHALL be skipped on Android for these inner kinds (with the exception of the self-event filter for 25051/25054, which the JS layer still owns when the WebView is alive). The native handler SHALL verify the inner event's Schnorr (BIP-340) signature before dispatch and SHALL silently drop events whose signature is invalid.

The native handler SHALL maintain a global pre-session ICE candidate buffer keyed by sender hex pubkey. When a kind-25052 ICE candidate inner event arrives and no `NativeVoiceCallManager` exists for the sender pubkey (e.g. the offer is still ringing on the lockscreen and the user has not yet accepted), the candidate SHALL be appended to the global buffer instead of being silently discarded. The global buffer SHALL impose a per-sender FIFO cap of at least 32 candidates, a total cap of at least 256 distinct sender pubkeys, and SHALL evict entries older than 60 seconds (matching the NIP-AC staleness window). When `VoiceCallForegroundService` instantiates a `NativeVoiceCallManager` for a peer, the manager SHALL drain the per-peer entries from the global buffer into its per-session pending-ICE buffer before `setRemoteDescription` resolves. The native handler SHALL clear the global buffer when the messaging service shuts down.

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

#### Scenario: ICE candidate before manager exists buffered globally
- **GIVEN** an incoming Call Offer (kind 25050) has produced a lockscreen FSI ringer notification but the user has not yet tapped Accept
- **AND** no `NativeVoiceCallManager` instance exists for the caller
- **WHEN** a kind-25052 ICE candidate inner event arrives from the caller
- **THEN** the candidate payload SHALL be appended to the global ICE buffer keyed by the caller's pubkey
- **AND** the candidate SHALL NOT be silently discarded

#### Scenario: Global ICE buffer drains on manager creation
- **GIVEN** the global ICE buffer holds 3 candidates for caller pubkey P
- **WHEN** the user accepts the call and `VoiceCallForegroundService` instantiates a `NativeVoiceCallManager` for peer P
- **THEN** the 3 buffered candidates SHALL be moved into the manager's per-session pending-ICE buffer in arrival order
- **AND** the global buffer entry for P SHALL be cleared
- **AND** the candidates SHALL be applied to the peer connection once `setRemoteDescription` resolves

#### Scenario: Global ICE buffer evicts entries older than 60 seconds
- **GIVEN** a candidate was buffered globally 65 seconds ago for caller pubkey P
- **WHEN** a new candidate arrives for caller pubkey Q (or the buffer is queried for any reason)
- **THEN** the stale entry for P SHALL be evicted
- **AND** the eviction SHALL NOT raise any user-facing notification

#### Scenario: Global ICE buffer cleared on messaging service shutdown
- **GIVEN** the global ICE buffer holds entries for several peers
- **WHEN** the messaging service is stopped
- **THEN** the buffer SHALL be cleared

## ADDED Requirements

### Requirement: Native Concurrent-Offer Busy Auto-Reject on Android
On Android, when a `NativeVoiceCallManager` exists with a non-idle, non-ended status and a kind-25050 Call Offer arrives over the live relay subscription whose `call-id` differs from the manager's active `call-id`, the native handler SHALL auto-reject the new offer with a kind-25054 Call Reject whose `content` is the string `"busy"`, mirroring the JavaScript busy auto-reject path. The native handler SHALL self-wrap the reject so the user's other devices observe the busy decision. The existing call SHALL be unaffected. The new offer SHALL NOT be persisted to the `nospeak_pending_incoming_call` SharedPreferences slot and SHALL NOT post a full-screen-intent notification. When the new offer's `call-id` matches the manager's active `call-id` (a duplicate of the call already in progress), the native handler SHALL silently ignore the duplicate without sending a reject, preserving the existing duplicate-offer behavior.

#### Scenario: Concurrent offer from another peer auto-rejected with `"busy"`
- **GIVEN** a `NativeVoiceCallManager` is in `active` state for `call-id=X` with peer A
- **WHEN** a kind-25050 Call Offer arrives from peer B with `call-id=Y`
- **THEN** the native handler SHALL invoke `sendVoiceCallReject(B_hex, Y, "busy")`
- **AND** the inner kind-25054 event's `content` SHALL be `"busy"`
- **AND** a self-wrap copy SHALL be published to the user's own pubkey
- **AND** the existing call with peer A SHALL remain in `active` state
- **AND** the new offer SHALL NOT be written to `nospeak_pending_incoming_call` SharedPreferences
- **AND** no full-screen-intent notification SHALL be posted

#### Scenario: Duplicate offer for active call ignored without reject
- **GIVEN** a `NativeVoiceCallManager` is in `active` state for `call-id=X` with peer A
- **WHEN** a kind-25050 Call Offer arrives from peer A with the same `call-id=X`
- **THEN** the native handler SHALL silently drop the duplicate
- **AND** the system SHALL NOT send a kind-25054 reject
- **AND** the existing call SHALL remain in `active` state

#### Scenario: Idle native manager does not trigger busy auto-reject
- **GIVEN** no `NativeVoiceCallManager` exists, OR the manager is in `idle` or `ended` state
- **WHEN** a kind-25050 Call Offer arrives
- **THEN** the native handler SHALL fall through to the normal follow-gate / FSI ringer path
- **AND** the native handler SHALL NOT auto-reject

### Requirement: Native Self-Event Multi-Device Dismissal on Android
On Android, the native background messaging service SHALL apply a kind-aware filter to self-authored NIP-AC inner events (events whose inner `pubkey` equals the user's own pubkey). Self-authored kinds 25050, 25052, 25053, and 25055 SHALL be dropped silently. Self-authored kinds 25051 (answer) and 25054 (reject) SHALL be evaluated against the in-flight ringing state:

- If a `NativeVoiceCallManager` is in `incoming-ringing` for a `call-id` matching the inner event's `call-id` tag, the native handler SHALL end the manager with reason `answered-elsewhere` (for kind 25051) or `rejected-elsewhere` (for kind 25054), and SHALL also cancel the lockscreen FSI notification by invoking `handleRemoteCallCancellation(callId)`.
- Else if the `nospeak_pending_incoming_call` SharedPreferences slot holds an entry whose `callId` matches the inner event's `call-id` tag, the native handler SHALL invoke `handleRemoteCallCancellation(callId)` to cancel the FSI notification and clear the SharedPreferences slot.
- Else the self-authored 25051/25054 SHALL be dropped silently.

The native cancellation paths SHALL be idempotent so concurrent JS-layer dismissal does not produce UI artifacts.

#### Scenario: Self-Answer with matching pending call dismisses lockscreen FSI
- **GIVEN** the WebView is dead on device D1 (Android)
- **AND** the `nospeak_pending_incoming_call` SharedPreferences slot holds `callId=X` for a Call Offer from caller P
- **AND** no `NativeVoiceCallManager` exists yet on D1
- **WHEN** the user's other device D2 accepts the call and publishes a self-addressed kind-25051 gift wrap with `call-id=X`
- **AND** D1's `NativeBackgroundMessagingService` decrypts the wrap and observes that the inner pubkey equals D1's own pubkey
- **THEN** D1 SHALL invoke `handleRemoteCallCancellation(X)` to cancel the lockscreen FSI notification and clear the SharedPreferences slot
- **AND** D1 SHALL NOT send any wire event in response

#### Scenario: Self-Reject with matching pending call dismisses lockscreen FSI
- **GIVEN** the same setup as the previous scenario
- **WHEN** D2 rejects the call and publishes a self-addressed kind-25054 with `call-id=X`
- **THEN** D1 SHALL invoke `handleRemoteCallCancellation(X)`
- **AND** the lockscreen FSI notification SHALL be cancelled

#### Scenario: Self-Answer with matching active manager ends call as answered-elsewhere
- **GIVEN** a `NativeVoiceCallManager` is in `incoming-ringing` for `call-id=X` on device D1
- **WHEN** a self-authored kind-25051 inner event with `call-id=X` arrives
- **THEN** the native handler SHALL invoke `nativeMgr.endForAnsweredElsewhere(X)`
- **AND** the manager SHALL transition to `ended` with reason `answered-elsewhere`
- **AND** the FSI notification (if any) SHALL be cancelled idempotently

#### Scenario: Self-Reject with matching active manager ends call as rejected-elsewhere
- **GIVEN** a `NativeVoiceCallManager` is in `incoming-ringing` for `call-id=X` on device D1
- **WHEN** a self-authored kind-25054 inner event with `call-id=X` arrives
- **THEN** the native handler SHALL invoke `nativeMgr.endForRejectedElsewhere(X)`
- **AND** the manager SHALL transition to `ended` with reason `rejected-elsewhere`
- **AND** the FSI notification (if any) SHALL be cancelled idempotently

#### Scenario: Self-Answer with mismatched call-id ignored
- **GIVEN** the SharedPreferences slot holds `callId=X` AND no manager exists with another callId
- **WHEN** a self-authored kind-25051 with `call-id=Y` (Y ≠ X) arrives
- **THEN** the native handler SHALL drop the event silently
- **AND** the FSI notification SHALL NOT be cancelled

#### Scenario: Self ICE/hangup/renegotiate/offer always dropped
- **WHEN** a self-authored inner event of kind 25050, 25052, 25053, or 25055 arrives
- **THEN** the native handler SHALL drop the event silently regardless of any pending or active call state
