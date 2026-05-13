# Tasks: add-plain-turn-to-default-ice-servers

## 1. Runtime-config default update
- [x] 1.1 In `src/lib/core/runtimeConfig/defaults.ts`, change the TURN entry's `urls` field to an array containing both `turn:turn.data.haus:3478?transport=udp` and `turn:turn.data.haus:3478?transport=tcp`, with the existing `username: 'free'` / `credential: 'free'` retained on the same entry.
- [x] 1.2 Confirm the rest of the iceServers list (the two STUN entries) is unchanged.

## 2. Runtime-config validator
- [x] 2.1 Inspect the validator in `src/lib/core/runtimeConfig/store.ts` and verify it tolerates the array form of `urls` for `RTCIceServer` entries.
- [x] 2.2 If the validator currently rejects array-`urls`, extend it to accept `string | string[]` and add a unit test for both forms.

## 3. Android default-mirror update
- [x] 3.1 Update `android/app/src/main/res/raw/default_ice_servers.json` (introduced by `fix-android-ice-servers-from-runtime-config`) so its content matches the new `iceServers` array shape byte-for-byte after canonicalization.
- [x] 3.2 Confirm the drift-detection test from change 1 passes against the updated content on both sides.

## 4. Test-mock updates
- [x] 4.1 Update the `getIceServers` mock in `src/lib/core/voiceCall/VoiceCallService.test.ts` (currently at lines 12-14) to return the new shape, ensuring `Array.isArray(config.iceServers)` assertions remain valid.
- [x] 4.2 Update the corresponding mock in `src/lib/core/voiceCall/GroupVoiceCallStateMachine.test.ts` (currently at lines 71-73) to match.
- [x] 4.3 If the existing tests assert on iceServers length or url string, adjust them so the array-`urls` form is exercised at least once.

## 5. Parse-fan-out unit test (Java)
- [x] 5.1 Extend the `parseIceServersJson` Java test from change 1 with a fixture matching the new `defaults.ts` shape: assert that an entry with a 2-element `urls` array produces two `PeerConnection.IceServer` instances, each carrying the same `username` and `credential`.

## 6. Spec deltas
- [x] 6.1 Update `openspec/changes/add-plain-turn-to-default-ice-servers/specs/voice-calling/spec.md` with the MODIFIED requirement (already drafted in this change scaffold).
- [x] 6.2 Run `openspec validate add-plain-turn-to-default-ice-servers --strict` and resolve any issues.

## 7. Verification
- [x] 7.1 `npm run check` passes.
- [x] 7.2 `npx vitest run` passes — including the drift-detection test from change 1 and the updated mocks.
- [x] 7.3 `./gradlew -p android :app:testDebugUnitTest` (or the equivalent) passes including the extended `parseIceServersJson` fixture.
- [x] 7.4 Manual smoke test: a device on a network that filters UDP (e.g., a corporate or hotel WiFi simulation) can complete a call with another device, with the diagnostic log from change 1 showing a `relay` candidate type on at least one side of the selected pair.
- [x] 7.5 Manual smoke test: a call between two devices on a permissive network still uses non-relay candidates (no latency regression on the easy path).
