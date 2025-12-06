## 1. Implementation
- [x] 1.1 Add NIP-05 verification utility with caching and NIP-19 decoding helpers.
- [x] 1.2 Extend profile storage model to persist NIP-05 verification status and timestamps.
- [x] 1.3 Integrate NIP-05 verification into profile resolution and profile update flows.
- [x] 1.4 Update Manage Contacts search UI to verify and prioritize NIP-05 results, with badges.
- [x] 1.5 Update Profile and Settings UIs to display NIP-05 and verification status according to spec.
- [x] 1.6 Add or update tests for profile verification, storage, and search ranking behaviour.

## 2. Validation
- [x] 2.1 Run npm run check.
- [x] 2.2 Run npx vitest run.
- [x] 2.3 Manually verify NIP-05 verification flows against at least one working and one intentionally invalid NIP-05 identifier.
