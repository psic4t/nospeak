## Context

The app currently has an `EmptyProfileModal` that shows when a new user logs in with neither messaging relays nor a username. It sets default relays and requires a username before proceeding. However, existing users who have a username but later lose their messaging relays (or never had them configured) are left in a broken state where they cannot send or receive messages.

The solution needs to handle two scenarios:
1. **Login flow**: After the ordered login history flow completes
2. **App resume**: When the app returns from background (visibility change)

The toast notification system (`showToast`) already exists and is suitable for informing users.

## Goals / Non-Goals

**Goals:**
- Auto-configure default messaging relays for users with username but no relays
- Notify users via toast that relays were configured
- Check both at login and on app resume
- Prevent duplicate notifications within a session

**Non-Goals:**
- Modifying the existing EmptyProfileModal behavior for truly new users
- Adding undo functionality for auto-set relays
- Persisting notification state across sessions (re-notifying on next login is acceptable)

## Decisions

### 1. Check Location: AuthService + Layout Visibility Handler

The relay check will happen in two places:
- `AuthService.ts`: After the empty profile check in `runLoginHistoryFlow()` - handles login
- `+layout.svelte`: On `visibilitychange` when app becomes visible - handles resume

**Alternatives considered:**
- Single location in AuthService only: Rejected because it wouldn't catch the app resume case
- ConnectionManager visibility handler: Rejected because it's focused on connection management, not user profile checks

### 2. Session Flag via Module-Level Variable

Use a module-level boolean flag (`hasNotifiedAboutAutoRelays`) in AuthService to track whether we've already notified in this session. Reset on logout.

**Alternatives considered:**
- Svelte store: Rejected as overkill for a simple boolean that doesn't need reactivity
- sessionStorage: Rejected because it persists across tabs and could cause issues

### 3. Reuse Existing Services

Use `relaySettingsService.updateSettings()` and `getDefaultMessagingRelays()` - the same functions used by EmptyProfileModal - to ensure consistency.

**Alternatives considered:**
- Duplicate the logic: Rejected to avoid code duplication and ensure consistent behavior

### 4. Extract Check Logic to Shared Function

Create a new exported function `checkAndAutoSetRelays()` in AuthService that can be called from both the login flow and the layout visibility handler. This avoids duplicating the profile fetch and check logic.

## Risks / Trade-offs

- **Network failure during relay publish**: The existing error handling in `relaySettingsService.updateSettings()` will catch this. We'll show the toast only on success.

- **Race condition on visibility change**: The check fetches the profile from cache, which should be populated after login. If called before login completes, it will simply find no user and return early.

- **Multiple toasts if user switches tabs rapidly**: The session flag prevents this.

## Migration Plan

No migration needed - this is purely additive behavior. Rollback is simply reverting the code change.
