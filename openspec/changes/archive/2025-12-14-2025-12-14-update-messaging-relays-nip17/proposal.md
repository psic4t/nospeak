# Proposal: Update Messaging Relays to NIP-17 Kind 10050

## Summary
Switch nospeak from publishing NIP-65 mailbox relay lists (kind 10002) to publishing NIP-17 messaging relay lists (kind 10050), and align sending logic and UI around a single "messaging relays" concept instead of separate read/write relay sets.

## Why
- nospeak currently uses NIP-65 mailbox relays (kind 10002) as the primary mechanism for advertising where encrypted DMs should be sent and read.
- NIP-17 now defines a dedicated messaging relay list (kind 10050) with `relay` tags and states that clients SHOULD use these relays for routing gift-wrapped DMs.
- The existing implementation and specs still:
  - Publish NIP-65 relay list events for the current user.
  - Treat relay settings as a read/write split and expose that split in Settings as "Mailbox Relays" with read/write checkboxes.
  - Reference NIP-65 in the empty-profile setup flow.
- The product direction is to fully align with NIP-17 for DM relay routing while still being able to read NIP-65 lists from other clients, and to simplify the UI to a single "messaging relays" concept.

## Goals
- Publish the current user's messaging relays using NIP-17 kind 10050 with `relay` tags.
- Use a single logical "messaging relays" list per user for DM routing and background messaging, derived from:
  - NIP-17 kind 10050 when available (preferred), or
  - NIP-65 kind 10002 as a fallback for contacts that do not yet publish 10050.
- Update sending logic so that:
  - Recipient gift-wraps are published only to the contact's messaging relays.
  - Self gift-wraps are published only to the current user's messaging relays.
- Update Settings and profile UI so that:
  - "Mailbox Relays" becomes "Messaging Relays".
  - The Settings section manages a single list of messaging relay URLs with no read/write checkboxes.
  - The Profile modal surfaces a single "Messaging Relays" list.
- Keep changes scoped to messaging, settings, and relay management; do not introduce new persistence schema migrations.

## Non-Goals
- Do not implement a data migration path for existing IndexedDB data; the intended usage is to clear cache and start fresh for this change.
- Do not attempt to remove support for reading NIP-65 kind 10002 events from other clients.
- Do not redesign the Relay Connections modal or broader relay-management UX beyond what is required for messaging relays.

## Affected Specs
- `messaging`:
  - DM relay discovery and usage during startup.
  - Empty profile setup flow and how messaging relays are published.
  - DM sending pipeline for text, file messages, and reactions.
- `settings`:
  - Settings categories and labels.
  - Relay configuration UI for messaging relays.

## High-Level Approach
1. **Introduce Messaging Relays Concept in Specs**
   - Define "messaging relays" as the NIP-17 relay list published via kind 10050 for the current user.
   - Specify that messaging relays are used for both sending and receiving encrypted DMs.
   - Clarify that discovery of other users' messaging relays MUST prefer kind 10050 and MAY fall back to kind 10002 when 10050 is absent.

2. **Update Empty Profile Setup Requirements**
   - Adjust the existing empty-profile requirement so that the default relays are treated as messaging relays.
   - Require that the client publishes a NIP-17 kind 10050 event (with `relay` tags) instead of a NIP-65 relay list when configuring the profile for the first time.

3. **Specify Messaging Relay-Based DM Sending**
   - Define how the DM sending pipeline chooses relays:
     - Obtain the contact's messaging relays.
     - Obtain the current user's messaging relays.
     - Publish the recipient gift-wrap only to the contact's messaging relays.
     - Publish the self gift-wrap only to the current user's messaging relays.
   - Require clear behavior when a contact does not expose any messaging relays (e.g., fail with a user-visible error).

4. **Simplify Relay Settings UI to Messaging Relays**
   - Rename the Settings category from "Mailbox Relays" to "Messaging Relays".
   - Specify that the Settings view manages a single list of messaging relay URLs.
   - Remove read/write checkbox semantics from the spec and describe a simpler add/remove list behavior.

5. **Unify Profile Relay Display**
   - Replace separate read/write relay headings in the profile modal spec with a single "Messaging Relays" display, derived from the union of known relay URLs.

6. **Document Backward Compatibility**
   - Note that the client MUST still interpret NIP-65 kind 10002 lists from other users when no 10050 is present.
   - Clarify that nospeak itself SHOULD only publish kind 10050 messaging relay lists going forward.
