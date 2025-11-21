# Tasks

- [x] 1. Modify `client/connection_manager.go` to implement `RemoveRelay(url string)`.
    - Ensure it closes connections and cleans up health maps.
    - Ensure it stops reconnection loops for that relay.
- [x] 2. Modify `client/client.go` to implement `Connect` with bootstrapping logic.
    - Connect to discovery relays.
    - Fetch Kind 10002.
    - Update connection manager with new relays.
    - Prune discovery relays.
- [x] 3. Add integration tests for dynamic relay switching.
