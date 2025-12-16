## Context

Encrypted media DMs (Kind 15) are stored as encrypted blobs on the nospeak media API and decrypted client-side in the web layer. The in-app image viewer already receives a decrypted `blob:` URL for encrypted images. On Android, the existing native share flow passes this `blob:` URL directly to the Capacitor Share plugin, which does not understand WebView-specific URLs. Recipients either fail to get a usable image or the share action is silently ignored. We also need to ensure decrypted artifacts created for sharing are treated as temporary and cleaned up.

## Goals / Non-Goals
- Goals:
  - Ensure that sharing an encrypted image from the Android in-app viewer delivers a decrypted, viewable image to the chosen target app.
  - Keep the current desktop/web behavior (viewing and downloading) unchanged.
  - Introduce a clear, minimal lifecycle for temporary decrypted share files on Android so they do not accumulate.
- Non-Goals:
  - Redesign the overall encrypted media pipeline, message formats, or upload endpoints.
  - Change how desktop/web sharing or downloading works for encrypted media beyond what is already implemented.

## Decisions
- Decision: Use a Capacitor-compatible filesystem (for example, `@capacitor/filesystem` or an equivalent bridge) to materialize a decrypted image file in the Android app’s cache directory when the user taps Share in the in-app viewer for an encrypted image.
- Decision: Keep WebView rendering behavior the same by continuing to use `blob:` URLs for decrypted images inside the viewer; only the Android-native share path sees the on-disk file.
- Decision: Define explicit requirements that temporary decrypted share files:
  - Live in an app-controlled cache or temporary directory.
  - Are not relied on for long-term storage or message history.
  - Are periodically or opportunistically cleaned up (for example, after the share action completes or on app startup / maintenance passes).
- Alternatives considered:
  - Directly uploading a second, decrypted copy of the media for sharing. Rejected because it would leak private content to a new, potentially public URL and create divergence between DM and shared artifacts.
  - Attempting to teach the native share layer to understand WebView `blob:` URLs. Rejected because `blob:` is inherently process-local and not a stable, cross-process contract on Android.

## Risks / Trade-offs
- Risk: Poor or overly aggressive cleanup could remove temporary files still in use by a long-running share target, causing errors when the recipient app tries to read the file. Mitigation: Treat cleanup as best-effort and time- or session-based (for example, cleanup on next app start or after a grace period), rather than synchronous deletion as soon as Share resolves.
- Risk: Additional decrypted artifacts in the cache directory increase the footprint of sensitive content on disk. Mitigation: Restrict these files to app-private cache locations, ensure they are not indexed or shared beyond the specific share intent, and constrain their lifetime via the new cleanup requirement.

## Migration Plan
- Introduce new requirements in `android-app-shell` spec describing decrypted-image sharing semantics and temp-file lifecycle.
- Update the Android share implementation for the in-app image viewer to:
  - Detect encrypted/decrypted viewer content that is only available via `blob:` URL.
  - Create a temporary decrypted file in an app-private cache directory from the `blob:` content.
  - Pass this file path/URI to the Capacitor Share plugin’s `files` parameter.
- Add a small cleanup routine for these temporary files (for example, a best-effort sweep on app startup or when initializing the messaging shell) that deletes stale entries.
- Keep the desktop/web viewer and download behavior intact.

## Open Questions
- How aggressively should temp file cleanup run (only on startup, periodically while the app runs, or after each share with a delay)?
- Should the temp files be named generically (for example, UUID plus extension) or carry hints from the original file type to improve UX in recipient apps?
