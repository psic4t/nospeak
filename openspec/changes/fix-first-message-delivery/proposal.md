# Change: Fix First Message Delivery Reliability

## Summary
Fix a race condition where messages sent immediately after adding a new relay (e.g., first message to a new contact) are dropped because the relay connection is not yet established.

## Motivation
When a user sends a message to a new contact, `AddMailboxRelays` adds the recipient's relays to the `ConnectionManager`. The connection is established asynchronously.
Immediately after, `PublishEvent` is called. It uses `connectionManager.GetAllRelays()` to find targets.
Currently, `GetAllRelays()` only returns relays with an active `*nostr.Relay` object (i.e., connected relays).
Consequently, the new relays are skipped, the message is not sent to them, and it is **not queued for retry** because the system doesn't even try to publish to them.
The user sees a success (silent failure), but the message is never delivered. The second message works because by then the connection is likely established.

## Proposed Changes
1.  **Connection Manager**: Add `GetAllManagedRelayURLs() []string` to return the URLs of *all* managed relays, regardless of connection status.
2.  **Retry Queue**: Update `PublishToAllRelays` to iterate over the URLs from `GetAllManagedRelayURLs()` instead of `GetAllRelays()`.
    - This ensures `publishToRelay` is called for every managed relay.
    - `publishToRelay` already handles disconnected relays by returning an error, which triggers the retry mechanism.

## Impact
- **Reliability**: First messages to new contacts will now be reliably queued and sent once the connection is established.
- **Client**: `GetTotalManagedRelays` can also be updated to be more accurate.

## Verification
- Unit test `TestPublishToDisconnectedRelay` in `retry_queue_test.go`.
- Manual verification: Send message to new contact, verify logs show "Enqueued for retry" instead of silent success.
