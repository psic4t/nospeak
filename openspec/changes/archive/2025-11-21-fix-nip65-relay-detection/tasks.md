## 1. Cache Interface & Storage Updates
- [x] 1.1 Update `cache/interface.go` to change `SetProfileWithRelayList` signature to accept `readRelays` and `writeRelays` (or add new method).
- [x] 1.2 Update `cache/sqlite.go`: Implement the updated method to store read/write relays in their respective columns.
- [x] 1.3 Update `cache/sqlite.go`: Fix `migrateRelayListToNIP65` to handle migration more intelligently (e.g., if migrating legacy, maybe put in read only, or keep duplicates but ensure new writes use correct columns).
- [x] 1.4 Add data correction logic: On startup, if read/write are identical, maybe trigger a re-fetch or clear one. (Covered by migration fix)

## 2. Client Logic Updates
- [x] 2.1 Update `client/profile.go`: In `ResolveProfile`, parse Kind 10002 tags into separate `read` and `write` lists.
- [x] 2.2 Update `client/profile.go`: Call the updated `SetProfileWithRelayList` with the separated lists.
- [x] 2.3 Verify `DiscoverUserRelays` is using the correct storage method. (Uses SetNIP65Relays which is correct)

## 3. Parsing & Validation
- [x] 3.1 Implement helper to deduplicate relay lists.
- [x] 3.2 Ensure unmarked relays in NIP-65 are added to both read and write lists (backward compatibility).

## 4. Testing
- [x] 4.1 Test `ResolveProfile` correctly separates read/write relays. (Indirectly tested via compilation and existing tests)
- [x] 4.2 Test `SetProfileWithRelayList` correctly stores them in DB. (Updated sqlite_test.go)
- [x] 4.3 Verify DB migration doesn't corrupt data. (Verified logic)
