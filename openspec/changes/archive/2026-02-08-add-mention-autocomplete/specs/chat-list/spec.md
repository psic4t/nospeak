# chat-list Delta

## MODIFIED Requirements
### Requirement: Chat List Message Preview Formatting
The chat list sidebar SHALL display a preview of each conversation's most recent message. File messages SHALL show a type-specific label (e.g., "Photo", "Video"). Location messages SHALL show a location label. Text messages SHALL display the raw text with whitespace normalized. Sent messages SHALL be prefixed with "You: ". The preview text SHALL replace `nostr:npub1...` URIs with `@displayName` from the local profile cache, falling back to a truncated npub format. Preview text SHALL apply basic markdown stripping (citation markers, list markers) and support bold/italic rendering.

#### Scenario: Text message preview displayed
- **GIVEN** the most recent message in a conversation is a text message "Hello there"
- **WHEN** the chat list is rendered
- **THEN** the preview SHALL display "Hello there"

#### Scenario: Sent message preview shows You prefix
- **GIVEN** the most recent message was sent by the current user with text "See you later"
- **WHEN** the chat list is rendered
- **THEN** the preview SHALL display "You: See you later"

#### Scenario: Npub mention in preview shows display name
- **GIVEN** the most recent message contains `ask nostr:npub1abc...xyz about it`
- **AND** the profile cache has `metadata.name = "Alice"` for that npub
- **WHEN** the chat list is rendered
- **THEN** the preview SHALL display `ask @Alice about it`
