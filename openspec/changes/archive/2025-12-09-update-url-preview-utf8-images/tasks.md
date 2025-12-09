## 1. Implementation
- [ ] 1.1 Update server-side URL preview decoding to respect Content-Type charset and correctly handle UTF-8 and common legacy encodings.
- [ ] 1.2 Add HTML entity decoding for title, description, and image fields in the URL preview service so that umlauts and other non-ASCII characters render correctly.
- [ ] 1.3 Expand metadata extraction in the URL preview service to cover standard Open Graph, Twitter card, and common meta tags, and resolve relative image URLs against the target URL.
- [ ] 1.4 Confirm that existing viewport-based and single-request-per-message behavior remains unchanged in the messaging UI.
- [ ] 1.5 Update and extend unit tests for URL preview behavior, including cases with HTML entities, multiple metadata tag sources, and consent/cookie-wall pages.
- [ ] 1.6 Verify Android Capacitor shell behavior continues to call the remote preview API and benefits from the improved decoding and metadata extraction.

## 2. Validation
- [ ] 2.1 Run `npm run check` to ensure type safety and Svelte checks pass.
- [ ] 2.2 Run `npx vitest run src/lib/core/UrlPreviewService.test.ts src/lib/components/MessageContent.test.ts` and then the full test suite with `npx vitest run`.
- [ ] 2.3 Manually test representative URLs (including pages with umlauts, cookie walls, and standard OG/Twitter metadata) in both web and Android shell environments to confirm preview behavior matches the updated specs.
