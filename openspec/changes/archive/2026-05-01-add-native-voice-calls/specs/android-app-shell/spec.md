## ADDED Requirements

### Requirement: Native Active-Call Activity
The Android app shell SHALL provide a native `ActiveCallActivity` (registered in `AndroidManifest.xml`) that displays the active voice call state. The activity SHALL use an XML layout (`activity_active_call.xml`) styled to match `activity_incoming_call.xml`, displaying the peer avatar, display name, current call status text, a live duration display, a mute toggle, a speaker toggle, and a hangup button. The activity SHALL set `FLAG_SHOW_WHEN_LOCKED` and `FLAG_TURN_SCREEN_ON` so it can render over the lockscreen. The activity SHALL communicate with `VoiceCallForegroundService` for state queries and command dispatch (mute, speaker, hangup); it SHALL NOT host its own peer connection.

#### Scenario: Activity registered in manifest
- **GIVEN** the Android app shell build
- **WHEN** the manifest is parsed at install time
- **THEN** `ActiveCallActivity` SHALL be declared with launchMode and intent-filter configuration appropriate for a foreground call surface

#### Scenario: Activity binds to foreground service
- **GIVEN** `ActiveCallActivity` launches
- **WHEN** the activity reaches `onStart`
- **THEN** the activity SHALL bind to `VoiceCallForegroundService` to read the current call state and subscribe to state changes
- **AND** the activity SHALL render the corresponding UI (avatar, name, status, duration)

#### Scenario: Activity finishes when call ends
- **GIVEN** `ActiveCallActivity` is showing for an active call
- **WHEN** the call transitions to `ended`
- **THEN** the activity SHALL finish itself
- **AND** the activity SHALL NOT attempt to re-launch on subsequent state changes

### Requirement: AndroidVoiceCall Plugin Methods for Native Calls
The `AndroidVoiceCall` Capacitor plugin SHALL expose the following methods in addition to the existing `startCallSession`, `endCallSession`, `getPendingIncomingCall`, `clearPendingIncomingCall`, `dismissIncomingCall`, `canUseFullScreenIntent`, and `requestFullScreenIntentPermission` methods:

- `initiateCall({ callId: string, peerHex: string, peerName?: string }): Promise<void>` — initiates a native outgoing call, building the peer connection and sending the kind-25050 offer.
- `acceptCall({ callId?: string }): Promise<void>` — accepts the currently-pending incoming call from in-app context (mirrors the lockscreen Accept path but invoked from the WebView).
- `declineCall(): Promise<void>` — declines the currently-pending incoming call from in-app context.
- `hangup(): Promise<void>` — hangs up the active call from in-app context.
- `toggleMute({ muted: boolean }): Promise<void>` — sets the local audio track's enabled flag.
- `toggleSpeaker({ on: boolean }): Promise<void>` — sets `AudioManager.setSpeakerphoneOn`.
- `notifyUnlockComplete({ callId: string }): Promise<void>` — emits the `nospeak.ACTION_UNLOCK_COMPLETE` LocalBroadcast that the FGS listens for; called by the JS unlock route handler after a PIN-locked nsec has been unlocked.

#### Scenario: Plugin methods route into native call manager
- **GIVEN** the runtime platform is Android
- **WHEN** the WebView calls any of `initiateCall`, `acceptCall`, `declineCall`, `hangup`, `toggleMute`, `toggleSpeaker`
- **THEN** the plugin SHALL route the call to the corresponding `NativeVoiceCallManager` method
- **AND** the plugin SHALL resolve the returned promise on success or reject with a descriptive error on failure

### Requirement: AndroidVoiceCall Plugin Events for Native Calls
The `AndroidVoiceCall` Capacitor plugin SHALL emit the following events in addition to the existing `hangupRequested` and `pendingCallAvailable` events:

- `callStateChanged` with payload `{ callId: string, status: 'outgoing-ringing' | 'incoming-ringing' | 'connecting' | 'active' | 'ended', reason?: string }`
- `durationTick` with payload `{ callId: string, seconds: number }` emitted at most once per second while the call is active
- `callError` with payload `{ callId: string, code: string, message: string }`
- `muteStateChanged` with payload `{ callId: string, muted: boolean }`
- `callHistoryWriteRequested` with payload `{ type: 'missed' | 'cancelled', callId: string, peerHex: string, initiatorHex?: string }`

