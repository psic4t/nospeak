# Change: Fix Android ICE Servers From Runtime Config

## Why
The voice-calling spec (`Requirement: ICE Server Configuration` and `Requirement: Native Android WebRTC Peer Connection`) requires that the Android native call manager use the same iceServers as the web build, sourced from runtime configuration. The current Android implementation in `VoiceCallForegroundService.ensureNativeManager()` hard-codes a single STUN entry (`stun:turn.data.haus:3478`) and ignores any TURN configuration the runtime config provides. As a direct consequence, Android peers behind symmetric or restrictive NATs cannot allocate a relay candidate and ICE simply fails after the 30-second establishment timeout (the user-visible symptom: "calls connect on some networks but never on others"). No amount of changing `defaults.ts` improves Android calls until the wire-through path exists.

The change also adds an `ice-failed` diagnostic log dump on both web and Android so future "calls don't connect for some users" reports come pre-instrumented with the candidate-pair statistics that would have settled this triage instantly.

## What Changes
- Extend the `AndroidVoiceCall` Capacitor plugin's `initiateCall` and `acceptCall` methods to accept an `iceServersJson` string argument.
- `VoiceCallServiceNative` (the Android backend of `VoiceCallBackend`) serializes the current runtime-config iceServers list deterministically and includes it in every plugin invocation that may reach the FGS.
- `VoiceCallForegroundService` reads `EXTRA_ICE_SERVERS_JSON` from the start intent, parses it into a `List<PeerConnection.IceServer>`, and passes it to the `NativeVoiceCallManager` constructor — replacing the hard-coded STUN-only list.
- For the cold-start `notifyIncomingRinging` path (offer decrypted by `NativeBackgroundMessagingService` while the app is closed and there is no JS to serialize the config), the runtime-config iceServers list is persisted to a SharedPreferences slot (`nospeak_voice_call_runtime_config`) by every JS-initiated path, and the background path reads from that slot.
- Final fallback: a build-time `BuildConfig.DEFAULT_ICE_SERVERS_JSON` field, populated from a checked-in JSON resource at `android/app/src/main/res/raw/default_ice_servers.json` that mirrors `src/lib/core/runtimeConfig/defaults.ts`. A drift-detection test fails the build / test suite if the two files disagree.
- On transition to `ended` with reason `ice-failed`, both web (`VoiceCallService`) and Android (`NativeVoiceCallManager`) emit a structured log line under tag `VoiceCallIceFailed` containing one record per `RTCIceCandidatePair` with pair state, nominated flag, and the candidate type and redacted address (IPv4 `/24`, IPv6 `/64`) of both endpoints.
- Diagnostic dump is best-effort: failures inside the stats path must not affect the call-teardown flow.

## Impact
- Affected specs: `voice-calling`
- Affected code:
  - `src/lib/core/voiceCall/androidVoiceCallPlugin.ts`
  - `src/lib/core/voiceCall/VoiceCallServiceNative.ts`
  - `src/lib/core/voiceCall/VoiceCallService.ts`
  - `src/lib/core/runtimeConfig/store.ts`
  - `android/app/src/main/java/com/nospeak/app/AndroidVoiceCallPlugin.java`
  - `android/app/src/main/java/com/nospeak/app/VoiceCallForegroundService.java`
  - `android/app/src/main/java/com/nospeak/app/NativeBackgroundMessagingService.java`
  - `android/app/src/main/java/com/nospeak/app/NativeVoiceCallManager.java`
  - `android/app/build.gradle`
  - `android/app/src/main/res/raw/default_ice_servers.json` (new)
- Non-breaking. Existing call flows continue to work; the fix expands what the Android FGS sees but does not change wire-format, message kinds, or any user-visible state machine.
- After this change lands, the follow-up change `add-plain-turn-to-default-ice-servers` will start producing measurable connectivity improvements on Android — without this change, that follow-up is a no-op on Android.
