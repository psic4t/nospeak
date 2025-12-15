# Change: Android in-app image viewer pinch-zoom

## Why
Users running the Android Capacitor app shell expect native-feeling pinch-to-zoom and panning when viewing images fullscreen. Today, the in-app image viewer only supports scroll-based panning and a fit/full-size toggle, which feels limited on touch devices and forces users to rely on page zoom or external viewers.

## What Changes
- Add pinch-to-zoom, pan, and double-tap reset interactions to the in-app image viewer when running inside the Android Capacitor app shell.
- Keep existing in-app viewer behaviour and layout unchanged for non-Android environments.
- Specify how Android image viewer gestures integrate with existing messaging and back-navigation requirements.

## Impact
- Affected specs: `messaging`, `android-app-shell`.
- Affected code: `src/lib/components/ImageViewerOverlay.svelte`, `src/lib/stores/imageViewer.ts`, and related Android detection/NativeDialogs utilities.
