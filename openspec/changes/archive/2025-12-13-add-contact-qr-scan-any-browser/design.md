## Context
Contact QR scanning is currently wired for the Android app only, even though it uses standard web camera APIs and a shared QR decoding utility. This change generalizes the capability to any browser with camera support while keeping the experience minimal and consistent.

## Goals / Non-Goals
- Goals:
  - Make contact QR scanning available on any browser that exposes getUserMedia.
  - Keep UX consistent across Android, mobile web/PWA, and desktop where possible.
- Non-Goals:
  - Redesign the QR scanning UI or result modal.
  - Change how contact addition or profile resolution works beyond this entry point.

## Decisions
- Decision: Gate the Scan Contact QR trigger via runtime camera capability (navigator.mediaDevices.getUserMedia) instead of Android platform checks, so desktop and mobile browsers with webcams can access the feature.
- Decision: Keep the existing ScanContactQrModal implementation and broaden its platform support by relying solely on feature detection and permission outcomes for camera access.
- Decision: Continue using the existing jsQR-based decoder and npub-specific parsing logic, since it already matches the intended nostr QR payloads.

## Risks / Trade-offs
- Some desktop environments may expose getUserMedia but have misconfigured or blocked cameras, resulting in a camera-error state; we accept this and surface the existing error messaging.
- Browser permission prompts and UX differ across platforms; we rely on native browser behavior instead of attempting to normalize it.

## Migration Plan
- Implement feature-based gating and modal changes behind this spec.
- Verify behavior on Android app, at least one major mobile browser, and at least one desktop browser with a webcam.
- Roll out without data or schema migrations, as this is strictly a client UX enhancement.

## Open Questions
- Should future iterations add a manual image-upload fallback for environments without camera access?
