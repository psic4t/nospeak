## ADDED Requirements

### Requirement: Npub Detection in Message Content
The message content renderer SHALL detect Nostr npub references in two formats: `nostr:npub1<58+ bech32 chars>` (NIP-27 URI) and bare `npub1<58+ bech32 chars>`. Detected references SHALL be validated using `nip19.decode()` from nostr-tools; references that fail decoding SHALL be rendered as plain text. Valid references SHALL be rendered as clickable inline mentions styled distinctly from surrounding text.

#### Scenario: NIP-27 URI detected and rendered as mention
- **GIVEN** a received or sent message contains the text `check out nostr:npub1abc...xyz for details`
- **AND** the npub portion decodes successfully via `nip19.decode()`
- **WHEN** the message content is rendered
- **THEN** the `nostr:npub1abc...xyz` portion SHALL be replaced with a clickable mention link
- **AND** the surrounding text `check out` and `for details` SHALL render as normal text

#### Scenario: Bare npub detected and rendered as mention
- **GIVEN** a received or sent message contains the text `talk to npub1abc...xyz`
- **AND** the npub decodes successfully via `nip19.decode()`
- **WHEN** the message content is rendered
- **THEN** the `npub1abc...xyz` portion SHALL be replaced with a clickable mention link

#### Scenario: Invalid npub rendered as plain text
- **GIVEN** a received or sent message contains `npub1invalidchars!!!`
- **WHEN** `nip19.decode()` throws an error for that string
- **THEN** the text SHALL be rendered as plain text without any mention styling or click behavior

#### Scenario: Multiple npubs in single message
- **GIVEN** a message contains two or more valid npub references
- **WHEN** the message content is rendered
- **THEN** each valid npub SHALL be independently rendered as a clickable mention link

### Requirement: Npub Mention Display Name Resolution
Each detected npub mention SHALL display the referenced user's name when available in the local profile cache, falling back to a truncated npub format. Display name resolution SHALL use `profileRepo.getProfileIgnoreTTL()` (async cache lookup, no network calls). The display name SHALL prefer `metadata.name`, then `metadata.display_name`, then fall back to a truncated npub in the format `npub1abc...xyz` (first 8 and last 3 characters of the npub string).

#### Scenario: Cached profile name displayed inline
- **GIVEN** a message contains a valid npub reference
- **AND** the profile for that npub exists in the local IndexedDB cache with `metadata.name = "Alice"`
- **WHEN** the message content is rendered and the cache lookup completes
- **THEN** the mention SHALL display `@Alice` as the clickable text

#### Scenario: No cached profile shows truncated npub
- **GIVEN** a message contains a valid npub reference
- **AND** no profile exists in the local cache for that npub
- **WHEN** the message content is rendered
- **THEN** the mention SHALL display a truncated npub (e.g., `@npub1abc...xyz`) as the clickable text

#### Scenario: Display name updates reactively when cache populates
- **GIVEN** a message contains a valid npub reference with no cached profile
- **AND** the mention initially displays the truncated npub
- **WHEN** the profile cache is subsequently populated (e.g., by another component resolving the profile)
- **THEN** the mention display text SHALL update to show the resolved name without requiring a page reload

### Requirement: Npub Mention Click Opens Profile Modal
Clicking a detected npub mention SHALL open the existing ProfileModal for that npub. The click handler SHALL use event delegation on the message content container, intercepting clicks on elements with a `data-npub` attribute and calling `openProfileModal(npub)`.

#### Scenario: Click on mention opens profile modal
- **GIVEN** a message contains a rendered npub mention for `npub1abc...xyz`
- **WHEN** the user clicks on the mention link
- **THEN** the ProfileModal SHALL open with the npub `npub1abc...xyz`
- **AND** the default link navigation SHALL be prevented

#### Scenario: Mention click does not trigger message context menu
- **GIVEN** a message bubble contains a rendered npub mention
- **WHEN** the user clicks on the mention link
- **THEN** the click SHALL open the ProfileModal
- **AND** the message bubble's context menu or other click handlers SHALL NOT be triggered for that click

### Requirement: Npub Mention Visual Styling
Npub mentions SHALL be rendered as `<a>` tags with distinct visual styling that integrates with both sent (own) and received message bubbles. Mentions in received messages SHALL use a blue/purple accent color. Mentions in sent messages SHALL use a lighter contrasting color appropriate for the blue bubble background. All mentions SHALL display a `@` prefix before the display name.

#### Scenario: Mention styled in received message bubble
- **GIVEN** a received message contains a rendered npub mention
- **WHEN** the message bubble is displayed
- **THEN** the mention SHALL be styled with a distinct accent color (e.g., blue-600 in light mode, blue-400 in dark mode)
- **AND** the mention text SHALL be underlined or otherwise visually distinct from surrounding text
- **AND** the mention SHALL show a pointer cursor on hover

#### Scenario: Mention styled in sent message bubble
- **GIVEN** a sent (own) message contains a rendered npub mention
- **WHEN** the message bubble is displayed
- **THEN** the mention SHALL use a lighter color suitable for the blue bubble background (e.g., white with slight opacity)
- **AND** the mention SHALL remain visually clickable

### Requirement: Npub Mention XSS Prevention
Display names inserted into the `{@html}` rendered output SHALL be HTML-escaped to prevent cross-site scripting attacks from malicious profile metadata. The escaping SHALL convert `<`, `>`, `&`, `"`, and `'` characters to their HTML entity equivalents.

#### Scenario: Malicious display name safely escaped
- **GIVEN** a cached profile has `metadata.name = "<script>alert('xss')</script>"`
- **WHEN** the mention is rendered via `{@html}`
- **THEN** the display name SHALL appear as literal text `@<script>alert('xss')</script>`
- **AND** no script execution SHALL occur
