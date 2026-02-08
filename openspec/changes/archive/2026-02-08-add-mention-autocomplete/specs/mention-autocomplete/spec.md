# mention-autocomplete Specification

## Purpose
Autocomplete UI and insertion logic for mentioning contacts via `@` trigger in the message composer, producing NIP-27 `nostr:npub1...` URIs in message content.

## ADDED Requirements
### Requirement: Mention Trigger Detection
The message composer SHALL detect when the user types `@` preceded by whitespace or at the start of input, followed by zero or more word characters. When detected, the system SHALL display a mention autocomplete dropdown above the textarea. The trigger SHALL NOT activate when `@` appears mid-word (e.g., inside an email address).

#### Scenario: Typing @ at start of input triggers autocomplete
- **GIVEN** the message textarea is empty
- **WHEN** the user types `@`
- **THEN** the mention autocomplete dropdown SHALL appear
- **AND** it SHALL display up to 5 contacts sorted alphabetically by name

#### Scenario: Typing @ after a space triggers autocomplete
- **GIVEN** the message textarea contains `hello `
- **WHEN** the user types `@ali`
- **THEN** the mention autocomplete dropdown SHALL appear
- **AND** it SHALL filter contacts whose name or npub contains "ali" (case-insensitive)

#### Scenario: Typing @ mid-word does not trigger autocomplete
- **GIVEN** the message textarea contains `user@`
- **WHEN** the user continues typing `example`
- **THEN** the mention autocomplete dropdown SHALL NOT appear

### Requirement: Mention Candidate Sources
The mention autocomplete SHALL suggest contacts from the user's local contact list with resolved profile names and avatars. In group chats, the candidate list SHALL additionally include all group participants who are not already in the contact list, excluding the current user. Candidates SHALL be loaded from local IndexedDB without network calls.

#### Scenario: Contacts shown as mention candidates
- **GIVEN** the user has 10 contacts in their local contact list
- **WHEN** the mention autocomplete is triggered
- **THEN** all 10 contacts SHALL be available as candidates
- **AND** each candidate SHALL display the profile name (or truncated npub if no profile) and avatar

#### Scenario: Group participants included in group chat
- **GIVEN** the user is in a group chat with participants Alice, Bob, and Carol
- **AND** Alice is in the user's contact list but Bob is not
- **WHEN** the mention autocomplete is triggered
- **THEN** both Alice and Bob SHALL appear as candidates
- **AND** the current user SHALL NOT appear as a candidate

#### Scenario: No candidates available
- **GIVEN** the user has no contacts and is in a 1-on-1 chat
- **WHEN** the mention autocomplete is triggered with `@`
- **THEN** the mention autocomplete dropdown SHALL NOT appear

### Requirement: Mention Candidate Filtering
When the user types characters after `@`, the candidate list SHALL be filtered to show only contacts whose display name or npub contains the typed text (case-insensitive). The filtered list SHALL show a maximum of 5 results.

#### Scenario: Filtering by name
- **GIVEN** the mention autocomplete is open
- **AND** contacts include "Alice", "Bob", "Alina"
- **WHEN** the user types `@ali`
- **THEN** "Alice" and "Alina" SHALL appear in the dropdown
- **AND** "Bob" SHALL NOT appear

#### Scenario: Filtering by npub
- **GIVEN** the mention autocomplete is open
- **AND** a contact has npub `npub1abc123...`
- **WHEN** the user types `@abc`
- **THEN** that contact SHALL appear in the dropdown

#### Scenario: No matches shows no dropdown
- **GIVEN** the mention autocomplete is open
- **WHEN** the user types `@zzzzz` and no contacts match
- **THEN** the mention autocomplete dropdown SHALL be hidden

### Requirement: Mention Keyboard Navigation
The mention autocomplete dropdown SHALL support keyboard navigation identical to the existing emoji autocomplete. ArrowUp and ArrowDown SHALL cycle through candidates. Enter or Tab SHALL select the highlighted candidate. Escape SHALL close the dropdown without inserting a mention.

#### Scenario: Arrow keys cycle through candidates
- **GIVEN** the mention dropdown shows 3 candidates
- **AND** the first candidate is highlighted
- **WHEN** the user presses ArrowDown
- **THEN** the second candidate SHALL be highlighted
- **AND** pressing ArrowDown again SHALL highlight the third candidate
- **AND** pressing ArrowDown again SHALL wrap to the first candidate

#### Scenario: Enter selects highlighted candidate
- **GIVEN** the mention dropdown is showing with "Alice" highlighted
- **WHEN** the user presses Enter
- **THEN** "Alice" SHALL be selected and inserted as a mention
- **AND** the dropdown SHALL close
- **AND** the Enter key SHALL NOT submit the message form

#### Scenario: Escape closes dropdown without insertion
- **GIVEN** the mention dropdown is open
- **WHEN** the user presses Escape
- **THEN** the dropdown SHALL close
- **AND** the text `@search` SHALL remain in the textarea unchanged

### Requirement: Mention Selection and Insertion
When a mention candidate is selected (via keyboard or click), the system SHALL replace the `@search` text before the cursor with the NIP-27 URI `nostr:<npub>` followed by a trailing space. The cursor SHALL be positioned after the trailing space. The mention picker SHALL close after insertion.

#### Scenario: Mention inserted on selection
- **GIVEN** the textarea contains `hello @ali` with cursor at position 10
- **AND** the user selects contact "Alice" with npub `npub1abc...xyz`
- **WHEN** the selection is confirmed
- **THEN** the textarea SHALL contain `hello nostr:npub1abc...xyz ` (with trailing space)
- **AND** the cursor SHALL be positioned after the trailing space
- **AND** the mention dropdown SHALL close

#### Scenario: Click on candidate inserts mention
- **GIVEN** the mention dropdown is showing candidates
- **WHEN** the user clicks on a candidate row
- **THEN** the mention SHALL be inserted identically to keyboard selection

### Requirement: Mention Picker Mutual Exclusion with Emoji Picker
The mention autocomplete and emoji autocomplete SHALL NOT be open simultaneously. When the mention picker opens, the emoji picker SHALL close, and vice versa.

#### Scenario: Mention picker closes emoji picker
- **GIVEN** the emoji picker is open (user typed `:smi`)
- **WHEN** the user clears the text and types `@`
- **THEN** the emoji picker SHALL close
- **AND** the mention picker SHALL open

#### Scenario: Emoji picker closes mention picker
- **GIVEN** the mention picker is open (user typed `@ali`)
- **WHEN** the user clears the text and types `:smi`
- **THEN** the mention picker SHALL close
- **AND** the emoji picker SHALL open
