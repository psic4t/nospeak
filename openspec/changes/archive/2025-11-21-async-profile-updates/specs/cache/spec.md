# Cache Spec Changes

## `GetProfile`

### Current Behavior
*   Checks if the profile has expired (`time.Now().After(expiresAt)`).
*   If expired, deletes the profile from the database (`deleteExpiredProfile`).
*   Returns `ProfileEntry{}, false`.

### New Behavior
*   **Do not** check for expiration or delete expired profiles within `GetProfile`.
*   Return the profile entry and `true` (found) if it exists in the database, regardless of its expiration timestamp.
*   The responsibility of checking `ExpiresAt` is shifted to the consumer (Client layer).

### Implementation Details
*   In `cache/sqlite.go`, modify `GetProfile(npub string) (ProfileEntry, bool)`:
    *   Remove the logic that checks `time.Now().After(expiresAt)`.
    *   Remove the call to `go sc.deleteExpiredProfile(npub)`.
    *   Ensure `expiresAt` is still correctly populated in the returned `ProfileEntry`.
