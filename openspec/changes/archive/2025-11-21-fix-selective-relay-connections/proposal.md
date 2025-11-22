# Fix Selective Relay Connections

## Problem Statement

Nospeak currently connects to all relays in its database at startup, including discovery relays and all contact relays. This is incorrect behavior. Nospeak should only connect to the user's own read relays (if cached) and stay connected to them at all times. When sending a message to a contact, nospeak should temporarily connect to the contact's read relays and send the message to both the user's and the contact's read relays.

## Current Behavior

1. **Startup**: Connects to hardcoded discovery relays and all contact relays
2. **Message Sending**: Discovers and connects to both sender and recipient relays
3. **Persistent Connections**: Maintains connections to all discovered relays

## Desired Behavior

1. **Startup**: Only connect to user's cached read relays (if available)
2. **Persistent Connections**: Stay connected only to user's read relays
3. **Message Sending**: Temporarily connect to contact's read relays for message delivery
4. **Fallback**: Use discovery relays only when user's read relays are not cached

## Key Changes Required

- Modify startup connection logic to only use user's read relays
- Change message sending to use temporary connections for contact relays
- Update connection management to distinguish between persistent and temporary connections
- Ensure discovery relays are only used as fallback when needed

## Impact

This change will:
- Reduce unnecessary relay connections
- Improve resource efficiency
- Follow proper Nostr relay usage patterns
- Maintain message delivery reliability