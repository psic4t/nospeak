## MODIFIED Requirements

### Requirement: Native Android WebRTC Peer Connection
On Android, the system SHALL host the WebRTC peer connection in a native `NativeVoiceCallManager` class owned by `VoiceCallForegroundService`, using the `io.getstream:stream-webrtc-android` library. The native peer connection SHALL own all WebRTC state (peer connection, ICE candidate buffer, local audio track, remote audio playback, call duration timer) for the entire call lifecycle. The WebView's JavaScript layer SHALL NOT host an `RTCPeerConnection` for calls placed or received on Android. The native peer connection SHALL be configured with iceServers sourced from the runtime configuration of the JS layer; the FGS SHALL resolve the iceServers list in the following precedence order: (1) the `EXTRA_ICE_SERVERS_JSON` string extra attached to the FGS start intent by the JS-initiated paths (`initiateCall`, `acceptCall`); (2) a persisted snapshot of the most-recent JS-supplied list in SharedPreferences slot `nospeak_voice_call_runtime_config`; (3) a compile-time default sourced from a checked-in JSON resource (`android/app/src/main/res/raw/default_ice_servers.json`) exposed via `BuildConfig.DEFAULT_ICE_SERVERS_JSON`, kept in sync with `src/lib/core/runtimeConfig/defaults.ts` by a drift-detection test.

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

#### Scenario: Native peer connection uses iceServers from runtime config (JS-initiated path)
- **GIVEN** the user initiates or accepts a call on Android while the JS layer is alive
- **WHEN** the JS layer invokes the `AndroidVoiceCall.initiateCall` or `AndroidVoiceCall.acceptCall` plugin method
- **THEN** the plugin call SHALL include a deterministic-JSON serialization of the current runtime-config iceServers list as the `iceServersJson` argument
- **AND** the plugin SHALL forward that string to the FGS as the `EXTRA_ICE_SERVERS_JSON` intent extra
- **AND** the FGS SHALL parse the extra into a `List<PeerConnection.IceServer>` and pass it to the `NativeVoiceCallManager` constructor
- **AND** every entry from the JS list (including its `username` and `credential`, when present) SHALL be reflected in the resulting native list
- **AND** an entry whose `urls` field is an array SHALL produce one `PeerConnection.IceServer` per URL with the same credentials

#### Scenario: Native peer connection uses iceServers from SharedPreferences (cold-start accept path)
- **GIVEN** an incoming Call Offer is decrypted by `NativeBackgroundMessagingService` while the app is closed and no JS context exists
- **AND** the background service posts the incoming-call full-screen-intent notification but does NOT start the FGS yet
- **AND** the user taps Accept on `IncomingCallActivity` which then starts the FGS with `ACTION_ACCEPT_NATIVE` (without an `EXTRA_ICE_SERVERS_JSON` extra, because the activity has no JS context either)
- **AND** a prior JS-initiated call session persisted an iceServers snapshot to SharedPreferences slot `nospeak_voice_call_runtime_config`
- **WHEN** the FGS reaches `ensureNativeManager()`
- **THEN** the FGS SHALL read the persisted `iceServersJson` from the slot
- **AND** the FGS SHALL parse and apply it identically to the JS-initiated path

#### Scenario: Native peer connection falls back to compile-time default
- **GIVEN** the FGS is starting a peer connection
- **AND** no `EXTRA_ICE_SERVERS_JSON` extra is present on the intent
- **AND** the SharedPreferences slot `nospeak_voice_call_runtime_config` is empty
- **WHEN** the FGS resolves the iceServers list
- **THEN** the FGS SHALL use `BuildConfig.DEFAULT_ICE_SERVERS_JSON` as the source
- **AND** the parsed list SHALL be byte-equivalent to what the JS runtime config defaults (`src/lib/core/runtimeConfig/defaults.ts`) would produce

