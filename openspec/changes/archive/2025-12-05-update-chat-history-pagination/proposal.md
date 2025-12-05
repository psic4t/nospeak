# Change: Update chat history pagination to prefer cache over network

## Why
Current scroll-up pagination always hits the network via `fetchOlderMessages`, even when local IndexedDB already contains sufficient history. This causes unnecessary relay load, extra latency, and redundant work after an initial or background history sync.

## What Changes
- Update the message history display behavior so that scroll-up pagination first pages through messages from the local cache before triggering any additional network history fetch.
- Introduce a clear boundary between "local-only" pagination and "network backfill" so the UI can detect when the cache is exhausted and only then request older history from relays.
- Align the implementation with the existing spec intent that older messages on scroll are "loaded from the database" while preserving the ability to fetch missing history in the background.

## Impact
- Affected specs: `messaging` (Message History Display, Message Synchronization).
- Affected code: `src/routes/chat/[npub]/+page.svelte`, `src/lib/db/MessageRepository.ts`, `src/lib/core/Messaging.ts` (or related history-fetch helpers), and any scroll/pagination logic in `ChatView.svelte`.
