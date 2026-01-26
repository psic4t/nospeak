## 1. Implementation

- [x] 1.1 Add MediaCache setting to settings store (Android-only, default off)
- [x] 1.2 Add Media Cache toggle to Settings → Media Servers UI (Android-only)
- [x] 1.3 Create MediaCacheService for Android with MediaStore integration
- [x] 1.4 Implement cache write: save decrypted media to MediaStore after viewing
- [x] 1.5 Implement cache read: check MediaStore by SHA-256 hash before network fetch
- [x] 1.6 Update MessageContent.svelte to skip blurhash for cached media
- [x] 1.7 Add Android permissions for READ_MEDIA_IMAGES/VIDEO/AUDIO (Android 13+)
- [x] 1.8 Write tests for MediaCacheService
- [x] 1.9 Test cache behavior across app restart, toggle disable/enable
