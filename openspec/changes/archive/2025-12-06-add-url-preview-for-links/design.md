## Context
Current messaging behavior renders inline media previews for image and video URLs but treats non-media links as plain text. Users have to click through to understand what a link points to, which impacts trust and usability, especially on small screens.

This change introduces URL previews for non-media links in chat messages using a minimal, privacy-conscious approach that works within the existing Svelte client architecture.

## Goals / Non-Goals
- Goals:
  - Provide a compact, consistent preview card for non-media URLs shared in messages.
  - Reuse existing message rendering and theming patterns where possible.
  - Keep the implementation simple and performant, avoiding heavy dependencies.
  - Handle failures and timeouts gracefully without impacting message delivery.
- Non-Goals:
  - Implement a full web crawler or advanced content analysis.
  - Support previews for every possible protocol beyond standard HTTP(S) links.
  - Guarantee previews for all links; fallback to plain text is acceptable.

## Decisions
- Decision: Detect URLs at render time using a small, well-scoped URL parsing utility that can distinguish media vs non-media links based on extension and/or content type hints.
- Decision: Render at most one preview card per distinct URL in a message bubble to avoid clutter; multiple identical links SHALL not produce duplicate preview cards.
- Decision: Fetch preview metadata using a simple, cached client-side or server-assisted request (depending on existing architecture) that retrieves page title, description (when available), and a small image or favicon.
- Decision: When metadata fetch fails, times out, or returns incomplete data, the message SHALL remain visible and clickable as plain text and MAY omit the preview card entirely rather than showing an error.
- Decision: URL previews SHALL respect existing theme tokens and typography so that cards blend into current light/dark visual design.

## Risks / Trade-offs
- Risk: Fetching previews for many links could introduce latency or load on external sites.
  - Mitigation: Limit concurrent preview fetches, cache results per URL, and avoid repeated requests across conversations.
- Risk: Some sites may block or rate-limit preview requests.
  - Mitigation: Treat failures as non-fatal and skip the preview without surfacing noisy errors to users.
- Risk: Privacy concerns about hitting third-party URLs.
  - Mitigation: Keep preview fetches minimal, rely on standard HTTPS requests, and consider a simple user-facing toggle in Settings if needed.

## Migration Plan
- Implement URL detection and preview components behind non-breaking behavior (links still render as text when previews are unavailable).
- Gradually roll out previews in the UI, ensuring existing tests continue to pass.
- Optionally add a setting or feature flag to disable previews if future requirements demand it.

## Open Questions
- Should we support previews for multiple distinct links in a single message, or only the first one?
- Are there specific domains or protocols that SHOULD be excluded from preview fetching for security or privacy reasons?
- Should users have a per-device setting to disable previews, or is a global behavior acceptable for now?
