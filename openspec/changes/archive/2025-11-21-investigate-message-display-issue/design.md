# Design: Investigate Real-time Message Display Issue

## Problem Architecture

The nospeak message system has two main data paths:

### Real-time Path (Currently Broken)
1. `ListenForMessages()` subscribes to gift-wrapped messages on connected relays
2. `Subscribe()` gets relays from `connectionManager.GetConnectedRelays()`
3. Message events are processed, decrypted, and passed to TUI message handler
4. TUI message handler updates the display in real-time

### Cache Path (Working)
1. Messages are successfully cached when received
2. On restart, cached messages are loaded and displayed properly

## Connection Manager Analysis

The recent NIP-65 changes introduced separate concepts:
- **Discovery relays**: Used for NIP-65 profile lookups
- **Mailbox relays**: Used for sending/receiving messages via NIP-65 discovery
- **Connection relays**: Currently connected relays for subscriptions

### Potential Issue: Relay Set Mismatch
The subscription may be listening on the wrong relay set:

```go
// Current behavior in Subscribe()
connectedRelays := c.connectionManager.GetConnectedRelays()

// But messages may be sent to mailbox relays via:
c.AddMailboxRelays(targetRelays) // in SendChatMessage()
```

## Hypothesis

Messages are being sent to mailbox relays (discovered via NIP-65) but subscriptions are only established on default discovery relays. This creates a disconnect where:

1. **Outgoing messages**: Sent to recipient's NIP-65 read relays + sender's NIP-65 write relays
2. **Incoming subscriptions**: Only listening on default discovery relays or currently connected relays
3. **Result**: Messages are successfully delivered and cached, but real-time subscriptions miss them

## Investigation Plan

1. **Verify subscription relay targets**: Check if `ListenForMessages()` subscribes to the correct relays
2. **Trace message delivery**: Follow the path from sender to recipient to identify where subscriptions fail
3. **Check connection state**: Verify that mailbox relays are properly connected for subscriptions
4. **Test timing**: Investigate if race conditions exist between relay discovery and subscription establishment