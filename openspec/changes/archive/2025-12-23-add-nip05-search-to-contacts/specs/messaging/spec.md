## MODIFIED Requirements
### Requirement: Manage Contacts Search via NIP-50 Relay
The Manage Contacts modal SHALL support searching for users by name or phrase using a dedicated NIP-50 search relay, by NIP-05 identifier using web-based lookup, and by `npub` for direct entry, while preserving the existing direct-add behavior for `npub` inputs.

The NIP-50 search relay URL SHALL be deployment-configurable at runtime (default: `wss://relay.nostr.band`) and MUST use `wss://`.

NIP-05 lookup SHALL be performed by fetching `https://<domain>/.well-known/nostr.json?name=<local-part>` for a valid NIP-05 address of the form `localpart@domain` and converting the returned hex public key to an `npub`.

#### Scenario: Direct npub entry bypasses search
- **GIVEN** the user opens the Manage Contacts modal
- **AND** the user enters a value that starts with `npub` into the contact input field
- **WHEN** the user clicks the "Add" button
- **THEN** the system SHALL treat the value as an `npub`
- **AND** SHALL attempt to resolve the profile and add the contact using the existing direct-add flow without performing a search

#### Scenario: Phrase input triggers search
- **GIVEN** the user opens the Manage Contacts modal
- **AND** the user enters a non-empty value that does not start with `npub` and does not match NIP-05 format into the contact input field
- **AND** the entered value is at least three characters long after trimming whitespace
- **WHEN** the user stops typing for a short period
- **THEN** the system SHALL send a NIP-50 `search` query to the configured NIP-50 search relay (default: `wss://relay.nostr.band`) restricted to kind `0` metadata events with a maximum of 20 results
- **AND** the system SHALL display matching users in a dropdown under the contact input field

#### Scenario: NIP-05 input triggers immediate lookup
- **GIVEN** the user opens the Manage Contacts modal
- **AND** the user enters a value in NIP-05 format (`localpart@domain` where both parts are non-empty) into the contact input field
- **WHEN** the user completes entering the NIP-05 address
- **THEN** the system SHALL immediately fetch `https://<domain>/.well-known/nostr.json?name=<local-part>`
- **AND** SHALL NOT trigger the NIP-50 relay-based search
- **AND** SHALL display a loading state while the lookup is in progress

#### Scenario: NIP-05 lookup displays user with avatar and username
- **GIVEN** the user has entered a valid NIP-05 address
- **AND** the system has successfully fetched the NIP-05 JSON response
- **AND** the response contains a hex public key for the requested `localpart`
- **WHEN** the system converts the hex public key to an `npub`
- **THEN** the system SHALL resolve the user's profile metadata from relays using `profileResolver`
- **AND** SHALL display a single result under the input field showing:
  - The user's avatar when profile metadata includes a `picture` URL
  - The user's username derived from `name` or `display_name` in profile metadata
  - The shortened `npub` as secondary text
  - An "Already added" badge if the `npub` already exists in the user's contacts list

#### Scenario: NIP-05 for already-added contact shows badge
- **GIVEN** the user has entered a valid NIP-05 address
- **AND** the system has resolved the hex public key and converted it to an `npub`
- **AND** the resolved `npub` already exists in the user's contacts list
- **WHEN** the NIP-05 result is displayed in the dropdown
- **THEN** the result row SHALL display an "Already added" badge
- **AND** the result row SHALL be disabled and non-interactive so clicking it does not populate the input field

#### Scenario: NIP-05 invalid format displays error
- **GIVEN** the user opens the Manage Contacts modal
- **AND** the user enters a value that does not match the NIP-05 format (e.g., `missing@domain`, `@domain`, `user@`, or plain text without `@`)
- **WHEN** the system attempts to parse the input as a NIP-05 address
- **THEN** the system SHALL display an error message indicating invalid NIP-05 format
- **AND** SHALL suggest the correct format (`name@domain.com`)
- **AND** SHALL NOT perform NIP-05 lookup or relay-based search

#### Scenario: NIP-05 not found displays error
- **GIVEN** the user enters a valid NIP-05 format (`localpart@domain`)
- **AND** the system successfully fetches the NIP-05 JSON response from `https://<domain>/.well-known/nostr.json?name=<local-part>`
- **AND** the response does not contain an entry for the requested `localpart`
- **WHEN** the lookup completes
- **THEN** the system SHALL display an error message indicating the NIP-05 was not found
- **AND** SHALL NOT display any user result

