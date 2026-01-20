# Tasks: Separate Chats from Contacts

## 1. Contact Sync Service

- [x] 1.1 Create `src/lib/core/ContactSyncService.ts` with Kind 30000 publish/fetch logic
- [x] 1.2 Implement NIP-44 self-encryption for contact list content
- [x] 1.3 Implement union merge logic for fetched contacts
- [x] 1.4 Write unit tests for ContactSyncService encrypt/decrypt round-trip
- [x] 1.5 Write unit tests for union merge behavior

## 2. UI Rename and FAB Button

- [x] 2.1 Rename `ContactList.svelte` to `ChatList.svelte`
- [x] 2.2 Update header title from "Contacts" to "Chats"
- [x] 2.3 Remove "Manage" / SplitButton from header
- [x] 2.4 Add FAB (+) button in lower-right that opens ManageContactsModal
- [x] 2.5 Update `chat/+layout.svelte` import from ContactList to ChatList

## 3. Contacts Modal Behavior

- [x] 3.1 Add "New Contact" button at top of ManageContactsModal
- [x] 3.2 Add click handler on contact rows that navigates to chat and closes modal
- [x] 3.3 Ensure contact click focuses existing chat or creates new one

## 4. Service Integration

- [x] 4.1 Integrate ContactSyncService into ContactService.addContactByNpub()
- [x] 4.2 Add publish trigger to ManageContactsModal.remove()
- [x] 4.3 Integrate sync trigger into Messaging.autoAddContact()
- [x] 4.4 Add fetchAndMergeContacts() call to layout.svelte profile refresh flow

## 5. i18n Updates

- [x] 5.1 Add `chats` translation section to en.ts
- [x] 5.2 Add `modals.manageContacts.newContact` translation key
- [x] 5.3 Update de.ts with German translations
- [x] 5.4 Update other locale files (pt.ts, it.ts, fr.ts, es.ts)

## 6. Validation

- [x] 6.1 Run `npm run check` - 0 errors, 0 warnings
- [x] 6.2 Run `npx vitest run` - 225 tests passed
- [ ] 6.3 Manual testing: add contact, verify Kind 30000 published
- [ ] 6.4 Manual testing: receive message from unknown, verify contact auto-added and synced
- [ ] 6.5 Manual testing: fresh login, verify contacts restored from relays
