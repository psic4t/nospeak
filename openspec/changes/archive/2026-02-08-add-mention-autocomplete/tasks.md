## 1. Mention Autocomplete in ChatView

- [x] 1.1 Add mention state variables (`showMentionPicker`, `mentionSearch`, `mentionSelectedIndex`, `mentionCandidates`) alongside existing emoji picker state in ChatView.svelte
- [x] 1.2 Add `MentionCandidate` interface (`npub`, `name`, `picture?`) in ChatView.svelte
- [x] 1.3 Add `$effect` to load mention candidates from contacts + group participants (deduped, excluding self), with profile resolution from cache
- [x] 1.4 Add `filteredMentions` derived that filters candidates by `mentionSearch` (case-insensitive match on name/npub), limited to 5 results
- [x] 1.5 Modify `handleInput()` to detect `@word` pattern (regex: `(?:^|(?<=\s))@(\w*)$`) and set mention picker state; close emoji picker when mention picker opens and vice versa
- [x] 1.6 Modify `handleKeydown()` to handle mention picker keyboard navigation (ArrowUp/Down/Enter/Tab/Escape) before emoji picker block
- [x] 1.7 Add `selectMention()` function that replaces `@search` with `nostr:<npub> ` at cursor position, mirrors existing `selectEmoji()` pattern
- [x] 1.8 Add mention picker dropdown UI in template (above textarea, matching emoji picker styling), showing avatar, name, and truncated npub per candidate

## 2. ChatList Preview Enhancement

- [x] 2.1 Add `replaceNpubMentionsInPreview()` helper in ChatList.svelte that replaces `nostr:npub1...` URIs with `@displayName` from profile cache (sync lookup via profileRepo)
- [x] 2.2 Apply the helper to `lastMessageText` after existing preview formatting

## 3. Quality Gates

- [x] 3.1 Run `npm run check` and fix any type errors
- [x] 3.2 Run `npx vitest run` and fix any test failures
