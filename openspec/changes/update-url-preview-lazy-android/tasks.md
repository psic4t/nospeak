## 1. Spec and Design
- [ ] 1.1 Finalize and approve `update-url-preview-lazy-android` OpenSpec proposal and deltas for `messaging` and `android-app-shell`.

## 2. Implementation
- [ ] 2.1 Introduce a small client-side helper that computes the URL preview API endpoint, using the existing `/api/url-preview` path for web and a configured remote base URL when running inside the Android Capacitor app shell.
- [ ] 2.2 Update the message content component to call the helper for URL preview fetches instead of relying on a hard-coded relative `/api/url-preview` path.
- [ ] 2.3 Add a viewport visibility check (for example, via `IntersectionObserver` or an equivalent mechanism) so that URL preview fetches only start when a message with a non-media HTTP(S) URL is within the scrollable viewport.
- [ ] 2.4 Add simple per-message caching in the client so that once preview metadata has been fetched or determined unavailable for a given URL, additional scrolls do not re-trigger preview requests for the same message.
- [ ] 2.5 Adjust the Android Capacitor configuration and any necessary runtime checks so that only URL preview traffic is routed to the remote SvelteKit instance while the rest of the UI continues to run from the locally bundled assets.
- [ ] 2.6 Ensure that when the remote preview service is unreachable or slow, the message text and link rendering still work and no blocking or noisy error UI is shown.

## 3. Validation
- [ ] 3.1 Add or update unit tests around URL preview metadata fetching and message content behavior to cover viewport-gated fetches and non-repeated requests for the same URL.
- [ ] 3.2 Manually verify in a web browser that URL previews still appear for non-media links when visible, do not trigger for messages off-screen, and degrade gracefully when the preview endpoint is unavailable.
- [ ] 3.3 Manually verify on an Android device or emulator that the Capacitor app shell loads from local assets, that only visible messages with non-media URLs trigger remote preview requests, and that the rest of the messaging experience continues to function when the remote preview service is down.
- [ ] 3.4 Run `npm run check` and `npx vitest run` to ensure the implementation passes type checking and tests.
