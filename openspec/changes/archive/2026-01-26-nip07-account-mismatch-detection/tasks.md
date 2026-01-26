# Tasks: NIP-07 Account Mismatch Detection

## 1. Core Infrastructure

- [x] 1.1 Create `src/lib/stores/signerMismatch.ts` with mismatch state store
- [x] 1.2 Add `getCurrentSignerPubkeyUncached()` static method to `Nip07Signer.ts`
- [x] 1.3 Add mismatch guard (`checkMismatch()`) to `signEvent()`, `encrypt()`, `decrypt()` methods

## 2. SignerVerification Service

- [x] 2.1 Create `src/lib/core/SignerVerification.ts` with verification logic
- [x] 2.2 Implement `verifyCurrentSigner(expectedPubkeyHex: string): Promise<boolean>` method
- [x] 2.3 Implement `startPeriodicVerification(expectedPubkeyHex: string)` with focus listener (periodic timer removed - NIP-07 extensions cache pubkey)
- [x] 2.4 Implement `stopPeriodicVerification()` cleanup method
- [x] 2.5 Add timeout handling for unresponsive extensions (5 second timeout)

## 3. AuthService Integration

- [x] 3.1 Modify `loginWithExtension()` to start periodic verification after successful login
- [x] 3.2 Modify `restore()` NIP-07 branch to verify signer before completing restore
- [x] 3.3 Modify `logout()` to stop verification and clear mismatch state
- [x] 3.4 Store expected pubkey (hex) when setting up NIP-07 session

## 4. Modal Component

- [x] 4.1 Create `src/lib/components/SignerMismatchModal.svelte` with non-dismissible behavior
- [x] 4.2 Display warning icon and clear message about account mismatch
- [x] 4.3 Show expected vs actual pubkey (truncated, e.g., `npub1abc...xyz`)
- [x] 4.4 Display instruction: "Switch to the correct account in your signer extension and reload this page"
- [x] 4.5 Style modal with high z-index (z-[100]) to cover all other content

## 5. Layout Integration

- [x] 5.1 Import `signerMismatch` store in `src/routes/+layout.svelte`
- [x] 5.2 Import and render `SignerMismatchModal` when `$signerMismatch?.detected` is true
- [x] 5.3 Ensure modal renders above all other modals (highest z-index)

## 6. Internationalization

- [x] 6.1 Add English translations to `src/lib/i18n/locales/en.ts`
- [x] 6.2 Add German translations to `src/lib/i18n/locales/de.ts`
- [x] 6.3 Add Spanish translations to `src/lib/i18n/locales/es.ts`
- [x] 6.4 Add French translations to `src/lib/i18n/locales/fr.ts`
- [x] 6.5 Add Italian translations to `src/lib/i18n/locales/it.ts`
- [x] 6.6 Add Portuguese translations to `src/lib/i18n/locales/pt.ts`

## 7. Testing and Validation

- [x] 7.1 Write unit tests for `SignerVerification.verifyCurrentSigner()` 
- [x] 7.2 Write unit tests for mismatch guard in `Nip07Signer` methods
- [x] 7.3 Run `npm run check` and fix any type errors
- [x] 7.4 Run `npx vitest run` and ensure all tests pass
- [x] 7.5 Manual testing: Login with NIP-07, switch extension account, reload - verify modal appears
