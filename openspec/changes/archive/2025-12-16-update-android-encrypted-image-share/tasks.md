## 1. Specification and Design
- [x] 1.1 Review existing `android-app-shell` and `messaging` specs for image viewer and native share behaviors.
- [x] 1.2 Finalize requirements for Android encrypted image sharing and temporary decrypted file cleanup.

## 2. Android Decrypted Image Sharing Behavior
- [x] 2.1 Update the in-app image viewer Android share behavior so that encrypted images are shared using their decrypted content via a native-shareable file, while unencrypted images continue using URL-based sharing.
- [x] 2.2 Ensure the Android share flow remains non-blocking and falls back gracefully if native sharing is unavailable or fails, without dismissing the viewer unexpectedly.

## 3. Temporary Decrypted File Lifecycle
- [x] 3.1 Introduce a helper or utility in the Android shell integration to create temporary decrypted media files (for example, in an app-private cache directory) from the viewer’s decrypted content.
- [x] 3.2 Implement a cleanup strategy for these temporary decrypted media files (for example, on startup or periodic maintenance) that removes stale files without relying on them for long-term storage.

## 4. Validation
- [x] 4.1 Manually test sharing encrypted images from the Android in-app viewer to multiple target apps and confirm the shared image is decrypted and viewable.
- [x] 4.2 Verify that unencrypted images and desktop/web viewer behavior (including download) remain unchanged.
- [x] 4.3 Confirm that temporary decrypted media files are created in an app-private cache location and that they are cleaned up according to the defined lifecycle.
