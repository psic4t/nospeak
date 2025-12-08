# Change: Lazy, server-backed URL previews on Android

## Why
On Android, URL previews currently fail because the Capacitor app shell loads a locally bundled web build without the `/api/url-preview` server route, and the preview fetch runs for all messages in history regardless of visibility. This wastes network resources, breaks previews on Android, and can degrade UX when the remote preview service is unavailable.

## What Changes
- Route URL preview metadata lookups on Android through the existing server-side `/api/url-preview` endpoint while keeping the rest of the Android app shell bundled and offline-capable.
- Make URL preview fetching lazy by only requesting metadata for messages whose non-media URLs are currently within the viewport, avoiding requests for off-screen history.
- Ensure URL previews degrade gracefully when the remote preview service is unreachable so that messaging, media, and navigation continue to function normally and only the preview card is omitted.
- Clarify in the specs how URL preview behavior differs (or stays aligned) between web browsers and the Android Capacitor app shell, including remote dependency and viewport-driven fetching.

## Impact
- Affected specs: `messaging`, `android-app-shell`.
- Affected code (implementation stage, not part of this proposal):
  - URL preview metadata fetcher and `/api/url-preview` route (`src/lib/core/UrlPreviewService.ts`, `src/routes/api/url-preview/+server.ts`).
  - Message rendering and preview trigger logic (`src/lib/components/MessageContent.svelte`, `src/lib/components/ChatView.svelte`).
  - Android-specific configuration for using the remote preview service from the bundled app shell (`capacitor.config.ts` and any preview-related env/config helpers).
