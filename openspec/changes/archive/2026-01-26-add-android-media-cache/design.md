## Context
The nospeak Android app downloads and decrypts media on every view. While this is privacy-first, it creates poor UX for repeatedly viewed media and prevents offline access. Users should be able to opt into local caching with gallery visibility.

## Goals / Non-Goals
- Goals:
  - Allow Android users to cache decrypted media locally
  - Make cached media visible in device gallery for easy management
  - Maintain privacy-first defaults (cache off by default)
  - Fast cache lookup to skip blurhash on cached items
- Non-Goals:
  - Encrypted cache (complexity, key management)
  - Web/PWA caching (Android-only for now)
  - Auto-download settings (WiFi only, etc.)
  - In-app cache management UI

## Decisions
- **MediaStore API for storage**: Files stored in `Pictures/nospeak/`, `Movies/nospeak/`, `Music/nospeak/` via MediaStore. This automatically makes them gallery-visible and user-manageable without in-app UI.
- **SHA-256 as cache key**: The Blossom content hash is already available from Kind 15 messages. Use this to identify cached files and avoid duplicates.
- **Filename format**: `{sha256_first_12_chars}_{original_filename_or_ext}` to prevent collisions while remaining human-readable.
- **Toggle disable behavior**: Files remain in gallery; users delete manually if desired. No auto-cleanup.
- **Cache check before blurhash**: If cached, load immediately without showing placeholder animation.

## Risks / Trade-offs
- **Privacy risk**: Users explicitly opt in. Clear that this stores unencrypted copies locally.
- **Storage growth**: Unlimited cache; users manage via gallery. Could add size indicator later.
- **Permission requests**: Android 13+ requires READ_MEDIA_* permissions; graceful fallback if denied.

## Migration Plan
- No migration needed; new opt-in feature.
- Existing users see toggle off by default.

## Open Questions
- None; design decisions confirmed with user.
