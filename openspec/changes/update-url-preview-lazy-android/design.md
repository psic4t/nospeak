## Context
The existing messaging spec defines URL preview behavior for non-media HTTP(S) links and requires graceful degradation when metadata cannot be fetched. The current implementation uses a SvelteKit server route (`/api/url-preview`) backed by `UrlPreviewService` to fetch metadata. On the web, this works because the UI and API share the same origin. In the Android Capacitor app shell, however, the UI is loaded from a bundled static build and `/api/url-preview` is not available at the app's origin, so URL previews silently fail. In addition, the current client implementation requests preview metadata whenever a message with a URL is rendered, regardless of whether that message is visible in the scroll viewport.

The goal is to keep the Android shell primarily offline-capable while using the existing server-side URL preview implementation only for visible messages, and to ensure failure of the preview service does not impact the rest of the messaging experience.

## Goals / Non-Goals
- Goals:
  - Use the existing server-side `/api/url-preview` endpoint as the single source of URL preview metadata for both web and Android.
  - Make URL preview fetching lazy and viewport-aware so only visible non-media URLs trigger network requests.
  - Keep the Android app shell loading the main UI from bundled assets, with only the preview calls going to the remote server.
  - Preserve and clarify graceful degradation when metadata cannot be fetched.
- Non-Goals:
  - Changing how messages, media uploads, or history sync work outside of URL preview behavior.
  - Introducing general-purpose client/server caching layers for all metadata; preview responses may remain uncached beyond simple per-message client memory.
  - Redesigning Android offline behavior beyond ensuring that preview failures do not break messaging.

## Decisions
- Decision: Introduce a small, focused client helper (for example, `getUrlPreviewApiUrl`) that encapsulates environment detection and returns the correct endpoint for URL previews, using a same-origin relative path in web browsers and a configured remote base URL when running inside the Android Capacitor app shell.
- Decision: Gate URL preview fetches behind viewport visibility using an `IntersectionObserver` or equivalent mechanism on the message bubble container, so preview requests only start when the relevant message is in view.
- Decision: Add lightweight per-message caching in the message content layer so that once preview metadata has been retrieved (or determined unavailable) for a given URL, subsequent visibility changes do not cause repeated requests for the same message.
- Decision: Keep failure handling silent and non-blocking: when the preview request fails, times out, or returns incomplete data, the message text and its links remain fully functional, and the preview card is simply omitted.
- Decision: Document in the `android-app-shell` spec that the Android shell continues to load UI from locally bundled assets and treats URL previews as an optional enhancement backed by a remote service.

## Risks / Trade-offs
- Risk: Additional complexity around environment detection (web vs Android Capacitor) could lead to configuration drift if not kept small and well tested.
  - Mitigation: Keep the helper minimal, rely on explicit env configuration for the remote base URL, and cover behavior with small unit tests.
- Risk: Using `IntersectionObserver` for each message might impact performance in very large conversations.
  - Mitigation: Scope observers to the scrollable chat container and use simple per-message observers; the preview requirement is optional and may be disabled or simplified later if profiling reveals issues.
- Risk: Remote preview service outages or high latency could still cause delayed previews.
  - Mitigation: Preserve short timeouts and failure conditions in the URL preview service, and keep the UI behavior unchanged when metadata is missing.

## Migration Plan
- Introduce the helper and viewport-gated preview behavior behind the existing `URL Preview for Non-Media Links` requirement so the behavior change is controlled by this change only.
- Roll out the Android configuration pointing URL previews to the remote server while verifying that the rest of the app remains bundled and offline-capable.
- After implementation and validation, keep the behavior documented solely in the specs; no additional migration tooling is required.

## Open Questions
- Should the remote preview calls include any additional headers (for example, app version or platform hints) to help the server tune behavior or logging?
- Do we want to add a setting or feature flag to fully disable URL previews on Android when the user is on a metered connection, or is the existing global URL preview toggle sufficient?
