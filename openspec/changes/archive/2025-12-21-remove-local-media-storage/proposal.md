# Change: Remove internal media storage; default to Blossom

## Why
nospeak currently supports media uploads via a built-in `user_media` storage path served from `https://nospeak.chat/api/user_media/...`. With Blossom server support integrated, maintaining an internal storage backend increases complexity and creates an extra upload mode users can misconfigure.

## What Changes
- **BREAKING**: Remove the internal `user_media` storage and all related upload/serving routes (`/api/upload`, `/api/user_media`, `/user_media`).
- Use Blossom servers for all media uploads (chat attachments and profile media).
- Remove the Settings → Media Servers "Use Blossom servers" toggle.
- When a user attempts to upload with no configured Blossom servers:
  - Automatically configure two default Blossom servers: `https://blossom.primal.net` and `https://24242.io`.
  - Show an in-app info modal explaining the servers were added.
  - Proceed with the upload.
- When message content references the deprecated internal URL prefix `https://nospeak.chat/api/user_media`, render a placeholder instead of attempting to load media.

## Impact
- Affected specs: `settings`, `messaging`, `android-app-shell`
- Affected code:
  - Settings UI (Media Servers category)
  - Upload flows (chat attachments + profile media)
  - Message media rendering
  - SvelteKit API routes under `/api/upload` and `/api/user_media`
- User impact:
  - Existing internal-storage media links in chats will no longer render; users see a placeholder.
  - Users without media server configuration can still upload (defaults are auto-configured).
