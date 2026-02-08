## Why

Users have no way to mention contacts inline when composing messages. Manually typing `nostr:npub1...` strings is impractical. An `@username` autocomplete in the message composer would let users quickly reference contacts, with the mention stored as a NIP-27 `nostr:npub1...` URI that the existing npub-mentions display system already renders.

## What Changes

- Add `@`-triggered autocomplete dropdown in the chat message textarea (ChatView.svelte)
- Filter local contacts (and group participants in group chats) by typed text after `@`
- On selection, insert `nostr:<npub>` into the message text at cursor position
- Enhance ChatList message preview to replace `nostr:npub1...` with `@displayName`

## Capabilities

### New Capabilities

- `mention-autocomplete` — Autocomplete UI and insertion logic for mentioning contacts via `@` trigger in the message composer

### Modified Capabilities

- `npub-mentions` — Add requirement for ChatList preview to render `nostr:npub1...` as `@displayName` in last-message text
- `chat-list` — Add npub mention preview rendering requirement for last message text

## Impact

- Affected code: `src/lib/components/ChatView.svelte` (compose area), `src/lib/components/ChatList.svelte` (preview rendering)
- Data source: `ContactRepository` + `ProfileRepository` (existing), `groupConversation.participants` (existing prop)
- No database schema changes
- No new dependencies
- No breaking changes
