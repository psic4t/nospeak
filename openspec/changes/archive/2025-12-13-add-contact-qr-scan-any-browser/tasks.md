## 1. Implementation
- [x] 1.1 Detect camera capability (getUserMedia) in ContactList header and expose the Scan Contact QR trigger on any supporting browser.
- [x] 1.2 Update ScanContactQrModal to rely on feature detection instead of Android-only gating while preserving safe cleanup.
- [x] 1.3 Validate cross-platform QR scanning behavior for Android app, mobile web/PWA, and desktop browsers with webcams.
- [x] 1.4 Add or update tests as needed to cover ContactList header behavior and QR parsing logic.
- [x] 1.5 Run npm run check and npx vitest run, fix any failures, and ensure no regressions.
