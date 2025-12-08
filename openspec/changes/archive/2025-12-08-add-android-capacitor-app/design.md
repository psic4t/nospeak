## Context
Nospeak currently ships as a web client with messaging, settings, relay management, and visual design defined in existing specs. There is no mobile-native packaging or platform-specific behavior specified for Android. We want to ship a full Android app using Capacitor to wrap the existing SvelteKit build while maximizing use of native dialogs and OS integrations.

Constraints and assumptions:
- The existing SvelteKit/Vite build remains the single source of truth for messaging UI and logic.
- The Android app will be a Capacitor shell that loads the compiled web assets from the local bundle, not a remote URL.
- We target a modern Android API level (to be finalized) and Play Store distribution.
- Native dialog usage must not change core messaging semantics already defined in `messaging/spec.md`; it only changes presentation and UX.

## Goals / Non-Goals
- Goals:
  - Provide a repeatable way to build and ship a nospeak Android APK/AAB from this repo using Capacitor.
  - Define how the Android shell starts up, restores state, and hands control to the existing chat routes.
  - Use Capacitor-native dialogs and sheets where it improves UX (media picking, confirmations, errors, permissions, share sheets).
  - Keep the web client largely unchanged, adding only minimal environment detection and bridge helpers.
- Non-Goals:
  - Implement iOS or desktop-native shells in this change.
  - Redesign the messaging UI beyond what is required to integrate native dialogs.
  - Change relay, sync, or messaging semantics beyond platform packaging needs.

## Decisions
- Decision: Use Capacitor as the Android shell framework.
  - Rationale: It integrates cleanly with Vite-built web assets, has first-party Android tooling, and exposes a wide set of native plugins (Dialog, ActionSheet, Share, Filesystem, Haptics, etc.).
- Decision: Bundle web assets locally in the Android app.
  - Rationale: Ensures offline support, predictable performance, and no hard dependency on remote hosting for the main UI.
- Decision: Add a thin TypeScript bridge for native environment detection.
  - Rationale: The web client needs a single place to detect "running inside Capacitor on Android" so that messaging UI can enable native dialogs selectively without scattering platform checks.
- Decision: Prefer native dialogs for confirmations, media picking, and share flows.
  - Rationale: Native dialogs improve user trust, accessibility, and platform consistency vs. custom modals.

## Risks / Trade-offs
- Risk: Divergent UX between web and Android if native dialogs behave differently than web modals.
  - Mitigation: Keep scenarios and acceptance criteria aligned in specs; treat dialogs as presentation detail.
- Risk: Increased build complexity (Android SDK, Java/Kotlin, Gradle).
  - Mitigation: Scope tooling to a separate `android/` directory with clear instructions and optional setup.
- Risk: Plugin surface area creep (adding too many Capacitor plugins).
  - Mitigation: Start with a minimal set: Dialog, ActionSheet, Share, Filesystem/Media picker, Haptics.

## Migration Plan
- Introduce Capacitor configuration and Android shell in a new `android/` directory without changing the existing web deployment.
- Wire the Android build to consume the same production web build artifacts (e.g., `build/` or `dist/`).
- Gradually introduce native dialog usage in the messaging UI behind environment checks so that web behavior remains unchanged.
- Once Android builds are stable, document Play Store signing and release steps.

## Open Questions
- What minimum Android version and device form factors are required (phones only vs. tablets)?
- Are there specific flows (login, media upload, contact management) where native dialogs are preferred or must be avoided?
- Should the Android shell support deep links (e.g., `nospeak://chat/<npub>`) in this initial change or a follow-up?
- Do we require push notifications and background sync in this iteration, or focus solely on foreground messaging?
