## 1. URL Preview Implementation
- [x] 1.1 Add or update URL parsing utilities to detect non-media links in message content.
- [x] 1.2 Implement a minimal URL preview fetcher that resolves basic metadata from target pages or an existing API if available.
- [x] 1.3 Add a URL preview card UI component and integrate it into message rendering for eligible links.
- [x] 1.4 Ensure previews coexist with existing inline media rendering and do not break current behavior.
- [x] 1.5 Add unit and/or component tests for URL detection, preview fetching, and rendering behavior.

## 2. UX, Accessibility, and Settings
- [x] 2.1 Define responsive styling for preview cards consistent with existing messaging visual design.
- [x] 2.2 Ensure keyboard and screen reader accessibility for previews, including descriptive text and focus handling.
- [x] 2.3 Add a Settings → General toggle to enable or disable URL previews, with the toggle enabled by default.
- [x] 2.4 Wire the Settings → General toggle into message rendering so that disabling previews hides URL preview cards while leaving links clickable.

## 3. Validation and Cleanup
- [x] 3.1 Run npm run check and npx vitest run, fixing any failures related to URL previews.
- [x] 3.2 Verify URL preview behavior across desktop and mobile layouts.
- [x] 3.3 Update any relevant documentation or inline comments to reflect URL preview behavior.
