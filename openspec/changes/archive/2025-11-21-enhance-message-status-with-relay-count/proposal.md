# Enhance Message Status with Relay Count

## Summary

Enhance the message sending status in the TUI to show the number of relays a message was successfully sent to, changing from "sent" to "sent to X relays" for better user feedback about message delivery reach.

## Problem

Currently, when users send a message in the TUI, the status bar shows "sending..." followed by "sent". This provides no indication of how many relays actually received the message, which is important for understanding delivery reliability in a decentralized network.

## Solution

Modify the message sending flow to return and display the count of successful relay deliveries. This involves:

1. **Enhanced Client API**: Update `SendChatMessage` to return success count information
2. **TUI Status Enhancement**: Update status message to show relay count
3. **Backward Compatibility**: Maintain existing error handling behavior

## Benefits

- **Better User Feedback**: Users can see actual delivery reach across the Nostr network
- **Delivery Transparency**: Clear indication of message dissemination success
- **Network Health Awareness**: Users can understand relay connectivity issues
- **Minimal Change**: Focused enhancement with no breaking changes

## Scope

### In Scope
- Update `SendChatMessage` method signature to return success count
- Modify TUI status message display logic
- Update mock implementations for testing
- Maintain backward compatibility for CLI commands

### Out of Scope
- Changes to retry queue behavior
- Modifications to connection management
- Changes to message encryption or content
- UI layout changes beyond status message

## Implementation Approach

1. **Client Enhancement**: Modify `PublishEvent` to return success count
2. **Messaging Update**: Update `SendChatMessage` to propagate success count
3. **TUI Integration**: Update status message formatting in app.go
4. **Testing**: Update mocks and add tests for new functionality

## Success Criteria

- [x] Status message shows "sent to X relays" with actual relay count
- [x] Error handling behavior remains unchanged
- [x] CLI commands continue to work without modification
- [x] All existing tests pass
- [x] New functionality has appropriate test coverage