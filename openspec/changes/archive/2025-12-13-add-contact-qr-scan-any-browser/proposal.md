# Change: Contact QR scanning on any camera-capable browser

## Why
Users can currently scan contact QR codes only in the Android app, even though the implementation already uses browser camera APIs. Extending this to any browser with a camera improves onboarding and contact sharing across desktop and PWA environments.

## What Changes
- Expose the existing Scan Contact QR modal on any browser that supports getUserMedia, not just the Android Capacitor shell.
- Update contact list header behavior so the scan trigger appears whenever camera access is available, including desktop browsers with webcams.
- Ensure QR decoding continues to parse nostr npub payloads consistently across platforms.

## Impact
- Affected specs: messaging
- Affected code: src/lib/components/ContactList.svelte, src/lib/components/ScanContactQrModal.svelte, src/lib/utils/qr.ts, src/lib/stores/modals.ts
