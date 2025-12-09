# Change: NIP-98 Authenticated Media Uploads for Web and Android

## Why
Current media uploads are anonymous and depend on the SvelteKit server origin, which prevents the Android Capacitor app from uploading media and leaves the upload endpoint unauthenticated. We want Android users to upload media via the hosted nospeak server while ensuring uploads are bound to a Nostr key without introducing a traditional user database.

## What Changes
- Require per-request NIP-98 authorization for all media uploads targeting the canonical endpoint `https://nospeak.chat/api/upload`.
- Define canonical upload behavior in the `messaging` spec, including NIP-98 semantics and rejection of unauthorized uploads.
- Add an Android-specific requirement in `android-app-shell` that media uploads in the Android shell use the remote `https://nospeak.chat/api/upload` endpoint with NIP-98 authentication.
- Keep media file handling (UUID filenames in `user_media`, type/size validation, message content URLs) consistent with existing behavior.

## Impact
- Affected specs: `messaging`, `android-app-shell`.
- Affected code: media upload API route (`/api/upload`), media upload UI component, shared signing/auth helpers, and Android webview upload behavior.
- Existing anonymous upload flows that do not supply valid NIP-98 headers will be rejected once implementation is applied, so deployment must coincide with updating all supported clients.
