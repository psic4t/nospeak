# Client Profile Handling

## ADDED Requirements

### Requirement: Profile Resolver Legacy Field Handling
The ProfileResolver MUST NOT use removed legacy fields when interacting with the cache.

#### Scenario: Calling SetProfileWithRelayList
- **Given** the `ProfileResolver` in `client/profile_resolver.go`
- **When** calling `cache.SetProfileWithRelayList`
- **Then** it SHALL NOT pass `relayListEventID` as it is removed from the signature
