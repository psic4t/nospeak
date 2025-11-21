# Tasks: Investigate Real-time Message Display Issue

## Investigation Tasks

1. **Analyze subscription relay targets** ✅
   - [x] Add debug logging to `ListenForMessages()` to show which relays are being subscribed to
   - [x] Verify if mailbox relays are included in subscription relay set
   - [x] Check if `connectionManager.GetConnectedRelays()` returns the expected relays

2. **Trace message delivery path** ✅
   - [x] Add comprehensive debug logging to message sending flow
   - [x] Track which relays receive outgoing messages
   - [x] Compare sender's target relays vs recipient's subscription relays

3. **Examine connection manager behavior** ✅
   - [x] Verify mailbox relays are properly added to connection manager
   - [x] Check if mailbox relays are being connected for subscriptions
   - [x] Investigate timing between `AddMailboxRelays()` and `ListenForMessages()`

4. **Test subscription establishment** ✅
   - [x] Verify `Subscribe()` method establishes connections to correct relays
   - [x] Check if background goroutine in `Subscribe()` properly waits for connections
   - [x] Test subscription filters are correctly configured

## Debug Implementation

5. **Add debug instrumentation** ✅
   - [x] Add detailed logging to subscription establishment process
   - [x] Log relay connection states during message listening
   - [x] Track message event reception and processing

6. **Create reproduction test** ✅
   - [x] Set up test infrastructure for verifying real-time message reception
   - [x] Create unit tests to verify relay setup and subscription mechanisms
   - [x] Add debug logging capabilities to identify failure points

## Validation Tasks

7. **Verify fix effectiveness** ✅
   - [x] Implemented `SetupMessageRelays()` to ensure proper relay targeting for message reception
   - [x] Modified `ListenForMessages()` to call `SetupMessageRelays()` before establishing subscriptions
   - [x] Added debug logging to trace message flow from setup to reception
   - [x] Created unit tests to verify the fix works correctly

8. **Test edge cases** ✅
   - [x] Tested with no NIP-65 relays configured (falls back to discovery relays)
   - [x] Tested with cached NIP-65 relays (combines cached + discovery relays)
   - [x] Added duplicate relay removal to prevent redundant connections
   - [x] Verified debug logging works for troubleshooting