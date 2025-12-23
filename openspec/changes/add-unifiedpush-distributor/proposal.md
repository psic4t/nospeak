# Proposal: Add UnifiedPush Distributor to nospeak

## Why
Nospeak already has a well-functioning Background Messaging service for Android with WebSocket connections to Nostr relays and notification capabilities. This service can be extended to also act as a UnifiedPush distributor, allowing other UnifiedPush-enabled apps (like Mastodon, Tusky, Matrix apps, etc.) to register for push notifications through nospeak. Users can also create their own simple topics (like ntfy) to receive push notifications from self-hosted ntfy-compatible servers.

## What Changes
- Add new Capacitor plugin `AndroidUnifiedPushPlugin` for JS-native communication
- Add Android native components for UnifiedPush distributor:
  - `AndroidUnifiedPushDistributorReceiver` - handles app registrations/unregistrations
  - `AndroidUnifiedPushDistributorLinkActivity` - handles `unifiedpush://link` deep links
  - `AndroidUnifiedPushService` - foreground service with WebSocket client to ntfy server
  - `AndroidUnifiedPushPrefs` - SharedPreferences helper for configuration
- Add JS service layer `UnifiedPushService.ts` for managing UnifiedPush settings and API
- Add "UnifiedPush" category to SettingsModal with:
  - Server URL configuration (ntfy-compatible server)
  - Toggle to enable/disable UnifiedPush
  - List of registered UnifiedPush apps (read-only)
  - Add/remove user-defined topics (simple text strings like "alerts", "backups")
  - "Test Push" button to verify server connection
- Update AndroidManifest.xml with new receiver, link activity, and service

## Impact
- **Affected specs**: `settings`, `android-app-shell`
- **Affected code**:
  - New files: 5 Android native files, 1 TS service file, updates to SettingsModal.svelte
  - Modified files: AndroidManifest.xml, capacitor.config.ts
  - No changes to Web/PWA - this feature is Android-exclusive
- **Storage**: localStorage for server URL and topics, SharedPreferences for native persistence
- **Coexistence**: Works alongside existing Background Messaging service
- **Platform**: Android-only - no changes for web/PWA users