#### Scenario: Malformed iceServers JSON falls back without crashing
- **GIVEN** the FGS receives an `EXTRA_ICE_SERVERS_JSON` value that is not parseable JSON or is not a JSON array
- **WHEN** `parseIceServersJson` is invoked
- **THEN** the helper SHALL log a warning under the `VoiceCallFGS` tag
- **AND** the helper SHALL return the compile-time fallback list
- **AND** the FGS SHALL continue to build the peer connection rather than abort the call

#### Scenario: FGS log message reflects the actual iceServers source
- **WHEN** `ensureNativeManager()` resolves an iceServers list
- **THEN** the FGS SHALL emit exactly one of the following log messages:
  - `iceServers count=N (from extra)` when the JS-supplied extra was used
  - `iceServers count=N (from prefs)` when the SharedPreferences snapshot was used
  - `iceServers count=N (fallback default)` when the BuildConfig default was used
- **AND** the count value `N` SHALL equal the number of `PeerConnection.IceServer` instances ultimately passed to the manager

## ADDED Requirements

### Requirement: ICE Failure Diagnostic Logging
When a voice or video call transitions to `ended` with reason `ice-failed`, the system SHALL emit a structured diagnostic log entry under the tag `VoiceCallIceFailed` containing one record per `RTCIceCandidatePair` observed by the peer connection. Each record SHALL include the pair state (`new`, `in-progress`, `succeeded`, `failed`, `cancelled`), the nominated flag, the candidate type (`host`, `srflx`, `prflx`, `relay`) of both the local and remote endpoint, and a redacted form of the local and remote address (IPv4 truncated to a `/24` prefix, IPv6 truncated to a `/64` prefix). The diagnostic dump SHALL be best-effort: any failure inside the stats-collection path SHALL NOT affect the call-teardown flow or any other observable behavior.

#### Scenario: Web emits diagnostic log on ice-failed
- **GIVEN** a call is `connecting` or `active` on the web/PWA build
- **WHEN** the call transitions to `ended` with reason `ice-failed`
- **THEN** the system SHALL call `peerConnection.getStats()` and iterate the returned `RTCIceCandidatePairStats` entries
- **AND** for every pair the system SHALL emit one log line under tag `VoiceCallIceFailed`
- **AND** each log line SHALL contain the pair state, nominated flag, local candidate type and redacted address, and remote candidate type and redacted address

#### Scenario: Android emits diagnostic log on ice-failed
- **GIVEN** a call is `connecting` or `active` on Android
- **WHEN** the call transitions to `ended` with reason `ice-failed`
- **THEN** `NativeVoiceCallManager` SHALL call `peerConnection.getStats(RTCStatsCollectorCallback)`
- **AND** in the callback the manager SHALL emit one log line per candidate pair under tag `VoiceCallIceFailed` at `Log.INFO`
- **AND** each log line SHALL carry the same schema as the web path (pair state, nominated, local/remote candidate types and redacted addresses)

#### Scenario: Address redaction format
- **GIVEN** the diagnostic dump is preparing a log entry
- **WHEN** the candidate address is an IPv4 literal such as `192.168.1.42`
- **THEN** the emitted address SHALL be `192.168.1.0/24`
- **WHEN** the candidate address is an IPv6 literal such as `2001:db8:abcd:1234:5678:90ab:cdef:1234`
- **THEN** the emitted address SHALL be `2001:db8:abcd:1234::/64`
- **WHEN** the candidate address is empty or absent
- **THEN** the emitted address SHALL be the literal string `unknown`

#### Scenario: Diagnostic stats failure does not break call teardown
- **GIVEN** a call is transitioning to `ended` with reason `ice-failed`
- **AND** `getStats()` rejects with an error, or returns an empty report, or throws synchronously
- **WHEN** the system processes the failure-to-end transition
- **THEN** the diagnostic dump SHALL log the stats failure under a non-`VoiceCallIceFailed` tag at warning level
- **AND** the call SHALL still complete its `ended` transition
- **AND** all subsequent teardown side effects (media track release, peer connection close, history rumor, FGS stop) SHALL proceed normally
