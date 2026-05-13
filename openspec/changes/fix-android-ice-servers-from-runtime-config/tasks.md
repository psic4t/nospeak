# Tasks: fix-android-ice-servers-from-runtime-config

## 1. JS runtime-config serialization
- [x] 1.1 Add `getIceServersJson()` to `src/lib/core/runtimeConfig/store.ts` returning a deterministic JSON string (sorted object keys, no whitespace) of the current `iceServers` snapshot.
- [x] 1.2 Unit test: two consecutive calls produce byte-identical output for the same config; output is valid JSON parsable back to an equivalent array.

## 2. Capacitor plugin contract
- [x] 2.1 Extend `AndroidVoiceCallPluginShape.initiateCall` and `.acceptCall` in `src/lib/core/voiceCall/androidVoiceCallPlugin.ts` to accept an optional `iceServersJson: string` argument.
- [x] 2.2 Add docstrings explaining that the field is the deterministic-JSON output of the current runtime config and that the native side falls back to a persisted snapshot when absent.

## 3. VoiceCallServiceNative serializer wiring
- [x] 3.1 In `src/lib/core/voiceCall/VoiceCallServiceNative.ts`, pass `getIceServersJson()` on every `initiateCall` and `acceptCall` plugin invocation.
- [x] 3.2 Unit test: stub the plugin and assert the `iceServersJson` matches `getIceServersJson()` for both `initiateCall` and `acceptCall` paths.

## 4. Android plugin: forward iceServersJson to FGS
- [x] 4.1 In `AndroidVoiceCallPlugin.initiateCall` and `.acceptCall`, read the `iceServersJson` string from the `PluginCall`.
- [x] 4.2 Put it on the FGS start intent as `VoiceCallForegroundService.EXTRA_ICE_SERVERS_JSON`.

## 5. VoiceCallForegroundService: parse and apply iceServers
- [x] 5.1 Add `public static final String EXTRA_ICE_SERVERS_JSON = "iceServersJson"` to `VoiceCallForegroundService`.
- [x] 5.2 Add a service field `latestIceServersJson` set in `onStartCommand` before the dispatch to `ACTION_INITIATE_NATIVE` / `ACTION_ACCEPT_NATIVE` / `ACTION_AWAIT_UNLOCK`.
- [x] 5.3 Add a static helper `parseIceServersJson(String, List<PeerConnection.IceServer> fallback) -> List<PeerConnection.IceServer>` that:
  - accepts JSON array of objects with `urls` (string or string-array), optional `username`, optional `credential`.
  - skips malformed entries with `Log.w` and continues.
  - returns the fallback list if input is null, empty, or unparseable.
- [x] 5.4 In `ensureNativeManager()`, replace the hard-coded single-STUN list with `parseIceServersJson(latestIceServersJson, buildCompileTimeFallback())`.
- [x] 5.5 Truthful log message: `iceServers count=N (from extra)` when the extra was used, `iceServers count=N (from prefs)` when read from SharedPreferences, `iceServers count=N (fallback default)` when neither was available.

## 6. Persist iceServers for the cold-start path
- [x] 6.1 On every `ACTION_INITIATE_NATIVE` / `ACTION_ACCEPT_NATIVE` invocation that received the extra, write `iceServersJson` to a SharedPreferences slot `nospeak_voice_call_runtime_config`, key `iceServersJson`.
- [x] 6.2 When `latestIceServersJson` is null (the typical cold-start `notifyIncomingRinging` path), read from that slot before falling back to BuildConfig.

