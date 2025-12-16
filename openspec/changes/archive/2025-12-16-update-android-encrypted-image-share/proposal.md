# Change: Android encrypted image viewer sharing uses decrypted media

## Why
Encrypted image attachments currently open correctly in the in-app image viewer, but sharing from the Android Capacitor shell fails or behaves inconsistently because the viewer passes a WebView-only `blob:` URL to the native Share plugin. Android recipients either do not receive a usable image or sharing silently fails. We also need to avoid leaving decrypted media lying around indefinitely when creating native-shareable files.

## What Changes
- Define that, on Android, sharing from the in-app image viewer for encrypted Kind 15 image messages SHALL use the decrypted image bytes as the share target rather than the encrypted download URL.
- Specify that the Android shell SHALL create an ephemeral, shareable file for decrypted media when needed and pass that file to the native share sheet via the Capacitor Share plugin or equivalent.
- Add requirements for cleaning up these temporary decrypted media files so they do not accumulate indefinitely and are treated as short-lived artifacts.
- Clarify that existing desktop/web in-app image viewer behavior (including download semantics) remains unchanged.

## Impact
- Affected specs: `specs/android-app-shell/spec.md` (Android native dialog & share integration, in-app image viewer behavior; new temp-file lifecycle requirements).
- Affected code: Android shell integration and web viewer code paths around encrypted media sharing, including the in-app image viewer component, native dialog abstraction, and any new helper for writing temporary decrypted media files on Android.
