# Change: Fix NIP-65 Database Migration and Relay Separation

## Why
The NIP-65 fix is not working because read and write relays are still the same in the database. The root cause is threefold:

1. **Database Migration Bug**: The `migrateRelayListToNIP65()` function copies the same legacy `relay_list` data to both `read_relays` and `write_relays` columns.
2. **Logic Flaw in Profile Resolution**: `ResolveProfile` in `client/profile.go` fetches NIP-65 events but flattens the "read"/"write" markers into a single list before caching.
3. **Inadequate Cache Interface**: `SetProfileWithRelayList` only accepts a single `relayList` slice, forcing all callers to flatten their data.

## What Changes
- **Cache Interface**: Update `SetProfileWithRelayList` (or introduce `SetProfileWithNIP65`) to accept separate `readRelays` and `writeRelays`.
- **Profile Resolution**: Update `ResolveProfile` to correctly parse `read` and `write` markers from Kind 10002 events and pass them separately to the cache.
- **Database Migration**: Fix `migrateRelayListToNIP65` to avoid duplicating legacy data to both columns (default to read-only or empty write, or better heuristic).
- **Data Integrity**: Implement duplicate removal and correct backward compatibility for unmarked relays.

## Impact
- Affected specs: client, cache
- Affected code: 
  - `client/profile.go`: `ResolveProfile` logic
  - `cache/sqlite.go`: `SetProfileWithRelayList`, migration logic
  - `cache/interface.go`: Interface definition
- **DATA MIGRATION**: Existing cached relay data will be corrected/migrated on next cache initialization.
