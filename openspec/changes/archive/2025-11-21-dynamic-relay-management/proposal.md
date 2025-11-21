# Change: Dynamic Relay Management & Startup Discovery

## Summary
Implement dynamic relay management in the Connection Manager and update the client startup sequence to use hardcoded discovery relays solely for bootstrapping the user's NIP-65 relay list.

## Motivation
Currently, the client relies on a hardcoded list of "Discovery Relays" for all operations if no relays are configured. The goal is to make the client more autonomous and user-centric by:
1. Using the hardcoded relays *only* to find the user's preferred relays (NIP-65).
2. Connecting to the user's specific read relays for ongoing operations.
3. Dynamically managing connections (adding/removing) as relay lists change or are discovered.

## Proposed Changes
1.  **Connection Manager**: Add capabilities to dynamically remove relays and manage the active set.
2.  **Client Startup**:
    - Connect to discovery relays.
    - Fetch the user's Kind 10002 (Relay List) event.
    - Switch the active connection set to the user's "Read" relays found in the event.
    - Disconnect from discovery relays that are not in the user's list.

## Impact
- **Client**: Startup sequence changes; ConnectionManager API expands.
- **Network**: Reduced load on discovery relays; better connectivity for users using their preferred relays.
- **UX**: potentially slightly longer startup time (bootstrap phase), but better reliability afterwards.

## Verification
- Integration tests for `ConnectionManager` adding/removing relays.
- End-to-end test of the startup sequence (mocking the discovery phase).
