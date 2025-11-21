1.  [x] Update `cache/interface.go`: Remove `RelayListEventID` and `RelayListUpdatedAt` from `ProfileEntry`.
2.  [x] Update `cache/sqlite.go`:
    -   [x] Update `createTables` to remove columns.
    -   [x] Create a migration to drop `relay_list_event_id` and `relay_list_updated_at`.
    -   [x] Update `GetProfile` to stop querying these columns.
    -   [x] Update `SetProfileWithRelayList` to stop inserting these columns.
    -   [x] Remove any indexes associated with these columns.
3.  [x] Update `client/profile_resolver.go`: Remove usage of `RelayListEventID` in `SetProfileWithRelayList` calls.
4.  [x] Update `client/profile.go`: Remove any usage of these fields.
5.  [x] Verify tests pass.
