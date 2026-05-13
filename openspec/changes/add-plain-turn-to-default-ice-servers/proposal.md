# Change: Add Plain TURN To Default ICE Servers

## Why
The current default iceServers configuration in `src/lib/core/runtimeConfig/defaults.ts` lists a single TURN entry that defaults to UDP transport only (`turn:turn.data.haus:3478` with no explicit `?transport=` parameter, which libwebrtc treats as UDP). Networks that filter UDP — many corporate firewalls, hotel WiFi, restrictive carrier-grade NAT — drop the UDP TURN traffic and leave clients without a relay candidate. ICE then either picks a non-working pair or fails with reason `ice-failed`, producing the user-visible symptom that calls "never connect on some networks." Adding an explicit TCP TURN variant on the same server gives libwebrtc a fallback transport for restrictive networks while keeping the UDP variant as the preferred (lower-latency) path.

This change deliberately does not add a TURNS (TURN over TLS) variant, a second TURN server, ephemeral HMAC credentials, or user-configurable TURN settings. Those are tracked as potential follow-ups but explicitly out of scope here. The single `turn.data.haus` deployment is treated as an accepted single point of failure for this iteration; the focus is on getting plain-TURN-over-TCP working as a fallback transport on the existing infrastructure.

This change is a no-op on Android until `fix-android-ice-servers-from-runtime-config` is deployed, because the current Android FGS ignores the runtime-config iceServers list entirely.

## What Changes
- Update `src/lib/core/runtimeConfig/defaults.ts` so the TURN entry's `urls` field becomes an array of two strings: `turn:turn.data.haus:3478?transport=udp` and `turn:turn.data.haus:3478?transport=tcp`. The `username` and `credential` (`free`/`free`) remain on the same entry — both URLs share them.
- Update the checked-in Android default mirror at `android/app/src/main/res/raw/default_ice_servers.json` to match the new JS defaults byte-for-byte (the drift-detection test introduced in change 1 will enforce this going forward).
- Update the existing `getIceServers` mocks in `src/lib/core/voiceCall/VoiceCallService.test.ts` and `src/lib/core/voiceCall/GroupVoiceCallStateMachine.test.ts` to reflect the new shape.
- Verify (and tighten if necessary) the runtime-config validator in `src/lib/core/runtimeConfig/store.ts` to accept the array form of `urls`.

## Impact
- Affected specs: `voice-calling`
- Affected code:
  - `src/lib/core/runtimeConfig/defaults.ts`
  - `src/lib/core/runtimeConfig/store.ts` (validator inspection / tightening)
  - `src/lib/core/voiceCall/VoiceCallService.test.ts` (mock update)
  - `src/lib/core/voiceCall/GroupVoiceCallStateMachine.test.ts` (mock update)
  - `android/app/src/main/res/raw/default_ice_servers.json` (introduced in change 1, content updated here)
- Non-breaking. `RTCIceServer.urls` is specified to accept `string | string[]`, every supported browser and `stream-webrtc-android` already handle the array form, and existing UDP-friendly clients continue to use the UDP variant first.
- After this change ships, clients on UDP-blocking networks SHALL be able to allocate a TCP TURN relay candidate. The expected user-visible outcome: calls that previously failed with `ice-failed` on hostile networks now complete.
- Depends on `fix-android-ice-servers-from-runtime-config` for Android impact. Sequence: deploy change 1 first; this change second.