The JavaScript `VoiceCallServiceNative` class SHALL subscribe to these events and update the existing `voiceCallState` Svelte store accordingly, and SHALL forward `callHistoryWriteRequested` payloads to the registered `LocalCallEventCreator` (which writes to `messageRepo` via `Messaging.createLocalCallEventMessage`).

#### Scenario: callStateChanged drives Svelte store on Android
- **GIVEN** the WebView is alive on Android
- **WHEN** the native call manager transitions through call states
- **THEN** the plugin SHALL emit a `callStateChanged` event for each transition
- **AND** the JavaScript handler SHALL invoke the corresponding store mutation (`setOutgoingRinging`, `setIncomingRinging`, `setConnecting`, `setActive`, `endCall`, etc.)

#### Scenario: durationTick updates UI duration display
- **GIVEN** the call is `active` on Android
- **WHEN** the native foreground service emits `durationTick` events
- **THEN** the JavaScript handler SHALL invoke `incrementDuration` (or set the duration directly) on `voiceCallState`
- **AND** any UI surfaces reading the duration from the store SHALL update at most once per second

#### Scenario: callHistoryWriteRequested forwarded to messageRepo
- **GIVEN** the WebView is alive on Android
- **WHEN** the plugin emits `callHistoryWriteRequested` with a missed-call or cancelled-call payload
- **THEN** the JavaScript handler SHALL build the corresponding chat-history rumor and call `messageRepo.saveMessage` (via `Messaging.createLocalCallEventMessage`)
- **AND** the call event SHALL render as a system-style entry in the conversation timeline

### Requirement: VoiceCallForegroundService Hosts Native Call Manager
On Android, `VoiceCallForegroundService` SHALL instantiate, lifecycle-bind, and own a `NativeVoiceCallManager` instance for the duration of every voice call. The service SHALL route Accept and Hangup intents from notifications and from `IncomingCallActivity` into the manager. The service SHALL continue to perform its existing responsibilities: foreground service start/stop with type `phoneCall`, partial wake lock acquire/release, audio mode capture/restore (`MODE_IN_COMMUNICATION`).

#### Scenario: Service initializes manager on call start
- **GIVEN** the runtime platform is Android
- **WHEN** `VoiceCallForegroundService.onStartCommand` runs with an Initiate, Accept, or Hangup native action
- **THEN** the service SHALL instantiate `NativeVoiceCallManager` if not already present
- **AND** the service SHALL hand the action off to the manager (e.g., the Accept action causes the manager to read the persisted offer and send the Answer)

#### Scenario: Service tears down manager on call end
- **GIVEN** the native call manager has reached `ended`
- **WHEN** the foreground service receives an end-call action OR `onDestroy` runs
- **THEN** the service SHALL close the peer connection and release media resources via the manager
- **AND** the service SHALL release the wake lock and call `stopForeground` and `stopSelf`

### Requirement: PIN-Unlock-For-Call Intent Contract
On Android, when the native call manager needs the user to unlock a PIN-locked nsec to complete an accept, the system SHALL launch `MainActivity` with the intent extra `EXTRA_UNLOCK_FOR_CALL=<callId>` and `FLAG_ACTIVITY_NEW_TASK`. The JavaScript unlock route handler SHALL detect the corresponding `voice-call-unlock` route, wait for the PIN to clear AND for `currentUser` to be populated, then call `AndroidVoiceCall.notifyUnlockComplete({ callId })` which fires a `LocalBroadcastManager` broadcast with action `nospeak.ACTION_UNLOCK_COMPLETE` and a `callId` extra. `VoiceCallForegroundService` SHALL register a `LocalBroadcastReceiver` to consume the broadcast and resume the accept. If the user closes MainActivity without unlocking within 30 seconds, the FGS SHALL time out, send a kind-25054 reject, and stop itself.

