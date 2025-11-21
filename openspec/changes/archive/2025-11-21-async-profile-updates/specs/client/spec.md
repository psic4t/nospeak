# Client Spec Changes

## `ProfileResolver`

### Architecture
*   Introduce a tracking mechanism for in-flight refresh operations (e.g., `refreshing map[string]bool` with a mutex) to avoid duplicate network requests for the same profile.
*   Introduce a background worker or just use `go routine` for refreshing profiles.

### `GetFullProfile`
*   **Current:** Checks cache. If found (implies not expired due to current cache logic), returns it. If not found, fetches from network (blocking), caches it, and returns it.
*   **New:**
    1.  Check cache (`GetProfile`).
    2.  If found:
        *   Return the cached profile immediately.
        *   Check if `time.Now().After(cachedProfile.ExpiresAt)`.
        *   If expired, trigger an asynchronous refresh (`triggerBackgroundRefresh(npub)`).
    3.  If not found:
        *   Fetch from network (blocking) as before, or potentially trigger background fetch and return empty/loading state (though keeping it blocking for completely new profiles might be safer for now to ensure UI has *something*).
        *   *Decision:* Keep blocking for *missing* profiles to maintain current behavior for new contacts, but non-blocking for *expired* profiles.

### `triggerBackgroundRefresh(npub)`
*   Check if `npub` is already being refreshed. If so, return.
*   Mark `npub` as refreshing.
*   Launch goroutine:
    *   Call `RefreshProfile(ctx, npub, debug)`.
    *   On completion (success or error), clear the refreshing status.
    *   Log errors if debug is enabled.

### `RefreshProfile`
*   Existing logic fetches from network and updates cache.
*   This updates the `ExpiresAt`, so subsequent calls to `GetFullProfile` won't trigger refresh until it expires again.

### `GetDisplayName`, `InitializeDisplayNames`, `AddNewPartner`
*   These methods use `GetProfile` or access `displayNames` map.
*   Ensure they benefit from the "return expired" behavior of `GetProfile`.
*   If they encounter an expired profile in cache, they should also trigger the background refresh if appropriate, or rely on `GetFullProfile` to do it.
*   *Refinement:* `GetDisplayName` is often called in tight loops (rendering). It should probably *not* trigger network refreshes directly to avoid swamping. It should just return the best available name.
*   `GetFullProfile` is the main entry point for "I need data about this user".
*   However, `InitializeDisplayNames` is called on startup. It should probably trigger refreshes for expired profiles found.
    *   *Strategy:* Iterate all partners on startup. If expired, schedule refresh. To avoid thundering herd, maybe use a worker pool or rate limiter, but standard goroutines with connection pooling might be enough for now given the connection manager handles relays.
