# Tasks

- [x] 1. Modify `client/connection_manager.go`: Add `GetAllManagedRelayURLs() []string` method.
- [x] 2. Modify `client/retry_queue.go`: Update `PublishToAllRelays` to use `GetAllManagedRelayURLs` and iterate over URLs.
- [x] 3. (Optional) Fix `GetTotalManagedRelays` in `client/client.go` to use `GetAllManagedRelayURLs` or just count them properly.
- [x] 4. Add/Update test in `client/retry_queue_test.go` to verify `PublishToAllRelays` attempts disconnected relays.