#### Scenario: Locked nsec accept launches unlock intent
- **GIVEN** signing mode is `nsec` and the local secret is null in memory (and a cheap reload from `EncryptedSharedPreferences` did not succeed)
- **WHEN** the user taps Accept on the lockscreen incoming-call activity
- **THEN** the system SHALL launch `MainActivity` with `EXTRA_UNLOCK_FOR_CALL=<callId>`, `FLAG_ACTIVITY_NEW_TASK`, and route kind `voice-call-unlock`
- **AND** the activity SHALL display the existing JavaScript unlock screen

#### Scenario: Successful unlock broadcasts completion
- **GIVEN** the JavaScript unlock screen is showing for an `EXTRA_UNLOCK_FOR_CALL` intent
- **WHEN** the user enters the correct PIN AND `currentUser` is populated
- **THEN** the JavaScript handler SHALL call `AndroidVoiceCall.notifyUnlockComplete({ callId })`
- **AND** the plugin SHALL emit a `LocalBroadcastManager` broadcast with action `nospeak.ACTION_UNLOCK_COMPLETE` and the original callId

#### Scenario: Unlock timeout cleanly aborts the accept
- **GIVEN** the user has a pending unlock-for-call intent
- **WHEN** 30 seconds pass without an `ACTION_UNLOCK_COMPLETE` broadcast for the callId
- **THEN** `VoiceCallForegroundService` SHALL send a kind-25054 reject to the caller via `sendVoiceCallReject`
- **AND** the SharedPreferences key `nospeak_pending_call_unlock` SHALL be cleared
- **AND** the FGS SHALL stop itself

## MODIFIED Requirements

### Requirement: Android Background Messaging Foreground Service
The Android Capacitor app shell SHALL run a long-lived foreground service that owns the messaging WebSocket subscriptions, message decryption, notification posting, and NIP-AC inner-event dispatch into `NativeVoiceCallManager`. The service SHALL run with foreground service type `dataSync` (default) or `phoneCall` (during an active voice call hosted by `VoiceCallForegroundService`). The service SHALL acquire a partial wake lock during operation and SHALL release it on stop. The service SHALL configure adaptive heartbeat behavior to minimize battery use when the device is locked. The service SHALL handle restart-after-kill consistent with notifying the user of message activity but SHALL NOT auto-restart for active calls (call FGS uses `START_NOT_STICKY`).

The `NativeBackgroundMessagingService` SHALL additionally provide native NIP-AC outbound sender helpers (`sendVoiceCallOffer`, `sendVoiceCallAnswer`, `sendVoiceCallIce`, `sendVoiceCallHangup`, in addition to the existing `sendVoiceCallReject`), plus a parameterized call-history rumor helper (`sendVoiceCallHistoryRumor`) used by `NativeVoiceCallManager` to publish all call signaling and history events natively. These helpers SHALL produce wire-compatible NIP-AC gift wraps byte-equivalent to the corresponding JavaScript senders.

#### Scenario: Background service runs during messaging
- **GIVEN** the Android Capacitor app shell is active
- **WHEN** the user has background messaging enabled
- **THEN** `NativeBackgroundMessagingService` SHALL run as a foreground service with the appropriate foreground service type
- **AND** the service SHALL maintain WebSocket subscriptions to the user's read relays
- **AND** the service SHALL acquire a partial wake lock while running

#### Scenario: Service provides NIP-AC senders for native calls
- **GIVEN** the runtime platform is Android
- **WHEN** `NativeVoiceCallManager` needs to publish a NIP-AC signal
- **THEN** the manager SHALL invoke the corresponding `NativeBackgroundMessagingService` helper method
- **AND** the helper SHALL build the inner event, wrap it as kind-21059, and publish it to the recipient's messaging relays plus a self-wrap copy

#### Scenario: Service dispatches inbound NIP-AC events to call manager
- **GIVEN** a voice call is in progress on Android
- **WHEN** the service decrypts a kind-21059 wrap to a NIP-AC inner event of any kind for the active call
- **THEN** after Schnorr signature verification the service SHALL dispatch the inner event to `NativeVoiceCallManager`
- **AND** the JavaScript NIP-AC dispatch SHALL be skipped for the same gift wrap
