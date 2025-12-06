## Context
The login and initial history synchronization flow currently allows multiple background behaviors (relay connections, subscriptions, UI interactions) to start before history fetching and profile hydration are complete. This can lead to race conditions, incomplete histories, and confusing UI transitions. A blocking history modal exists but its lifecycle and step semantics are not fully specified.

## Goals / Non-Goals
- Goals:
  - Define a deterministic, ordered login history flow that is easy to reason about.
  - Ensure the history modal remains visible and blocking until all required steps complete.
  - Expose discrete steps for user feedback and debugging.
- Non-Goals:
  - Redesign authentication mechanisms.
  - Change underlying relay or database technologies.

## Decisions
- Decision: Represent the login history flow as a strictly ordered sequence of phases that must complete before the main messaging UI becomes interactive.
- Decision: Drive the SyncProgressModal content from an explicit step state machine that surfaces user-friendly labels for each phase.
- Decision: Block other messaging startup behaviors (subscriptions, contact list rendering dependent on history, etc.) until the flow reaches a terminal success or failure state.

## Risks / Trade-offs
- Risk: Longer blocking periods for users with slow relays or large histories.
  - Mitigation: Ensure progress feedback is granular and clearly communicates which step is in progress.
- Risk: Hard failures in one step could leave the user blocked.
  - Mitigation: Define clear error states and recovery/ retry options in implementation.

## Migration Plan
- Introduce the new stepwise flow behind the updated spec requirements.
- Refactor existing startup/login and sync pipelines to map into the ordered phases.
- Update SyncProgressModal to display per-step status and remain visible until completion.
- Verify behavior for both first-time sync and subsequent logins with cached data.

## Open Questions
- Should failure in a non-critical step (for example, fetching extended relay info for contacts) allow the user to proceed with a warning, or keep the modal blocking until retried or skipped?
- Are there additional steps (such as key backup or settings validation) that should be integrated into this flow in future changes?
