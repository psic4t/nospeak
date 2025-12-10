## 1. Specification and design
- [x] 1.1 Draft proposal and spec deltas for in-app image viewer
- [x] 1.2 Review and refine requirements based on feedback

## 2. Messaging UI implementation
- [x] 2.1 Update MessageContent image rendering to open an in-app viewer instead of a new browser tab
- [x] 2.2 Implement full-screen viewer overlay with fit-to-screen and full-size (pannable) modes
- [x] 2.3 Add SVG icon buttons for close, full-size toggle, and download consistent with existing UI
- [x] 2.4 Ensure viewer behavior preserves existing URL preview and media rendering semantics

## 3. Android native integration
- [x] 3.1 Detect Android native shell environment for viewer actions
- [x] 3.2 Wire viewer share control to Capacitor Share plugin via existing native dialog service
- [x] 3.3 Verify that viewer share is hidden or gracefully degraded on web

## 4. Validation and polish
- [x] 4.1 Add or update unit tests and/or component tests around MessageContent media behavior
- [x] 4.2 Manually verify web (desktop/mobile) and Android app behaviors for image tapping, panning, download, and share
- [x] 4.3 Run `npm run check` and `npx vitest run` and fix any issues
- [x] 4.4 Update documentation or help text if needed
