# Change: Use Capacitor Haptics for tactile feedback

## Why
The current implementation uses `navigator.vibrate` for soft haptic feedback, which is not available in the Android Capacitor app shell and leads to inconsistent tactile behavior across platforms. Standardizing on the `@capacitor/haptics` plugin will provide more reliable, OS-native haptics on Android while keeping web behavior graceful when haptics are unsupported.

## What Changes
- Update the haptics utility used by the nospeak web client to call Capacitor Haptics APIs instead of `navigator.vibrate` when running inside the Android app shell.
- Define requirements in the android-app-shell spec so that Android builds use OS-native haptic feedback via `@capacitor/haptics` for key micro-interactions.
- Ensure web-only environments degrade gracefully when Capacitor Haptics is unavailable, preserving existing non-blocking behavior.

## Impact
- Affected specs: android-app-shell, visual-design (micro-interaction haptics).
- Affected code: src/lib/utils/haptics.ts, Svelte components that call `softVibrate` (for example, src/routes/+layout.svelte, src/lib/components/ContactList.svelte, src/lib/components/ChatView.svelte).