#### Scenario: NIP-05 network error displays error
- **GIVEN** the user enters a valid NIP-05 format (`localpart@domain`)
- **AND** the system attempts to fetch `https://<domain>/.well-known/nostr.json?name=<local-part>`
- **AND** the fetch fails due to network error, CORS restrictions, or HTTP error status
- **WHEN** the lookup fails
- **THEN** the system SHALL display an error message indicating the NIP-05 lookup failed
- **AND** MAY include specific error details (e.g., HTTP status or network error)

#### Scenario: Selecting NIP-05 result pre-fills npub for adding
- **GIVEN** the user has entered a valid NIP-05 address
- **AND** the system has successfully resolved the NIP-05 to an `npub` and displayed the result
- **AND** the resolved `npub` is not already in the user's contacts list
- **WHEN** the user clicks on the NIP-05 result row
- **THEN** the system SHALL populate the contact input field with the resolved `npub`
- **AND** SHALL close the NIP-05 results dropdown
- **AND** SHALL require the user to click the existing "Add" button to finalize adding the contact

#### Scenario: Adding a contact via NIP-05 behaves like direct npub add
- **GIVEN** the user has clicked a NIP-05 result and the contact input field contains the resolved `npub`
- **WHEN** the user clicks the "Add" button
- **THEN** the system SHALL resolve the user's profile and relay information using the same logic as direct `npub` entry
- **AND** SHALL add the selected user to the contacts list with the same fields and downstream behaviour as a contact added by manually entering their `npub`
- **AND** SHALL NOT store the original NIP-05 address (profile metadata fetching via `profileResolver` will retrieve the NIP-05 from the profile if published)

#### Scenario: NIP-05 mode takes precedence over relay search
- **GIVEN** the user opens the Manage Contacts modal
- **AND** the user types text that matches NIP-05 format (contains `@` with non-empty local part and domain)
- **WHEN** the input contains a valid NIP-05 format
- **THEN** the system SHALL NOT trigger the NIP-50 relay-based search
- **AND** SHALL only perform the NIP-05 web lookup

#### Scenario: Typing "@" after local-part triggers NIP-05 mode
- **GIVEN** the user opens the Manage Contacts modal
- **AND** the user has typed a local-part (e.g., "alice")
- **WHEN** the user types the `@` character
- **THEN** the system SHALL recognize the input as a potential NIP-05 address
- **AND** SHALL enter NIP-05 lookup mode once the domain is entered
- **AND** SHALL NOT trigger relay-based search

#### Scenario: Removing "@" from input reverts to relay search
- **GIVEN** the user has entered a partial NIP-05 address (e.g., "alice@")
- **AND** the system is in NIP-05 lookup mode
- **WHEN** the user removes the `@` character
- **THEN** the system SHALL exit NIP-05 lookup mode
- **AND** SHALL treat the input as plain text for relay-based search if it is 3+ characters long

#### Scenario: Search results display
- **GIVEN** the system has received at least one matching user from the search relay
- **WHEN** the dropdown under the contact input is rendered
- **THEN** each result SHALL show the user's avatar when a profile picture is available
- **AND** SHALL show a primary display name derived from profile metadata when available
- **AND** SHALL show the user's shortened `npub` as secondary text
- **AND** MAY display additional metadata such as NIP-05 identifier when available

#### Scenario: Selecting a search result pre-fills npub
- **GIVEN** search results are visible in the dropdown under the contact input (from relay search, not NIP-05)
- **WHEN** the user clicks on a search result
- **THEN** the system SHALL populate the contact input field with the selected user's `npub`
- **AND** SHALL close the search results dropdown
- **AND** SHALL require the user to click the existing "Add" button to finalize adding the contact

#### Scenario: Adding a contact via search result behaves like direct npub add
- **GIVEN** the user has clicked a search result and the contact input field contains the selected user's `npub`
- **WHEN** the user clicks the "Add" button
- **THEN** the system SHALL resolve the user's profile and relay information using the same logic as direct `npub` entry
- **AND** SHALL add the selected user to the contacts list with the same fields and downstream behaviour as a contact added by manually entering their `npub`
