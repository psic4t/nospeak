# messaging Specification Changes

## ADDED Requirements

### Requirement: Enhanced SendChatMessage Return Value
The `SendChatMessage` method SHALL return the count of successful relay publications alongside existing error information.

#### Scenario: Successful message delivery
- **GIVEN** a message is sent to a recipient with 2 available relays
- **WHEN** `SendChatMessage` completes successfully
- **THEN** it SHALL return success count of 2 and nil error
- **THEN** the success count SHALL represent relays where immediate publication succeeded

#### Scenario: Partial relay success
- **GIVEN** a message is sent to a recipient with 3 available relays
- **WHEN** 2 relays succeed immediately and 1 fails
- **THEN** it SHALL return success count of 2 and nil error
- **THEN** the failed relay SHALL be queued for retry by existing retry logic
- **THEN** the message SHALL still be cached as sent

#### Scenario: Complete message delivery failure
- **GIVEN** a message is sent to a recipient
- **WHEN** all relays fail immediately and no retry is possible
- **THEN** it SHALL return success count of 0 and non-nil error
- **THEN** the error SHALL represent the publication failure
- **THEN** the message SHALL NOT be cached as sent

#### Scenario: CLI backward compatibility
- **GIVEN** existing CLI code that calls `SendChatMessage` and only checks for error
- **WHEN** the method signature changes to return success count
- **THEN** CLI commands SHALL continue to work by ignoring the success count
- **THEN** error handling behavior SHALL remain unchanged

#### Scenario: Message caching behavior preservation
- **GIVEN** a message is sent with partial relay success (success count > 0)
- **WHEN** `SendChatMessage` returns success count and nil error
- **THEN** the message SHALL be cached with direction "sent"
- **THEN** the message SHALL appear in chat history regardless of partial failures