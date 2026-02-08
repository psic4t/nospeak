## 1. MessageContent.svelte — Npub Detection and Rendering

- [x] 1.1 Add npub regex pattern `/(nostr:npub1[a-z0-9]{58,}|npub1[a-z0-9]{58,})/g` and an HTML-escape utility function to the script section
- [x] 1.2 Add reactive npub extraction: derive unique npubs from `content`, validate each with `nip19.decode()`, build a `$state` display-name map via async `profileRepo.getProfileIgnoreTTL()` lookups
- [x] 1.3 Add a text processing function that replaces validated npub patterns with `<a data-npub="..." class="npub-mention ...">@displayName</a>` tags (using the display-name map, falling back to truncated npub)
- [x] 1.4 Integrate the npub replacement into the text rendering pipeline — apply after `parseMarkdown()` and before `applyHighlightToHtml()` in the non-URL text branch
- [x] 1.5 Add event-delegation click handler on the container div: intercept clicks on `[data-npub]` elements, call `e.preventDefault()` and `e.stopPropagation()`, then call `openProfileModal(npub)`
- [x] 1.6 Add CSS classes for npub-mention styling: accent color for received bubbles, lighter contrasting color for sent bubbles, pointer cursor, underline

## 2. ProfileModal.svelte — Relay Fetch and Add-to-Contacts

- [x] 2.1 Enhance `loadProfile()` to call `profileResolver.resolveProfile(npub, true)` when cache returns undefined, then re-read from cache
- [x] 2.2 Add `adding` and `added` state variables for the add-to-contacts flow
- [x] 2.3 Add `addToContacts()` async function that calls `addContactByNpub(npub)`, sets `isContact = true` and `added = true` on success, handles errors by resetting state
- [x] 2.4 Add "Add to contacts" button UI in the profile header area, visible when `!isContact && !isOwnProfile && profile`, showing loading/confirmation states
- [x] 2.5 Import `profileResolver` and `addContactByNpub` dependencies

## 3. Internationalization

- [x] 3.1 Add i18n keys to `en.ts`: `modals.profile.addToContacts`, `modals.profile.addingContact`, `modals.profile.contactAdded`
- [x] 3.2 Add corresponding i18n keys to `de.ts`, `es.ts`, `fr.ts`, `it.ts`, `pt.ts`

## 4. Validation

- [x] 4.1 Run `npm run check` and fix any type errors
- [x] 4.2 Run `npx vitest run` and fix any test failures
