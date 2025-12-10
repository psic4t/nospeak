# Change: In-app image viewer for messages

## Why
On Android, tapping inline images in messages currently opens the system browser, taking users out of the nospeak app. Users expect an in-app viewing experience with basic controls (full-size viewing, download) and platform-appropriate sharing on Android.

## What Changes
- Add an in-app, full-screen image viewer for message media that replaces the current behavior of opening image URLs in a new browser tab.
- Provide viewer controls for closing, toggling between fit-to-screen and full-size (pannable) modes, and downloading the current image.
- When running inside the Android app shell, expose a native "Share" action from the image viewer that opens the Android share sheet via existing Capacitor-native patterns.
- Keep existing media rendering semantics and URL preview behavior intact while layering the viewer on top of the current messaging UI.

## Impact
- Affected specs: `messaging`, `android-app-shell`.
- Affected code: Svelte message rendering (`src/lib/components/MessageContent.svelte`) plus small integrations with existing native share/dialog patterns.
- UX impact: Image taps feel native and contained within the app, with Android users gaining a native share path for message images.
