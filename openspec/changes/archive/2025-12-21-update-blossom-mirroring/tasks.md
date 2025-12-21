## 1. Specification
- [x] 1.1 Add `messaging` spec delta for BUD-04 mirroring

## 2. Blossom mirroring implementation
- [x] 2.1 Add Blossom `PUT /mirror` helper with JSON body
- [x] 2.2 Preserve HTTP status for mirroring errors
- [x] 2.3 Mirror concurrently to remaining servers (non-blocking)
- [x] 2.4 Fallback to `PUT /upload` only for `404/405/501`

## 3. Tests
- [x] 3.1 Add unit tests for `/mirror` success path
- [x] 3.2 Add unit tests for `/mirror` unsupported fallback
- [x] 3.3 Add unit tests for non-fallback failures (401/403)

## 4. Validation
- [x] 4.1 Run `npm run check`
- [x] 4.2 Run `npx vitest run`
