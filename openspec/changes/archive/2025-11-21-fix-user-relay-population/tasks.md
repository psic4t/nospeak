# Implementation Tasks

1. **Add comprehensive logging for NIP-65 relay discovery**
   - Add debug logs to track relay parsing in profile.go
   - Log raw NIP-65 event content for debugging
   - Track relay counts before and after deduplication

2. **Fix NIP-65 relay list parsing logic**
   - Review and fix tag parsing in client/profile.go:115-135
   - Ensure proper handling of marked and unmarked relays
   - Fix any issues with relay URL validation or normalization

3. **Improve cache layer reliability**
   - Review SetNIP65Relays method in cache/sqlite.go:1163
   - Add validation for relay JSON serialization/deserialization
   - Ensure atomic updates to prevent partial data

4. **Add data validation and repair**
   - Create validation function to detect corrupted relay data
   - Add repair mechanism for profiles with incomplete relay lists
   - Implement cache consistency checks

5. **Enhance debugging tools**
   - Add CLI command to inspect cached relay data for specific users
   - Create debug output for NIP-65 discovery process
   - Add cache inspection capabilities

6. **Add comprehensive tests**
   - Test NIP-65 parsing with various relay list formats
   - Test cache update scenarios and edge cases
   - Integration test with real user data

7. **Verify fix with test user**
   - Test with npub1ux483vq9nztq79ajrl7fmk46z6qljj79ld7tp8q0pprvwzdukacsytfkau
   - Ensure all expected relays are populated correctly
   - Verify both read and write relay lists work properly