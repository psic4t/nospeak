# Change: Add URL previews for non-media links

## Why
Users currently see inline rendering only for image and video URLs; non-media links appear as plain text, making it harder to quickly assess shared resources or trust unknown domains. URL previews provide richer context (title, description, domain) without requiring users to leave the chat.

## What Changes
- Add support for detecting non-media URLs in messages and rendering a compact preview card with basic metadata.
- Define safe, minimal metadata fields (title, description, domain, favicon/thumbnail) and fallback behavior when preview data is unavailable.
- Specify user interaction behavior (click opens link in new tab, keyboard and screen reader accessibility).
- Ensure previews coexist gracefully with existing image/video rendering and work across desktop and mobile layouts.
- Implement a user-facing toggle in Settings → General to enable or disable URL previews, with the option enabled by default.

## Impact
- Affected specs: messaging, visual-design
- Affected code: message rendering components (e.g., src/lib/components/MessageContent.svelte), any URL parsing/normalization utilities, and potential background fetch logic for preview metadata.
