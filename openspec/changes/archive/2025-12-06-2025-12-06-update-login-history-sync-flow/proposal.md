# Change: Stabilize login history sync flow

## Why
The current login flow with history fetching is fragile and allows other background behaviors to start before critical initialization and history synchronization complete, leading to inconsistent UI states and race conditions. We need a clearly defined, blocking flow with a progress modal that remains visible until all required steps have completed.

## What Changes
- Define a sequential login and first-time history sync flow that blocks other background messaging behaviors until completion.
- Require a history fetching modal to remain visible and blocking for the entire flow, showing clear step-by-step progress.
- Specify the ordered steps for discovery relay connection, messaging relay resolution, read relay connection, history fetching, contact enrichment, and user profile caching.
- Clarify when the modal is dismissed and the main chat view is refreshed after the flow completes successfully.

## Impact
- Affected specs: `messaging`
- Affected code: startup login/auth services, relay discovery and connection management, message history sync pipeline, profile and relay info caching, SyncProgressModal UI behavior.
