# Change: Fetch Sent Messages on Startup

## Why
Currently, when `nospeak` starts with an empty cache, it fetches received messages but not sent messages. This results in a one-sided conversation history where the user cannot see their own past contributions. Additionally, sent messages are not currently propagated to the user's own inbox, making history recovery impossible for NIP-59 messages.

## What Changes
- **Update Sending Logic**: Modify `SendChatMessage` to send a copy of the NIP-59 gift wrap to the sender (self-DM) in addition to the recipient. This ensures a recoverable copy exists on relays.
- **Implement Fetch Logic**: Add logic to fetch these self-sent messages at startup when local history is empty.
- **Merge History**: Combine fetched sent and received messages into a unified chronological timeline.

## Impact
- Affected specs: `client`, `messaging`
- Affected code: `client/client.go`, `client/messaging.go`, `tui/app.go`
