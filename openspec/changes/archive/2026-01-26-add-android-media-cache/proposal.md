# Change: Add Android Media Cache

## Why
Currently, every media view in the Android app requires re-downloading and re-decrypting from Blossom servers. This creates slow, repetitive loading for media users have already viewed and prevents any offline access. Adding an optional media cache improves UX while maintaining privacy-first defaults.

## What Changes
- Add a "Media Cache" toggle under Settings → Media Servers (Android-only)
- When enabled, decrypted media is saved to the device gallery (`Pictures/nospeak/`, `Movies/nospeak/`, `Music/nospeak/`) using MediaStore API
- Cached media is checked first before network fetch (skipping blurhash for cached items)
- Cache is off by default; users manage/delete cached files via their gallery app
- Files remain in gallery if user disables the toggle

## Impact
- Affected specs: `settings`, `android-app-shell`
- Affected code: MediaShare.ts, Settings components, MessageContent.svelte, Android Capacitor layer
