# Tasks: Update Messaging Relays to NIP-17 Kind 10050

## 1. Specification Updates
- [x] 1.1 Update `messaging` spec to define "messaging relays" as NIP-17 kind 10050 lists used for encrypted DMs.
- [x] 1.2 Specify that discovery MUST prefer kind 10050 and MAY fall back to kind 10002 when 10050 is absent.
- [x] 1.3 Update the empty-profile setup requirement so that default relays are published via kind 10050 instead of NIP-65.

## 2. DM Sending Using Messaging Relays
- [x] 2.1 Add/modify `messaging` requirements to formalize how sending chooses relays:
  - Obtain contact messaging relays and current user messaging relays.
  - Publish recipient gift-wraps only to the contact's messaging relays.
  - Publish self gift-wraps only to the current user's messaging relays.
- [x] 2.2 Capture failure behavior when a contact has no discoverable messaging relays.

## 3. Settings and Profile UI
- [x] 3.1 Under `settings`, rename the "Mailbox Relays" settings category to "Messaging Relays".
- [x] 3.2 Describe and implement a single-list UI for messaging relay URLs (add/remove only; no read/write checkboxes).
- [x] 3.3 Clarify in spec and implementation that this list controls the current user's messaging relay list published as NIP-17 kind 10050.
- [x] 3.4 Update the profile modal to show a single "Messaging Relays" section derived from the union of known relay URLs.

## 4. Auth / Permissions
- [x] 4.1 Align Amber / NIP-46 permissions so the client is allowed to sign kind 10050 messaging relay events instead of kind 10002.

## 5. Validation and Regression
- [x] 5.1 Run `openspec validate 2025-12-14-update-messaging-relays-nip17 --strict` and resolve any issues.
- [x] 5.2 Run `npm run check` and `npx vitest run`, fixing any regressions related to relay usage, DM sending, or settings/profile UI.
