# Fix User Relay Population

## Problem Description
Users' own read and write relays are not being populated correctly. The test user `npub1ux483vq9nztq79ajrl7fmk46z6qljj79ld7tp8q0pprvwzdukacsytfkau` has only `wss://auth.nostr1.com` in read_relays, while all other relays are missing and write_relays are completely empty.

## Analysis
Based on code review, there are several potential issues:

1. **Cache Layer Issues**: The `SetNIP65Relays` method in cache/sqlite.go:1163 updates the profile_cache table with both read and write relays, but there may be issues with how this data is retrieved or persisted.

2. **Profile Resolution Logic**: The `ResolveProfile` method in client/profile.go:58 queries for both kind 0 (profile) and kind 10002 (NIP-65 relay list) events, but there may be issues with parsing or caching the relay information.

3. **NIP-65 Parsing**: The relay list parsing logic in client/profile.go:115-135 may not be correctly handling all NIP-65 tag formats or may be losing relays during processing.

4. **Cache Invalidation**: There may be issues with cache expiration or background refresh that cause relay data to become stale or be lost.

## Root Cause Hypothesis
The primary issue appears to be in the NIP-65 relay list processing logic. The current implementation may be:
- Not correctly parsing all relay tags from kind 10002 events
- Dropping relays during deduplication
- Having race conditions between profile updates and relay discovery
- Not properly handling cases where users have separate read and write relay lists

## Scope
- Fix NIP-65 relay list parsing and caching
- Ensure proper population of both read_relays and write_relays fields
- Add validation and debugging capabilities for relay population
- Maintain backward compatibility with existing cache data

## Success Criteria
- Users' own relay lists are correctly populated in both read_relays and write_relays fields
- All valid relays from NIP-65 events are preserved and correctly categorized
- Cache updates work reliably without data loss
- Background refresh maintains data integrity