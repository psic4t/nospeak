# Async Profile Updates

## Summary
Modify the profile and relay caching system to return cached data immediately, even if expired, while triggering an asynchronous background update. This ensures instant availability of profile information and mailbox relays on startup and improves offline capability.

## Motivation
Currently, when a cached profile or relay list expires, it is immediately deleted and treated as a cache miss. This causes:
1.  Delays on startup or when viewing contacts as fresh data must be fetched from relays.
2.  Inability to display profile info or send messages (if relays are missing) when offline, even if data was previously cached.
3.  Unnecessary blocking behavior for the user while waiting for network operations.

## Proposed Changes
1.  **Cache Layer (`cache`):**
    *   Update `GetProfile` in `SQLiteCache` to return expired profiles instead of deleting them.
    *   The caller will be responsible for checking expiration and triggering updates.

2.  **Client Layer (`client`):**
    *   Update `ProfileResolver` to use cached data immediately, regardless of expiration.
    *   Add logic to check `ExpiresAt` and trigger `RefreshProfile` in a background goroutine if the data is expired.
    *   Implement a mechanism (e.g., a `refreshing` map) to prevent duplicate concurrent refresh attempts for the same profile.

## Impact
*   **Startup Time:** Significantly reduced as cached data is used instantly.
*   **User Experience:** UI populates immediately; updates happen silently in the background.
*   **Network Efficiency:** Network calls are non-blocking.
*   **Offline Support:** Previously cached profiles and relay lists remain accessible even if "expired", allowing functionality (like viewing history or drafting messages) without network connectivity.
