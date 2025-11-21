# Cache Schema Cleanup

## ADDED Requirements

### Requirement: Optimized Profile Schema
The profile cache schema SHALL exclude redundant legacy fields to optimize storage.

#### Scenario: Absence of legacy fields in ProfileEntry
- **Given** the `ProfileEntry` struct in `cache/interface.go`
- **Then** `RelayListEventID` field SHALL NOT exist
- **And** `RelayListUpdatedAt` field SHALL NOT exist

#### Scenario: Absence of legacy columns in database
- **Given** the `profile_cache` table in `cache/sqlite.go`
- **Then** the `relay_list_event_id` column SHALL NOT exist
- **And** the `relay_list_updated_at` column SHALL NOT exist

### Requirement: Profile Freshness Strategy
Freshness checks SHALL rely on the main cached timestamp.

#### Scenario: Use cached_at for freshness
- **Given** a cached profile
- **When** checking if the profile or relay list is up to date
- **Then** `cached_at` SHALL be used instead of `relay_list_updated_at`
