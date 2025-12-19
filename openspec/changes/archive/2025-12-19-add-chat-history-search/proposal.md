# Change: Add chat history search

## Why
Users need a fast way to locate prior messages within a conversation without manually scrolling. Long chat histories make it easy to lose context, especially on mobile.

## What Changes
- Add a search (magnifying-glass) action on the right side of the chat top bar.
- Clicking the icon reveals a slide-out search input that expands to the left.
- Search is find-as-you-type (debounced) and filters the conversation using messages stored in IndexedDB.
- Filtering is case-insensitive and matches only message and caption text.
- The message list shows only matching messages while search is active.
- Matching substrings are visually highlighted within message bubbles and captions.
- Pressing Escape closes the search UI and clears the query.

## Impact
- Affected specs: `messaging`.
- Affected code (expected):
    - `src/lib/components/ChatView.svelte` (header UI, search state, filtered display behavior)
    - `src/lib/components/MessageContent.svelte` (highlight rendering)
    - `src/lib/db/MessageRepository.ts` (consume existing IndexedDB query method)
    - `src/lib/core/*` (new small search/highlight helper, with unit tests)
- Backwards compatibility: No breaking changes. Default chat paging behavior remains unchanged when search is inactive.
