# Change: Improve URL preview UTF-8 handling and image detection

## Why
Current URL preview behavior frequently fails to show correct titles, descriptions, and images for many real-world sites. In particular, HTML entity-encoded umlauts and other non-ASCII characters are rendered incorrectly, and metadata/images are only detected from a narrow set of Open Graph tags. Some sites that present cookie or consent interstitials also expose only minimal metadata, which should still be decoded and rendered correctly rather than appearing with broken entities.

## What Changes
- Clarify URL preview behavior in the messaging spec so that title, description, and image fields MUST correctly decode common HTML entities and character encodings when metadata is available.
- Extend metadata extraction rules to cover a broader but still minimal set of standard tags (Open Graph, Twitter cards, and common fallbacks) and to resolve relative image URLs against the target URL.
- Define graceful behavior when the fetched page is a cookie wall or interstitial that exposes only generic site metadata: previews MAY still use that minimal metadata, but MUST avoid broken entity rendering.
- Document that the Android Capacitor shell continues to rely on the same server-side preview API semantics while treating URL previews as optional enhancements that degrade gracefully.

## Impact
- **Affected specs:** `messaging` (URL Preview for Non-Media Links), `android-app-shell` (Android URL Preview via Remote Server).
- **Affected code:** Server-side URL preview implementation and tests (`src/routes/api/url-preview/+server.ts`, `src/lib/core/UrlPreviewService.ts`, `src/lib/core/UrlPreviewService.test.ts`), and any client code that consumes preview metadata (`src/lib/components/MessageContent.svelte`, `src/lib/components/MessageContent.test.ts`).
- **User experience:** More reliable, correctly decoded URL previews with images and descriptions on a wider range of sites, while preserving existing viewport-based request behavior and graceful degradation when metadata is missing or behind consent walls.
