## Context
nospeak currently represents unread state at the conversation level via a contact list dot. This change introduces a second, message-level unread representation that persists in `localStorage` so the UI can highlight which messages were unseen when the user opens a chat. The change also introduces PWA badge updates driven by the same unread state.

This design intentionally keeps the unread state local (single-device), aligning with existing local-only messaging state and avoiding protocol-level read receipts.

## Goals / Non-Goals
- Goals:
    - Track unseen messages and reactions per conversation in `localStorage` (per logged-in user).
    - Highlight unseen messages on chat open using a subtle left accent.
    - Clear stored unread state for a conversation immediately after the conversation is opened.
    - Clear unread state for a conversation when the user sends a message in that conversation.
    - Maintain the PWA app badge count as the total unread (messages + reactions).
- Non-Goals:
    - Cross-device synchronization of read state.
    - Replacing or re-defining the existing contact unread dot behavior.

## Decisions

### Decision: Define “unseen” using route + focus + visibility
A received message/reaction is considered **seen** only when all are true at receipt time:
- The user is currently viewing `/chat/<partner>`.
- `document.visibilityState === 'visible'`.
- `document.hasFocus() === true`.

If any of these are false, the event is considered **unseen** and is eligible to be persisted as unread.

Rationale:
- Route-only checks are insufficient; users can be “in the chat route” while the tab/app is backgrounded.
- Aligns with existing notification suppression logic which already uses visibility/focus.

### Decision: Persist unread state in localStorage keyed by current user
Unread state is stored per user to avoid leaking unread state between sessions.

Proposed key format:
- `nospeak:unread:<currentUserNpub>`

Data model (versioned):
- `version: 1`
- `byChat: Record<partnerNpub, { messages: string[]; reactions: string[] }>`

Where:
- `messages[]` stores message event IDs (gift-wrap IDs saved as `eventId` in the message DB).
- `reactions[]` stores reaction event IDs.

Rationale:
- Simple, portable, and consistent with existing settings stored in `localStorage`.
- Uses the existing logout cleanup behavior that removes `nospeak:` keys.

### Decision: Treat “first-time sync” as non-unread
Messages fetched during the first-time sync (empty cache) SHALL NOT be added to the unread list.

Rationale:
- Prevents the UX of logging in for the first time and seeing the entire historical backlog as unread.

### Decision: Show unread markers once per chat-open
When the user opens a conversation:
- The UI takes a snapshot of stored unread message IDs for that conversation.
- The UI clears *all* stored unread entries for that conversation (messages + reactions).

Rationale:
- Matches the requested “display then remove” behavior.
- Snapshotting prevents markers from disappearing mid-render.

### Decision: Ephemeral “new while active” highlight is in-memory only
When the user is actively viewing a conversation (route + focused + visible), newly received messages in that conversation MAY be highlighted with the same left accent, but MUST NOT be written to `localStorage` and MUST NOT affect app badge count.

The ephemeral highlight is cleared when:
- The user sends a message in the conversation.
- The app loses focus or becomes hidden.

Rationale:
- Provides immediate visual feedback for new arrivals without conflating “unseen” state.

### Decision: Badge API is best-effort
When supported:
- `navigator.setAppBadge(totalUnread)` is called on unread state changes.
- When `totalUnread === 0`, prefer `navigator.clearAppBadge()`.

Rationale:
- Badging API support is partial across browsers; it must not break messaging flows.

## Risks / Trade-offs
- `localStorage` size growth: a long time without opening chats could accumulate unread IDs.
    - Mitigation: per-chat clearing on open/send; deduplicate IDs; optional cap per chat (future).
- Incomplete Badging API support: must feature-detect and swallow errors.
- Duplicate events: message ingestion must avoid re-adding IDs if already stored.

## Migration Plan
- Introduce versioned storage payload.
- On parse failure or unknown versions, treat as empty and overwrite on next write.

## Open Questions
- None (requirements were clarified during discussion).
