## Why

Existing users who have a username but no messaging relays configured cannot send or receive messages. The current EmptyProfileModal only shows when a user has neither relays nor a username, leaving users with only a username in a broken state. These users need default relays auto-configured with notification, matching the new user experience.

## What Changes

- Auto-set default messaging relays for logged-in users who have a username but no messaging relays
- Show an info toast notifying users that relays were configured on their behalf
- Perform this check both at login completion and when the app resumes from background
- Add session-level flag to prevent duplicate notifications within the same session

## Capabilities

### New Capabilities

None

### Modified Capabilities

- `messaging`: Add requirement for auto-setting default relays for existing users without relays

## Impact

- **Affected code**: `AuthService.ts` (login flow), `+layout.svelte` (visibility handling)
- **New i18n strings**: Toast message in all 6 locale files
- **User experience**: Existing users without relays will automatically gain messaging capability
- **No breaking changes**: This is additive behavior that fixes a gap in the current flow
