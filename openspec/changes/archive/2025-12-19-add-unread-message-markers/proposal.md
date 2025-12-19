# Change: Add per-message unread markers and PWA badge

## Why
The current unread experience only shows a conversation-level dot in the contact list. Users need to quickly identify which specific messages are new (unseen) when opening a chat, and the PWA should expose the total unread count via the Badging API.

## What Changes
- Persist a per-user, per-conversation list of **unseen** message IDs and reaction event IDs in `localStorage`.
- When opening a conversation, render subtle per-message unread markers (left accent) for messages that were previously unseen.
- After the unread markers are displayed for an opened conversation, clear that conversation’s unread entries from `localStorage`.
- When sending a message in a conversation, clear all unread markers for that conversation.
- Set the PWA app badge count to the total unread message + reaction count via `navigator.setAppBadge(...)` when supported.

## Impact
- Affected specs: `messaging`
- Affected systems:
    - Message ingestion (real-time subscription + login sync)
    - Chat UI rendering
    - Local persistence (`localStorage`)
    - PWA Badge API integration

## Non-Goals
- Changing the existing conversation-level unread dot semantics in the contact list.
- Implementing server-side read receipts or cross-device read state.
- Adding notification badge integration beyond the W3C Badging API.
