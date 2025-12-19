## Context
The chat view currently renders a paged message list and supports loading older messages. Messages are stored locally in IndexedDB and accessed through `MessageRepository`.

This change adds a chat-history search UI to filter messages within a single conversation without altering message persistence or relay sync behavior.

## Goals / Non-Goals
- Goals:
    - Provide a search UI in the chat header that filters messages as the user types.
    - Use only locally stored IndexedDB messages for the active conversation.
    - Case-insensitive matching on message/caption text.
    - Highlight matched substrings in rendered message content.
    - If the match is in a caption, show the parent file message bubble with the caption.
    - Escape closes search and clears the query.
- Non-Goals:
    - Searching across all conversations (`partnerNpub === 'ALL'`).
    - Searching remote relay history or triggering network fetches.
    - Advanced search syntax (regex, whole-word, AND/OR, etc.).

## Decisions
### UI placement and interaction
- Decision: Add a magnifying-glass icon on the right side of the chat top bar.
- Decision: The search input slides out from the right side and expands to the left, keeping the icon anchored.
- Decision: Closing search (via icon toggle or Escape) clears the query and restores the default paged timeline.

### Data source and filtering
- Decision: When query is non-empty, load the full local conversation from IndexedDB and filter client-side.
- Rationale: Keeps the change minimal and avoids introducing new IndexedDB indices or search-specific schema changes.
- Performance note: Filtering is debounced to avoid repeated IndexedDB reads on every keystroke.

### Caption match behavior
- Decision: Caption matches must show the parent file bubble + caption as a single visual unit.
- Approach: When building the search result list:
    - Identify caption messages (text kind with `parentRumorId`).
    - If a caption matches, include both the caption and its parent file message.
    - Ensure the caption appears immediately after the parent in the results list so existing caption-rendering logic can display it under the file bubble.
    - De-duplicate parents when multiple captions match.

### Highlight rendering
- Decision: Highlight occurrences of the query in rendered message text and captions.
- Approach:
    - Highlight is applied only when query is non-empty.
    - Use a safe method that does not corrupt existing message formatting (e.g., markdown-derived HTML). If HTML is used during rendering, highlighting should operate on text nodes rather than raw regex replacement over HTML.

## Risks / Trade-offs
- Large local histories could make search slower on low-memory devices.
    - Mitigation: Debounce input; keep implementation simple; consider future optimizations (e.g., incremental rendering) only if needed.
- Highlighting inside formatted content is easy to implement incorrectly.
    - Mitigation: Prefer DOM/text-node-based highlighting to preserve markup.

## Migration Plan
No migrations. Uses existing stored messages.

## Open Questions
None (query semantics and caption behavior confirmed).
