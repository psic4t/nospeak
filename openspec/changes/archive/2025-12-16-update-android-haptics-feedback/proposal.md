# Change: Update Android haptics to Capacitor Impact/Selection

## Why
The current Android haptics behavior in nospeak is based on an older `softVibrate` abstraction that does not clearly distinguish between different types of feedback (e.g., confirmation vs. selection) and references a generic "soft vibration" concept. Android Capacitor builds already use `@capacitor/haptics`, but the spec still talks about `softVibrate` and does not describe a minimal, intent-based API that can be reused consistently across micro-interactions.

## What Changes
- Replace the `softVibrate`-centric requirement with a minimal, intent-based haptics API that uses Capacitor Haptics on Android.
- Define two concrete micro-interaction types for Android: a light impact for confirmations and a selection tick for option changes.
- Clarify that Android haptics remain non-blocking and are only applied when running inside the Android Capacitor app shell; web behavior remains unchanged.
- Align android-app-shell and visual-design specs on when to use impact vs. selection feedback for common chat micro-interactions.

## Impact
- Affected specs: `android-app-shell`, `visual-design`.
- Affected code: Android haptics utility and any call sites that previously used `softVibrate` or navigator-based vibration.
- No changes to messaging semantics; this only refines how tactile feedback is provided for existing interactions on Android.
