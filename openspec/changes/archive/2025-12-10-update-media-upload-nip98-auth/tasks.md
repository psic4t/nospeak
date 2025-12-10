## 1. Specification and Design
- [x] 1.1 Finalize NIP-98 upload auth proposal and spec deltas for `messaging` and `android-app-shell`.
- [x] 1.2 Align on rollout strategy and compatibility expectations for existing clients (web vs Android).

## 2. Backend Implementation
- [x] 2.1 Implement NIP-98 verification logic for `/api/upload`, enforcing canonical URL `https://nospeak.chat/api/upload`, method `POST`, and a bounded `created_at` window.
- [x] 2.2 Update `/api/upload` responses to include wildcard CORS headers and add an `OPTIONS` handler for preflight.
- [x] 2.3 Add tests for successful and failing NIP-98-authenticated upload attempts and for CORS behavior.

## 3. Frontend Web Implementation
- [x] 3.1 Add a shared helper that builds NIP-98 Authorization headers using the current signer and canonical URL.
- [x] 3.2 Update the media upload UI to POST to `https://nospeak.chat/api/upload` and attach NIP-98 headers, blocking uploads when the user is not authenticated.
- [x] 3.3 Add or update tests around media upload behavior to cover auth failures and success cases.

## 4. Android App Shell Integration
- [x] 4.1 Confirm the Android Capacitor shell routes media uploads to `https://nospeak.chat/api/upload` instead of the local WebView origin.
- [x] 4.2 Verify that NIP-98 signing works for local nsec, NIP-07, and Amber/NIP-46 sessions inside the Android shell.
- [x] 4.3 Exercise Android media upload flows end-to-end, including error handling when the remote endpoint or auth fails.

## 5. Validation and Rollout
- [x] 5.1 Run `npm run check` and relevant tests (including backend upload tests) and fix any regressions.
- [x] 5.2 Validate that media rendering and URLs in messages remain consistent across web and Android.
- [x] 5.3 Monitor production after rollout for upload failures, rate anomalies, or abuse, and adjust limits if needed.
