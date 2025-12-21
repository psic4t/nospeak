## Context
nospeak previously supported media uploads via a built-in server route that persisted files under a `user_media` directory and served them at `https://nospeak.chat/api/user_media/<filename>`. Blossom support adds a standards-aligned, multi-server media storage approach.

## Goals / Non-Goals
- Goals:
  - Make Blossom the only supported upload destination.
  - Preserve a smooth UX when media servers are not configured.
  - Avoid broken UI rendering for legacy internal media URLs.
- Non-Goals:
  - Migrating or mirroring previously uploaded internal-storage media to Blossom.
  - Supporting third-party non-Blossom upload backends.

## Decisions
- Decision: Remove the upload-backend toggle.
  - Rationale: The toggle creates a second "mode" that is now redundant and can lead to inconsistent behaviour.
- Decision: Auto-configure a default Blossom server list on first upload attempt.
  - Rationale: Users should not be blocked from uploading due to missing configuration.
  - Defaults: `https://blossom.primal.net`, `https://24242.io`.
- Decision: Use an in-app modal (same style as QR modals) to inform the user defaults were set.
  - Rationale: Desktop `alert()` dialogs look unpolished; a consistent glass modal fits the product UI.
- Decision: Replace rendering of `https://nospeak.chat/api/user_media/...` URLs with a placeholder.
  - Rationale: The internal endpoints are removed entirely; attempting loads would fail and degrade UX.

## Risks / Trade-offs
- Users may lose access to previously sent internal-storage media.
  - Mitigation: Clear placeholder rendering communicates that content is unavailable instead of a broken image/video element.
- Auto-adding default servers changes user configuration implicitly.
  - Mitigation: One-time informational modal and the ability to edit/remove servers in Settings → Media Servers.

## Migration Plan
1. Ship client that always uploads to Blossom.
2. Remove internal upload + serving endpoints.
3. Render placeholders for legacy internal-storage URLs.

## Open Questions
- None (user confirmed: QR-style modal, exact-host match, remove routes entirely).
