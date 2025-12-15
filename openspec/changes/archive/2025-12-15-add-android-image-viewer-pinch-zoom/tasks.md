## 1. Specification and Design
- [x] 1.1 Review existing messaging and android-app-shell specs for image viewer and Android back behaviour
- [x] 1.2 Finalize pinch-to-zoom, pan, and double-tap UX specifically for Android Capacitor shell
- [x] 1.3 Validate spec deltas for `messaging` and `android-app-shell` with `openspec validate add-android-image-viewer-pinch-zoom --strict`

## 2. Implementation
- [x] 2.1 Implement Android-gated gesture handling (pinch, pan, double-tap) in `src/lib/components/ImageViewerOverlay.svelte`
- [x] 2.2 Ensure gesture behaviour respects existing fit-to-screen vs full-size toggle semantics
- [x] 2.3 Integrate gesture state resets with viewer open/close and image URL changes
- [x] 2.4 Preserve non-Android web behaviour (no regression for desktop or mobile browsers)

## 3. Testing and Validation
- [x] 3.1 Run `npm run check` and fix any type or Svelte-check issues
- [x] 3.2 Run `npx vitest run` and update/add tests around image viewer and Android back handling if present
- [x] 3.3 Manually test on Android Capacitor app: pinch-zoom, pan, double-tap reset, and Android back closing the viewer
- [x] 3.4 Manually test on desktop and mobile web that behaviour remains unchanged outside Android shell
