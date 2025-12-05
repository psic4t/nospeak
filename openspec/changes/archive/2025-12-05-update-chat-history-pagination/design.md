## Context
Scroll-up pagination in the chat view currently calls `messagingService.fetchOlderMessages`, which always queries relays for older gift-wrap events. Meanwhile, the UI refreshes the full message list for the current partner from IndexedDB. This means scroll-up always drives a network call even when local history is already complete from prior sync.

## Goals / Non-Goals
- Goals:
  - Prefer local IndexedDB history for scroll-up pagination.
  - Only fetch from relays when there is evidence that the local cache does not yet contain older messages.
  - Keep the implementation simple and non-breaking for existing sync flows.
- Non-Goals:
  - Redesign the entire sync strategy or batch sizing.
  - Introduce per-conversation sync state beyond what is needed to decide when to call `fetchOlderMessages`.

## Decisions
- Decision: Introduce an explicit repository-level pagination API that can answer "give me the next N older messages before timestamp T for this conversation" using only IndexedDB data. The chat view will use this to extend the visible window on scroll without involving the network.
- Decision: Treat `messagingService.fetchOlderMessages` as a backfill mechanism of last resort that is only invoked when a scroll-up occurs and the local page returns fewer than the requested page size (indicating a possible gap) or zero local messages (indicating we might not have older history at all).
- Decision: Keep existing first-time and background history sync behavior intact so that initial and restore flows populate as much cache as possible, minimizing how often scroll-up needs to hit the network.

## Risks / Trade-offs
- Risk: If some relays are slow or incomplete during initial sync, relying primarily on cache for pagination could temporarily hide older messages until backfill is triggered by scroll-up. Mitigation: Continue to support `fetchOlderMessages` as a targeted backfill call and consider a per-conversation flag or heuristic (e.g., detecting last-known timestamps) in future changes if needed.
- Risk: More complex pagination logic in the UI could introduce regressions around scroll position or duplicate messages. Mitigation: Ensure repository pagination is deterministic and that the UI deduplicates by message/event ID when merging newly loaded pages.

## Migration Plan
- Implement the repository pagination API and update the chat view to use it exclusively for scroll-up.
- Gate calls to `fetchOlderMessages` behind a clear "cache exhausted" condition.
- Test the behavior across first-time sync, restored sessions, and conversations with and without deep history.

## Open Questions
- Should the page size for local pagination exactly match the network batch size (currently 50), or should the UI use a smaller page size for smoother scroll behavior?
- Do we want a per-conversation marker to explicitly track whether a full history sync has completed, versus inferring exhaustion purely from missing local rows?
