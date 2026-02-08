# npub-mentions Delta

## ADDED Requirements
### Requirement: ChatList Preview Npub Mention Rendering
The ChatList last-message preview text SHALL replace `nostr:npub1...` URIs with `@displayName` using locally cached profile data. If no profile is cached for a given npub, the preview SHALL display a truncated npub in the format `@npub1abc...xyz`. The replacement SHALL be applied after existing preview formatting (markdown stripping, "You:" prefix).

#### Scenario: Known npub replaced with display name in preview
- **GIVEN** the last message in a conversation contains `check out nostr:npub1abc...xyz`
- **AND** the profile cache contains `metadata.name = "Alice"` for that npub
- **WHEN** the ChatList preview is rendered
- **THEN** the preview text SHALL display `check out @Alice`

#### Scenario: Unknown npub shows truncated format in preview
- **GIVEN** the last message contains `talk to nostr:npub1abc123def456...`
- **AND** no profile is cached for that npub
- **WHEN** the ChatList preview is rendered
- **THEN** the preview text SHALL display `talk to @npub1abc...456` (truncated)

#### Scenario: Multiple mentions in preview
- **GIVEN** the last message contains two `nostr:npub1...` references
- **WHEN** the ChatList preview is rendered
- **THEN** both references SHALL be replaced with their respective display names or truncated npubs