## 7. Cold-start accept handoff
- [x] 7.1 Confirm `IncomingCallActivity` does NOT need code changes: when it launches the FGS with `ACTION_ACCEPT_NATIVE` (no iceServersJson extra), the FGS's resolution chain in `ensureNativeManager()` falls through to the `PREFS_RUNTIME_CONFIG` SharedPreferences snapshot, and then to `BuildConfig.DEFAULT_ICE_SERVERS_JSON`. Document this in `IncomingCallActivity` near the FGS start with a one-line comment so future contributors don't try to pipe iceServers through the activity.
- [x] 7.2 Confirm the same applies to `ACTION_AWAIT_UNLOCK`: the FGS waits for an `ACTION_UNLOCK_COMPLETE` broadcast, then restarts itself with `ACTION_ACCEPT_NATIVE` — both pass through the resolution chain.

## 8. Compile-time default mirror
- [x] 8.1 Create `android/app/src/main/res/raw/default_ice_servers.json` containing the same JSON shape as the `iceServers` array in `src/lib/core/runtimeConfig/defaults.ts`.
- [x] 8.2 Modify `android/app/build.gradle` to read this file at configure time and expose it as `BuildConfig.DEFAULT_ICE_SERVERS_JSON`. Build SHALL fail loudly with a `GradleException` if the file is missing or empty.
- [x] 8.3 Add a drift-detection vitest test that reads both `defaults.ts` (via the existing module import) and `default_ice_servers.json` (via `fs`) and asserts canonical equality of the iceServers arrays.

## 9. parseIceServersJson Java unit tests
- [x] 9.1 Add `VoiceCallForegroundServiceIceServersTest` (or an equivalent pure-Java unit-test class) covering:
  - single-string `urls`
  - array `urls` (e.g. UDP+TCP variants)
  - missing `username` / `credential`
  - present `username` and `credential`
  - empty array input
  - malformed JSON input
  - null input
- [x] 9.2 Assert the fallback list shape used by the FGS when input is unparseable matches the BuildConfig default.

## 10. ICE-failed diagnostic dump (web)
- [x] 10.1 In `src/lib/core/voiceCall/VoiceCallService.ts`, on the transition to `ended` with reason `ice-failed`, call `peerConnection.getStats()` and iterate `RTCIceCandidatePairStats` entries plus their associated local/remote candidate stats.
- [x] 10.2 Emit one structured log line under tag `[VoiceCallIceFailed]` per pair, schema:
  `{ pairId, state, nominated, local: { type, address }, remote: { type, address } }`
  with addresses redacted to `/24` for IPv4 and `/64` for IPv6.
- [x] 10.3 Wrap the entire dump in try/catch; failures must not affect call teardown.
- [x] 10.4 Unit test: a stubbed `getStats` returning a known set of pairs produces the expected log line; failures inside `getStats` are swallowed.

## 11. ICE-failed diagnostic dump (Android)
- [x] 11.1 In `NativeVoiceCallManager`, on the transition path that ends a call with reason `ice-failed`, call `peerConnection.getStats(RTCStatsCollectorCallback)`.
- [x] 11.2 In the callback, build and emit the same `[VoiceCallIceFailed]` JSON line under `Log.i(TAG_STATS, ...)`, with equivalent address redaction.
- [x] 11.3 Wrap in try/catch; failures must not affect teardown.

## 12. Spec deltas
- [x] 12.1 Update `openspec/changes/fix-android-ice-servers-from-runtime-config/specs/voice-calling/spec.md` with the MODIFIED and ADDED requirements (already drafted in the change scaffold).
- [x] 12.2 Run `openspec validate fix-android-ice-servers-from-runtime-config --strict` and resolve any issues.

## 13. Verification
- [x] 13.1 `npm run check` passes.
- [x] 13.2 `npx vitest run` passes.
- [x] 13.3 `./gradlew -p android :app:testDebugUnitTest` (or the equivalent command for our Android unit-test target) passes including the new `parseIceServersJson` tests.
- [x] 13.4 Manual smoke test: two Android devices on the same WiFi place a call and it connects (no regression on the easy path).
- [x] 13.5 Manual smoke test: triggering an `ice-failed` end (e.g., kill the peer process while ICE is establishing) produces the `[VoiceCallIceFailed]` log line on both platforms.
