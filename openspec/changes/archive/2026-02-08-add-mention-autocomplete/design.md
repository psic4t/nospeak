## Context

The chat composer in ChatView.svelte already has an emoji autocomplete triggered by `:text` (state: `showEmojiPicker`, `emojiSearch`, `emojiSelectedIndex`; keyboard nav: ArrowUp/Down/Enter/Tab/Escape; insertion: replace `:search` with emoji char). The mention autocomplete follows the identical pattern with `@text` as the trigger.

The display side already handles `nostr:npub1...` references in MessageContent.svelte (detects, resolves display names from profile cache, renders as clickable `@Username` links). The send pipeline passes message content as-is with no transformation. Therefore, inserting `nostr:npub1...` at compose time is sufficient — no changes to Messaging.ts or MessageContent.svelte are needed.

Contacts are available via `contactRepo.getContacts()` + `profileRepo.getProfileIgnoreTTL()`. Group participants are available from the `groupConversation.participants` prop. All data is local (IndexedDB), so filtering is instantaneous with no network calls or debounce needed.

## Goals / Non-Goals

**Goals:**
- Allow users to mention contacts by typing `@` followed by a search string
- Show a dropdown with matching contacts (name, avatar, truncated npub)
- Insert NIP-27 `nostr:<npub>` URI into message text on selection
- In group chats, also suggest group participants who may not be in the contact list
- Enhance ChatList preview to show `@displayName` instead of raw `nostr:npub1...`

**Non-Goals:**
- Contenteditable/rich-text composer (stays plain textarea)
- Mentioning users not in contacts or current group
- Remote search for mentions (no relay queries)
- Adding `p` tags to the Nostr event for mentioned users (the `nostr:npub1...` in content is sufficient per NIP-27)

## Decisions

### 1. Plain Textarea with Raw npub Insertion

Insert `nostr:npub1...` directly into the plain textarea. User sees the raw URI while composing.

**Rationale:** Matches the existing emoji autocomplete pattern. The `nostr:npub1...` text is already rendered as styled `@Username` by MessageContent.svelte on the receiving end. Keeps implementation simple and reliable across all platforms (PWA, Android).

**Alternatives considered:**
- Contenteditable div with styled chips: Rejected because of cursor management complexity, mobile keyboard issues, and significant deviation from existing patterns.

### 2. Follow Existing Emoji Picker Pattern Exactly

Mirror the emoji autocomplete structure: same state variables pattern, same keyboard navigation, same popup positioning, same insertion logic.

**Rationale:** Consistency, minimal new code patterns, proven UX.

### 3. Trigger Regex: `(?:^|\s)@(\w*)$`

Require `@` to be preceded by whitespace or start-of-input. Prevents false triggers on email addresses.

**Alternatives considered:**
- Simple `/@(\w*)$/`: Would trigger on `user@dom`, causing false positives for email addresses.

### 4. Candidate Sources: Contacts + Group Participants

In all chats, suggest from local contacts. In group chats, additionally merge group participants (deduped, excluding self).

**Rationale:** Natural UX — in a group chat, you'd want to mention any participant, even if they're not in your contact list.

### 5. Mutual Exclusion with Emoji Picker

When mention picker opens, close emoji picker and vice versa. Only one autocomplete dropdown visible at a time.

**Rationale:** Avoids UI clutter and conflicting keyboard handlers.

## Risks / Trade-offs

- **Large contact lists may need scrolling**: Mitigated by limiting dropdown to 5 results (matching emoji picker) and filtering by search text.
- **Textarea shows raw `nostr:npub1...`**: Accepted trade-off for simplicity. The long npub string may be visually noisy in the compose area, but the rendered message displays `@Username` cleanly.
- **No deferred profile loading for candidates**: All profiles loaded eagerly on chat open. Mitigated by profiles already being cached in IndexedDB from prior interactions.
