## 1. Add i18n Strings

- [x] 1.1 Add toast message to `en.ts` locale
- [x] 1.2 Add toast message to `de.ts` locale
- [x] 1.3 Add toast message to `es.ts` locale
- [x] 1.4 Add toast message to `fr.ts` locale
- [x] 1.5 Add toast message to `it.ts` locale
- [x] 1.6 Add toast message to `pt.ts` locale

## 2. Core Implementation in AuthService

- [x] 2.1 Add module-level session flag `hasNotifiedAboutAutoRelays` to AuthService.ts
- [x] 2.2 Add `resetAutoRelayNotification()` function and call it on logout
- [x] 2.3 Create `checkAndAutoSetRelays()` exported function in AuthService.ts
- [x] 2.4 Modify empty profile check in `runLoginHistoryFlow()` to call auto-set logic for users with username but no relays

## 3. App Resume Handler

- [x] 3.1 Add visibility change handler in `+layout.svelte` that calls `checkAndAutoSetRelays()` when app becomes visible

## 4. Testing and Validation

- [x] 4.1 Run `npm run check` and fix any type errors
- [x] 4.2 Run `npx vitest run` and verify all tests pass
