# Design: Update Messaging Relays to NIP-17 Kind 10050

## Overview
This design describes how nospeak will adopt NIP-17 messaging relays (kind 10050) as the canonical way to advertise and consume DM relay routing information, while minimizing disruption to existing code paths and keeping the UI simpler.

The change spans two primary areas:
- **Messaging**: how the client discovers relay lists for contacts and the current user, how it publishes its own relay list, and how it chooses relays when sending sealed/gift-wrapped DMs and reactions.
- **Settings & Profile UI**: how users configure and inspect their messaging relays.

## Current State
- Relay lists for messaging are published as **NIP-65 kind 10002** events with `r` tags containing read/write markers.
- Profiles in IndexedDB store `readRelays` and `writeRelays` arrays.
- Relay discovery and startup messaging initialization:
  - Fetch kind 0 metadata and kind 10002 relay list events.
  - Cache relays into `readRelays`/`writeRelays`.
  - Use `readRelays` as the primary set of persistent relays for subscriptions and history.
- Empty profile setup:
  - Presents a blocking modal when a profile has no relays and no username-like metadata.
  - Seeds default relays for the user and publishes a NIP-65 relay list along with kind 0 profile metadata.
- DM sending pipeline:
  - Uses separate `getReadRelays` and `getWriteRelays` helpers.
  - Builds a combined relay set from the recipient's read relays and the sender's write relays.
  - Publishes the recipient gift-wrap to the combined set and the self gift-wrap to the sender's write relays.
- Settings UI:
  - Contains a "Mailbox Relays" category.
  - Displays a table of relays with read/write checkboxes.
  - Persists changes via `RelaySettingsService.updateSettings(readRelays, writeRelays)`.
- Profile modal:
  - Displays "Read Relays" and "Write Relays" sections separately.

## Target Model
### Messaging Relays Concept
- Introduce a single logical concept of **messaging relays** per user:
  - Defined at the protocol level by NIP-17 as kind 10050 events with one or more `relay` tags.
  - Used by nospeak for both sending and receiving encrypted DMs for that user.
- Internally, nospeak continues to store `readRelays` and `writeRelays` in profile records for simplicity, but:
  - When messaging relays are sourced from kind 10050, both arrays are set to the same deduplicated list.
  - When only NIP-65 kind 10002 exists, nospeak derives read/write arrays from that event as today.

### Publishing Relay Lists
- For the **current user**:
  - nospeak SHOULD publish only a **kind 10050** event to advertise messaging relays.
  - The event uses `relay` tags and an empty `content` field.
  - Existing NIP-65 publication paths are removed from the spec for nospeak.
- For **contacts**:
  - nospeak MUST prefer kind 10050 when discovering messaging relays.
  - nospeak MAY still parse kind 10002 events as a fallback when 10050 is absent.

### Sending Logic
- **Recipient routing**:
  - When sending a DM or reaction, the client MUST obtain the contact's messaging relays.
  - The encrypted gift-wrap intended for the contact MUST be published *only* to these messaging relays.
- **Self routing**:
  - The same unsigned rumor (kind 14, 15, or 7) is sealed and gift-wrapped again for the current user.
  - This self gift-wrap MUST be published *only* to the current user's messaging relays.
- **Temporary connections**:
  - The client MAY still open temporary relay connections to the union of sender and recipient messaging relays for efficiency.
  - This does not affect which relays receive each gift-wrap, only which relays we attempt to connect to while sending.
- **Failure behavior**:
  - If a contact has **no** messaging relays discoverable via kind 10050 or kind 10002, sending SHOULD fail with a clear, user-visible error explaining that the contact is not ready to receive NIP-17 DMs.
  - If the current user has no messaging relays configured, the spec relies on the empty-profile modal to prevent reaching the sending state; implementation MAY add defensive checks but that is not required at the spec level.

### Settings & Profile UX
- **Settings category rename**:
  - The existing "Mailbox Relays" category is renamed to **"Messaging Relays"**.
- **Relay editing semantics**:
  - The Settings view exposes a single list of relay URLs.
  - Users can add new URLs and remove existing ones.
  - There are no read/write checkboxes or labels; the list represents messaging relays used for both sending and receiving DMs.
- **Profile modal display**:
  - The profile modal shows a single **"Messaging Relays"** section.
  - The list is derived from the union of any known relay URLs for that profile (from either kind 10050 or kind 10002), deduplicated.
  - The UI continues to show "None" when no relays are known.

## Design Decisions and Trade-offs
### 1. Continue Storing readRelays/writeRelays Internally
- **Decision**: Do not introduce a new schema column or rename existing fields; instead, map the messaging relays concept onto the existing arrays.
- **Rationale**:
  - Avoids IndexedDB migrations and keeps implementation small and low-risk.
  - Many existing code paths already expect `profile.readRelays` and `profile.writeRelays`.
- **Implication**:
  - For NIP-17-based profiles, both arrays hold the same values.
  - For legacy NIP-65-only contacts, the arrays preserve read/write semantics derived from `r` tags.

### 2. Prefer NIP-17 but Keep NIP-65 Fallback
- **Decision**: Discovery logic MUST prefer kind 10050 and MAY fall back to kind 10002.
- **Rationale**:
  - Ensures interoperability with existing NIP-65 clients while moving nospeak to spec-compliant NIP-17 behavior.
  - Allows nospeak to operate in a mixed ecosystem during migration.
- **Alternative considered**: Dropping 10002 entirely for discovery.
  - Rejected due to breaking interoperability with clients that have not yet adopted NIP-17.

### 3. Separate Target Relay Sets for Recipient and Self
- **Decision**: Recipient gift-wraps are sent only to the contact's messaging relays; self wraps only to the current user's messaging relays.
- **Rationale**:
  - Aligns with NIP-17 guidance: messaging relays represent where each user expects to receive their DMs.
  - Reduces unnecessary duplication of recipient envelopes on relays that are only used by the sender.
- **Implication**:
  - The DM pipeline still connects to both sets of relays while sending (for connection health), but
  - The message routing itself respects each party's chosen messaging relays.

### 4. Simple Messaging Relays UI
- **Decision**: The Settings UI presents a single list of messaging relays, not separate read/write flags.
- **Rationale**:
  - Matches the NIP-17 concept more closely and reduces cognitive load for users.
  - Avoids confusion from the older mailbox relay terminology.
- **Trade-off**:
  - Loses the ability to fine-tune separate read vs write lists from nospeak's settings panel.
  - For advanced users who still want distinct relays, they can configure that via other clients; nospeak will respect NIP-65 lists where available, but only when no NIP-17 list exists.

### 5. No Data Migration Path in Spec
- **Decision**: The spec assumes that changes can be applied on a fresh cache and does not require a formal migration process.
- **Rationale**:
  - The user has explicitly indicated they will clear cache and start over.
- **Implication**:
  - The proposal focuses on new behavior and does not define requirements for upgrading existing local data.

## Open Questions
- **Recipient with no messaging relays**:
  - Exact UX for the error state is left to implementation, but the requirement will state that sending must fail with a user-visible explanation.
- **Dual publishing (10050 + 10002)**:
  - This design assumes that nospeak will publish only 10050 going forward.
  - If future interoperability requirements demand also emitting 10002, a follow-up change can extend the publishing requirements.
