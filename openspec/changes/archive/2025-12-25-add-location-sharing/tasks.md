## 1. Dependencies and Configuration
- [x] 1.1 Add AOSP-only AndroidLocation plugin (LocationManager)
- [x] 1.2 Run `npm install` and sync Android with `npm run build:android`
- [x] 1.3 Add Android location permissions to `android/app/src/main/AndroidManifest.xml`:
  - `ACCESS_FINE_LOCATION` for high-precision GPS
  - `ACCESS_COARSE_LOCATION` for fallback Wi-Fi/cellular triangulation
- [x] 1.4 Update `capacitor.config.ts` (no config needed for AndroidLocation plugin)

## 2. Core Location Service
- [x] 2.1 Create `src/lib/core/LocationService.ts` with platform-aware position fetching:
  - Android: Uses custom AndroidLocation plugin (LocationManager)
  - Web: Uses `navigator.geolocation.getCurrentPosition()`
  - Returns `{ latitude, longitude }`
  - Handles permission errors gracefully

## 3. Message Interface Extension
- [x] 3.1 Update `src/lib/db/db.ts` Message interface:
  ```typescript
  location?: {
      latitude: number;
      longitude: number;
  };
  ```

## 4. Messaging Service Updates
- [x] 4.1 Add `sendLocationMessage(recipientNpub, latitude, longitude)` to MessagingService:
  - Creates Kind 14 rumor with `['p', 'location']` tags
  - Content: `geo:lat,lng` format
  - Gift wraps and publishes to recipient's messaging relays
  - Saves to IndexedDB with location data
  - Returns rumor ID
- [x] 4.2 Update `createMessageFromRumor()` to parse location:
  - Detects `['location']` tag
  - Parses `lat,lng` into location object
  - Attaches to Message record

## 5. Media Menu Location Action
- [x] 5.1 Add "Location" entry to the media upload dropdown (`MediaUploadButton` / `FileTypeDropdown`)
- [x] 5.2 Wire "Location" entry to ChatView handler

## 6. ChatView Integration
- [x] 6.1 Add `handleLocationSelect(lat, lng)` function:
  - Creates optimistic message with location data
  - Calls `messagingService.sendLocationMessage()`
  - Updates relay status on success/failure
  - Restores optimistic message on failure
- [x] 6.2 Add location preview-before-send flow:
  - `handleShareLocation()` fetches GPS and opens preview modal
  - Preview modal confirms Send/Cancel

## 7. Message Content Rendering
- [x] 7.1 Update `MessageContent.svelte` to accept location prop
- [x] 7.2 Add location rendering section:
  - Renders before fileUrl section
  - Shows small label + map iframe inline
  - Does not display coordinates
  - Styling consistent with message bubble theme

## 8. AttachmentPreviewModal Extension
- [x] 8.1 Add mode prop to AttachmentPreviewModal: `'media' | 'location'`
- [x] 8.2 Add location prop: `{ latitude, longitude } | null`
- [x] 8.3 Derive OpenStreetMap embed URL from location:
  - Bbox: `lng-0.01,lat-0.01,lng+0.01,lat+0.01`
  - Layer: `mapnik`
  - Marker overlay: `&marker=lat,lng`
- [x] 8.4 Derive full OSM URL for external open:
  - Format: `https://www.openstreetmap.org/?mlat={lat}&mlon={lng}&zoom=15`
- [x] 8.5 Update modal content area:
  - When `mode === 'location'`: render interactive OSM iframe
  - When `mode === 'media'`: keep existing image/video/audio rendering
- [x] 8.6 Support location preview map in location mode
- [x] 8.7 In location mode, support either:
  - Open-in-OpenStreetMap primary action (view-only)
  - Send confirmation button (preview-before-send)

## 9. Translations
- [x] 9.1 Add to `src/lib/i18n/locales/en.ts`:
  ```typescript
  location: {
      errorTitle: 'Location Error',
      errorMessage: 'Failed to get your location. Please check permissions.'
  }
  ```
- [x] 9.2 Add to `src/lib/i18n/locales/de.ts`:
  ```typescript
  location: {
      errorTitle: 'Standortfehler',
      errorMessage: 'Standort konnte nicht abgerufen werden. Bitte überprüfen Sie die Berechtigungen.'
  }
  ```

## 10. Testing
- [x] 10.1 Write unit tests for LocationService
- [ ] 10.2 Manual Android testing:
  - Permission request flow
  - GPS accuracy with high-precision permission
  - Fallback to coarse location when fine denied
- [ ] 10.3 Manual web testing:
  - Browser geolocation API
  - Permission denial handling
- [ ] 10.4 End-to-end testing:
  - Send location from Android → Web and verify decryption
  - Verify location renders in chat
  - Test modal opens with interactive OSM map
  - Test "Open in OpenStreetMap" external link
- [x] 10.5 Run `npm run check` to verify TypeScript
- [x] 10.6 Run `npx vitest run` to verify no regressions

## 11. Validation
- [x] 11.1 Validate with `openspec validate add-location-sharing --strict`
- [x] 11.2 Fix any validation errors
