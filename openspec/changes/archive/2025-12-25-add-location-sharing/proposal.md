# Proposal: Add Location Sharing to nospeak

## Why
Users need the ability to share their GPS location with contacts in encrypted DMs. This enables coordination for meetups, sharing current location, or requesting location help. Location sharing should be encrypted end-to-end like other message types, and should show a preview modal before sending plus an inline OpenStreetMap view in the message bubble.

## What Changes
- Add custom `AndroidLocation` Capacitor plugin using Android `LocationManager` (no Google Play Services), with `navigator.geolocation` fallback for web
- Add Android location permissions to `AndroidManifest.xml` (ACCESS_FINE_LOCATION, ACCESS_COARSE_LOCATION)
- Extend `Message` interface with optional `location` field containing `{ latitude, longitude }`
- Add `sendLocationMessage()` method to MessagingService for sending location via NIP-17 Gift Wrap
- Add location parsing to `createMessageFromRumor()` to extract `['location']` tag from Kind 14 rumors
- Create `LocationService.ts` abstraction layer for platform-aware GPS position fetching
- Add "Location" entry to the media upload menu
- Update `ChatView.svelte` to show a location preview modal before sending, then send encrypted location messages and manage optimistic messages
- Update `MessageContent.svelte` to render location inline (label + map iframe) without showing coordinates
- Extend `AttachmentPreviewModal.svelte` to support `mode="location"` with interactive OpenStreetMap iframe and "Open in OpenStreetMap" button
- Add location-focused translations to `en.ts` and `de.ts` locale files
- No location expiration (locations persist indefinitely per user preference)

## Impact
- **Affected specs**: `messaging`, `visual-design`, `android-app-shell`
- **Affected code**:
  - New files: LocationService.ts
  - Modified files: Messaging.ts, ChatView.svelte, MessageContent.svelte, AttachmentPreviewModal.svelte, Message interface, en.ts, de.ts
  - Modified: AndroidManifest.xml, package.json, capacitor.config.ts
- **Platform**: Android + Web (GPS available on both)
- **Storage**: No new storage - location data travels in encrypted DMs
- **Encryption**: Location messages use existing NIP-17 Gift Wrap encryption
- **Interoperability**: Location data encoded as `geo:lat,lng` content with `['location', 'lat,lng']` tag in Kind 14 rumor
