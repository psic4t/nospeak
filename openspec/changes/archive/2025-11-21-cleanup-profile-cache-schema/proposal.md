# Cleanup Profile Cache Schema

## Goal
Remove redundant and unused columns `relay_list_event_id` and `relay_list_updated_at` from the `profile_cache` table in the SQLite database and updated the associated structs and methods.

## Rationale
- `relay_list_event_id` is not needed for the application's logic.
- `relay_list_updated_at` is redundant as `cached_at` captures the timestamp when the data (including relay lists) is cached.

## Key Changes
- Update `ProfileEntry` struct in `cache/interface.go`.
- Update `profile_cache` table schema in `cache/sqlite.go`.
- Add migration to drop these columns.
- Update `GetProfile` and `SetProfileWithRelayList` methods to stop using these columns.
- Update callers in `client/profile_resolver.go` and `client/profile.go` if necessary.
