# Change: Add Android Capacitor app shell

## Why
We want a first-class Android experience for nospeak that packages the existing Svelte web client inside a native shell, uses Capacitor for runtime integration, and leans on native dialogs where possible for trust, accessibility, and OS consistency.

## What Changes
- Add a Capacitor-based Android shell that bundles the existing nospeak web client and supports local development and production builds.
- Define platform-specific startup, navigation, and offline behavior for the Android shell while preserving messaging semantics from the web client.
- Integrate Capacitor plugins (e.g., Dialog, ActionSheet, Share, Filesystem, Camera/Media picker, Haptics) so common flows can use native dialogs instead of custom HTML modals where appropriate.
- Introduce a capability boundary between the web messaging UI and the Android shell so specs can describe Android-only behavior without duplicating existing messaging requirements.
- Document how the Android app is configured, built, signed, and released, including how it consumes the web build artifacts.

## Impact
- Affected specs: `messaging`, new `android-app-shell` capability.
- Affected code: SvelteKit web client build pipeline, new Capacitor configuration, Android project under `android/` (or similar), bridging utilities for native dialog integration in the messaging UI.
- Tooling: Adds Capacitor CLI and Android build toolchain as project dependencies for mobile builds.
