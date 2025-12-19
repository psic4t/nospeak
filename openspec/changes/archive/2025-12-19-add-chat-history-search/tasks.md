## 1. Implementation
- [x] 1.1 Add chat header search toggle and slide-out input
- [x] 1.2 Implement debounced, case-insensitive filtering over IndexedDB messages
- [x] 1.3 Ensure caption matches display parent file bubble + caption
- [x] 1.4 Highlight matched substrings in message text and captions
- [x] 1.5 Add unit tests for search/caption grouping behavior
- [x] 1.6 Run validation: `npm run check` and `npx vitest run`

## 2. Acceptance Checks
- [x] 2.1 Search icon appears on chat header (non-ALL conversations)
- [x] 2.2 Search input slides out left from the right side
- [x] 2.3 Results update as the user types (debounced)
- [x] 2.4 Only messages whose text contains the query are shown
- [x] 2.5 Query matching is case-insensitive
- [x] 2.6 Caption hit shows file bubble + caption
- [x] 2.7 Matching substrings are highlighted
- [x] 2.8 Escape closes search and clears the query
