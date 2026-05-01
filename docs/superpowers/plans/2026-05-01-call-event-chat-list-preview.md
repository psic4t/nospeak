# Call-Event Chat-List Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the most recent message in a 1-on-1 chat is a kind-1405 voice-call event, the chat list shows a `📞`-prefixed preview using the same role-aware copy as the in-chat pill. Push-notification bodies for those events get the same fix.

**Architecture:** Add a single new helper `getCallEventPreviewLabel` to `src/lib/utils/mediaPreview.ts` that mirrors the switch in `CallEventMessage.svelte` and reuses the existing `voiceCall.pill.*` i18n keys. Wire it into `ChatList.svelte`'s 1-on-1 preview builder, the group preview builder (forward-compat no-op for now), and `Messaging.ts`'s notification body builder, each as a `rumorKind === CALL_HISTORY_KIND` branch placed before the existing `fileUrl` / `location` / `message` cascade. Suppress the `"You: "` prefix for call rows since role is already encoded in the localized string.

**Tech Stack:** TypeScript, Svelte 5, Vitest, existing nospeak i18n.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `src/lib/utils/mediaPreview.ts` | Centralized helpers that turn a `Message` field into a localized one-line preview shared by chat list + notifications | Modify — add `getCallEventPreviewLabel` |
| `src/lib/utils/mediaPreview.test.ts` | Unit tests for preview helpers | Modify — add a `describe('getCallEventPreviewLabel')` block |
| `src/lib/components/ChatList.svelte` | Renders chat list rows; computes `lastMessageText` per chat | Modify — branch on kind 1405 in both preview builders, suppress `You:` prefix for call rows |
| `src/lib/core/Messaging.ts` | Receives rumors, persists messages, fires push notifications | Modify — branch on kind 1405 in notification body builder |

No new files. No DB migration. No wire-format change.

---

## Task 1: Add `getCallEventPreviewLabel` helper (TDD)

**Files:**
- Modify: `src/lib/utils/mediaPreview.ts`
- Test: `src/lib/utils/mediaPreview.test.ts`

The helper mirrors the switch in `src/lib/components/CallEventMessage.svelte:46-79`. It MUST reuse the existing `voiceCall.pill.*` i18n keys (defined in `src/lib/i18n/locales/en.ts:521-547`) so we don't duplicate translations across 21 locales. Always prefixes with `📞 ` to match the convention of `getMediaPreviewLabel` (`📷 / 🎤 / 🎬 / 🎵 / 📎`) and `getLocationPreviewLabel` (`📍`).

Signature:

```ts
export function getCallEventPreviewLabel(
    callEventType: string | undefined,
    callDuration: number | undefined,
    callInitiatorNpub: string | undefined,
    currentUserNpub: string | undefined
): string
```

Role rule: `iAmInitiator = !!callInitiatorNpub && !!currentUserNpub && callInitiatorNpub === currentUserNpub`. When either npub is missing, asymmetric outcomes (`declined` / `busy` / `no-answer`) fall through to `voiceCall.pill.generic` to mirror the pill's behavior (which renders no role-specific copy when `$currentUser` is null).

Duration formatter for `ended`: `MM:SS` with two-digit seconds (matches `formatDuration` in `CallEventMessage.svelte:12-17`).

- [ ] **Step 1: Extend the i18n mock and add failing tests for `getCallEventPreviewLabel`**

Modify `src/lib/utils/mediaPreview.test.ts`. Replace the entire file with:

```ts
import { describe, it, expect, vi } from 'vitest';

// Mock the i18n module
vi.mock('$lib/i18n', () => ({
    t: {
        subscribe: vi.fn((fn) => {
            fn((key: string) => {
                const translations: Record<string, string> = {
                    'contacts.mediaPreview.voiceMessage': 'Voice Message',
                    'contacts.mediaPreview.image': 'Image',
                    'contacts.mediaPreview.video': 'Video',
                    'contacts.mediaPreview.audio': 'Audio',
                    'contacts.mediaPreview.file': 'File',
                    'contacts.mediaPreview.location': 'Location',
                    'voiceCall.pill.missed': 'Missed voice call',
                    'voiceCall.pill.ended': 'Voice call ended',
                    'voiceCall.pill.endedWithDuration': 'Voice call ended \u2022 {duration}',
                    'voiceCall.pill.noAnswerByPeer': 'No answer',
                    'voiceCall.pill.noAnswerMe': 'Missed voice call',
                    'voiceCall.pill.declinedByPeer': 'Call declined',
                    'voiceCall.pill.declinedByMe': 'Declined',
                    'voiceCall.pill.busyByPeer': 'User busy',
                    'voiceCall.pill.busyMe': 'Missed voice call (busy)',
                    'voiceCall.pill.failed': 'Connection failed',
                    'voiceCall.pill.cancelled': 'Cancelled',
                    'voiceCall.pill.generic': 'Voice call'
                };
                return translations[key] || key;
            });
            return () => {};
        })
    }
}));

import {
    getMediaPreviewLabel,
    getLocationPreviewLabel,
    getCallEventPreviewLabel
} from './mediaPreview';

describe('getMediaPreviewLabel', () => {
    it('returns voice message label for audio/webm', () => {
        expect(getMediaPreviewLabel('audio/webm')).toBe('🎤 Voice Message');
    });

    it('returns voice message label for audio/ogg', () => {
        expect(getMediaPreviewLabel('audio/ogg')).toBe('🎤 Voice Message');
    });

    it('returns voice message label for audio/mp4 (m4a)', () => {
        expect(getMediaPreviewLabel('audio/mp4')).toBe('🎤 Voice Message');
    });

    it('returns voice message label for audio/x-m4a', () => {
        expect(getMediaPreviewLabel('audio/x-m4a')).toBe('🎤 Voice Message');
    });

    it('returns voice message label for codecs containing opus', () => {
        expect(getMediaPreviewLabel('audio/ogg; codecs=opus')).toBe('🎤 Voice Message');
    });

    it('returns image label for image/* types', () => {
        expect(getMediaPreviewLabel('image/jpeg')).toBe('📷 Image');
        expect(getMediaPreviewLabel('image/png')).toBe('📷 Image');
        expect(getMediaPreviewLabel('image/gif')).toBe('📷 Image');
        expect(getMediaPreviewLabel('image/webp')).toBe('📷 Image');
    });

    it('returns video label for video/* types', () => {
        expect(getMediaPreviewLabel('video/mp4')).toBe('🎬 Video');
        expect(getMediaPreviewLabel('video/webm')).toBe('🎬 Video');
        expect(getMediaPreviewLabel('video/quicktime')).toBe('🎬 Video');
    });

    it('returns audio label for other audio/* types (music)', () => {
        expect(getMediaPreviewLabel('audio/mpeg')).toBe('🎵 Audio');
        expect(getMediaPreviewLabel('audio/mp3')).toBe('🎵 Audio');
        expect(getMediaPreviewLabel('audio/wav')).toBe('🎵 Audio');
    });

    it('returns file label for unknown types', () => {
        expect(getMediaPreviewLabel('application/pdf')).toBe('📎 File');
        expect(getMediaPreviewLabel('application/zip')).toBe('📎 File');
        expect(getMediaPreviewLabel('text/plain')).toBe('📎 File');
    });
});

describe('getCallEventPreviewLabel', () => {
    const me = 'npub1me';
    const peer = 'npub1peer';

    // Symmetric outcomes
    it('formats missed (local-only on callee)', () => {
        expect(getCallEventPreviewLabel('missed', undefined, peer, me))
            .toBe('📞 Missed voice call');
    });

    it('formats cancelled (local-only on caller)', () => {
        expect(getCallEventPreviewLabel('cancelled', undefined, me, me))
            .toBe('📞 Cancelled');
    });

    it('formats ended without duration', () => {
        expect(getCallEventPreviewLabel('ended', undefined, me, me))
            .toBe('📞 Voice call ended');
    });

    it('formats ended with duration as MM:SS', () => {
        expect(getCallEventPreviewLabel('ended', 83, me, me))
            .toBe('📞 Voice call ended • 1:23');
    });

    it('pads ended duration seconds to two digits', () => {
        expect(getCallEventPreviewLabel('ended', 65, me, me))
            .toBe('📞 Voice call ended • 1:05');
        expect(getCallEventPreviewLabel('ended', 9, me, me))
            .toBe('📞 Voice call ended • 0:09');
    });

    it('treats ended with duration 0 as ended without duration', () => {
        expect(getCallEventPreviewLabel('ended', 0, me, me))
            .toBe('📞 Voice call ended');
    });

    it('formats failed', () => {
        expect(getCallEventPreviewLabel('failed', undefined, me, me))
            .toBe('📞 Connection failed');
    });

    // Asymmetric outcomes — initiator side
    it('formats declined as "Call declined" when local user is initiator', () => {
        expect(getCallEventPreviewLabel('declined', undefined, me, me))
            .toBe('📞 Call declined');
    });

    it('formats busy as "User busy" when local user is initiator', () => {
        expect(getCallEventPreviewLabel('busy', undefined, me, me))
            .toBe('📞 User busy');
    });

    it('formats no-answer as "No answer" when local user is initiator', () => {
        expect(getCallEventPreviewLabel('no-answer', undefined, me, me))
            .toBe('📞 No answer');
    });

    // Asymmetric outcomes — peer side (local user is recipient)
    it('formats declined as "Declined" when peer is initiator', () => {
        expect(getCallEventPreviewLabel('declined', undefined, peer, me))
            .toBe('📞 Declined');
    });

    it('formats busy as "Missed voice call (busy)" when peer is initiator', () => {
        expect(getCallEventPreviewLabel('busy', undefined, peer, me))
            .toBe('📞 Missed voice call (busy)');
    });

    it('formats no-answer as "Missed voice call" when peer is initiator', () => {
        expect(getCallEventPreviewLabel('no-answer', undefined, peer, me))
            .toBe('📞 Missed voice call');
    });

    // Missing currentUserNpub → asymmetric falls through to generic
    it('falls through to generic when currentUserNpub is undefined for asymmetric outcomes', () => {
        expect(getCallEventPreviewLabel('declined', undefined, peer, undefined))
            .toBe('📞 Voice call');
        expect(getCallEventPreviewLabel('busy', undefined, peer, undefined))
            .toBe('📞 Voice call');
        expect(getCallEventPreviewLabel('no-answer', undefined, peer, undefined))
            .toBe('📞 Voice call');
    });

    // Missing callInitiatorNpub → asymmetric falls through to generic
    it('falls through to generic when callInitiatorNpub is undefined for asymmetric outcomes', () => {
        expect(getCallEventPreviewLabel('declined', undefined, undefined, me))
            .toBe('📞 Voice call');
    });

    // Symmetric outcomes don't depend on role
    it('formats missed correctly even without npubs', () => {
        expect(getCallEventPreviewLabel('missed', undefined, undefined, undefined))
            .toBe('📞 Missed voice call');
    });

    it('formats ended with duration even without npubs', () => {
        expect(getCallEventPreviewLabel('ended', 125, undefined, undefined))
            .toBe('📞 Voice call ended • 2:05');
    });

    // Legacy / forward-compat values
    it('falls through to generic for legacy "outgoing"', () => {
        expect(getCallEventPreviewLabel('outgoing', undefined, me, me))
            .toBe('📞 Voice call');
    });

    it('falls through to generic for legacy "incoming"', () => {
        expect(getCallEventPreviewLabel('incoming', undefined, peer, me))
            .toBe('📞 Voice call');
    });

    it('falls through to generic for unknown forward-compat value', () => {
        expect(getCallEventPreviewLabel('some-future-value', undefined, me, me))
            .toBe('📞 Voice call');
    });

    it('falls through to generic for undefined callEventType', () => {
        expect(getCallEventPreviewLabel(undefined, undefined, me, me))
            .toBe('📞 Voice call');
    });

    it('falls through to generic for empty-string callEventType', () => {
        expect(getCallEventPreviewLabel('', undefined, me, me))
            .toBe('📞 Voice call');
    });
});

describe('getLocationPreviewLabel', () => {
    it('returns location label', () => {
        expect(getLocationPreviewLabel()).toBe('📍 Location');
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/utils/mediaPreview.test.ts`

Expected: All `getCallEventPreviewLabel` tests FAIL with "getCallEventPreviewLabel is not a function" (or equivalent import error). The existing `getMediaPreviewLabel` tests should still PASS, plus the new `getLocationPreviewLabel` test should PASS.

- [ ] **Step 3: Implement `getCallEventPreviewLabel`**

Modify `src/lib/utils/mediaPreview.ts`. Append the following function at the end of the file (after `getLocationPreviewLabel`):

```ts
/**
 * Returns a user-friendly, localized one-line preview of a call event,
 * suitable for the chat list and push notifications.
 *
 * Mirrors the switch in `src/lib/components/CallEventMessage.svelte`
 * (the in-chat pill) and reuses the same `voiceCall.pill.*` i18n keys,
 * so chat-list previews, notifications, and the in-chat pill stay in
 * sync without duplicating translated strings across locales.
 *
 * Role-aware copy for asymmetric outcomes (`declined` / `busy` /
 * `no-answer`): uses `*ByPeer` strings when the local user initiated
 * the call (peer is the actor), `*Me` strings when the peer initiated
 * (local user is the actor). Determined by comparing `callInitiatorNpub`
 * to `currentUserNpub`. When either is missing, asymmetric outcomes
 * fall through to the generic 'Voice call' label — same fallback the
 * pill renderer uses.
 *
 * Symmetric outcomes (`missed`, `cancelled`, `ended`, `failed`) ignore
 * role.
 *
 * Legacy values (`'outgoing'`, `'incoming'`) and any unknown / forward-
 * compat callEventType fall through to the generic label so the preview
 * never renders blank.
 *
 * @param callEventType   Value of the `call-event-type` tag persisted on
 *                        the rumor (`Message.callEventType`).
 * @param callDuration    Seconds; only consulted for `'ended'`.
 * @param callInitiatorNpub  npub from the `call-initiator` tag
 *                           (`Message.callInitiatorNpub`).
 * @param currentUserNpub The locally-authenticated user's npub
 *                        (`get(currentUser)?.npub`).
 */
export function getCallEventPreviewLabel(
    callEventType: string | undefined,
    callDuration: number | undefined,
    callInitiatorNpub: string | undefined,
    currentUserNpub: string | undefined
): string {
    const tr = get(t);
    const iAmInitiator =
        !!callInitiatorNpub &&
        !!currentUserNpub &&
        callInitiatorNpub === currentUserNpub;

    let label: string;
    switch (callEventType) {
        case 'missed':
            label = tr('voiceCall.pill.missed');
            break;
        case 'cancelled':
            label = tr('voiceCall.pill.cancelled');
            break;
        case 'ended': {
            if (callDuration && callDuration > 0) {
                const mins = Math.floor(callDuration / 60);
                const secs = callDuration % 60;
                const formatted = `${mins}:${secs.toString().padStart(2, '0')}`;
                label = tr('voiceCall.pill.endedWithDuration')
                    .replace('{duration}', formatted);
            } else {
                label = tr('voiceCall.pill.ended');
            }
            break;
        }
        case 'declined':
            // Without a known role we can't pick the right side, so fall
            // through to the generic label (matches pill's behavior when
            // $currentUser is null).
            if (!callInitiatorNpub || !currentUserNpub) {
                label = tr('voiceCall.pill.generic');
            } else {
                label = iAmInitiator
                    ? tr('voiceCall.pill.declinedByPeer')
                    : tr('voiceCall.pill.declinedByMe');
            }
            break;
        case 'busy':
            if (!callInitiatorNpub || !currentUserNpub) {
                label = tr('voiceCall.pill.generic');
            } else {
                label = iAmInitiator
                    ? tr('voiceCall.pill.busyByPeer')
                    : tr('voiceCall.pill.busyMe');
            }
            break;
        case 'no-answer':
            if (!callInitiatorNpub || !currentUserNpub) {
                label = tr('voiceCall.pill.generic');
            } else {
                label = iAmInitiator
                    ? tr('voiceCall.pill.noAnswerByPeer')
                    : tr('voiceCall.pill.noAnswerMe');
            }
            break;
        case 'failed':
            label = tr('voiceCall.pill.failed');
            break;
        default:
            // Legacy ('outgoing', 'incoming'), undefined, empty, and any
            // unknown forward-compat value.
            label = tr('voiceCall.pill.generic');
            break;
    }

    return `📞 ${label}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/utils/mediaPreview.test.ts`

Expected: All tests PASS (existing 9 `getMediaPreviewLabel` tests + new `getCallEventPreviewLabel` tests + 1 `getLocationPreviewLabel` test).

- [ ] **Step 5: Run type check**

Run: `npm run check`

Expected: Pass with no new errors. Pre-existing errors unrelated to this change are acceptable.

- [ ] **Step 6: Commit**

```bash
git add src/lib/utils/mediaPreview.ts src/lib/utils/mediaPreview.test.ts
git commit -m "feat(voice-call): add getCallEventPreviewLabel helper

Mirrors the in-chat pill switch in CallEventMessage.svelte and reuses
the existing voiceCall.pill.* i18n keys so chat-list previews and push
notifications can render the same role-aware copy without new
translations. Prefixes with the phone emoji to match the convention of
getMediaPreviewLabel and getLocationPreviewLabel."
```

---

## Task 2: Show call previews in `ChatList.svelte`

**Files:**
- Modify: `src/lib/components/ChatList.svelte:24` (imports)
- Modify: `src/lib/components/ChatList.svelte:205-218` (1-on-1 preview builder)
- Modify: `src/lib/components/ChatList.svelte:341-358` (group preview builder)

The 1-on-1 builder already gets the last `Message` row regardless of `rumorKind`, including kind 1405. The group builder is updated symmetrically for forward-compat — there are no group calls today, so this is a no-op for current data, but it defends against regressions if group calls land later.

Suppress the `"You: "` prefix for kind-1405 rows since the role is already encoded in the localized string (e.g. `"Cancelled"` already implies the local user, `"Call declined"` already implies the peer declined ours). For groups, suppress both the `"You: "` and `"<senderName>: "` prefixes for the same reason.

- [ ] **Step 1: Add imports**

In `src/lib/components/ChatList.svelte`, locate line 24:

```ts
  import { getMediaPreviewLabel, getLocationPreviewLabel } from "$lib/utils/mediaPreview";
```

Replace with:

```ts
  import { getMediaPreviewLabel, getLocationPreviewLabel, getCallEventPreviewLabel } from "$lib/utils/mediaPreview";
  import { CALL_HISTORY_KIND } from "$lib/core/voiceCall/constants";
```

`currentUser` is already imported at line 2; no additional store import needed.

- [ ] **Step 2: Branch on kind 1405 in the 1-on-1 preview builder**

In `src/lib/components/ChatList.svelte`, locate the block at lines 205–218:

```ts
    let lastMessageText = "";
    if (lastMsg) {
      if (lastMsg.fileUrl && lastMsg.fileType) {
        lastMessageText = getMediaPreviewLabel(lastMsg.fileType);
      } else if (lastMsg.location) {
        lastMessageText = getLocationPreviewLabel();
      } else {
        lastMessageText = (lastMsg.message || "").replace(/\s+/g, " ").trim();
      }

      if (lastMessageText && lastMsg.direction === "sent") {
        lastMessageText = `${get(t)("contacts.youPrefix") || "You"}: ${lastMessageText}`;
      }
    }
```

Replace with:

```ts
    let lastMessageText = "";
    let suppressYouPrefix = false;
    if (lastMsg) {
      if (lastMsg.rumorKind === CALL_HISTORY_KIND) {
        // Call-event row (kind 1405). The localized pill copy already
        // encodes role (e.g. "Cancelled" implies local user, "Call
        // declined" implies peer declined our call), so we suppress
        // the "You: " prefix that normally fires for direction === "sent".
        lastMessageText = getCallEventPreviewLabel(
          lastMsg.callEventType,
          lastMsg.callDuration,
          lastMsg.callInitiatorNpub,
          get(currentUser)?.npub,
        );
        suppressYouPrefix = true;
      } else if (lastMsg.fileUrl && lastMsg.fileType) {
        lastMessageText = getMediaPreviewLabel(lastMsg.fileType);
      } else if (lastMsg.location) {
        lastMessageText = getLocationPreviewLabel();
      } else {
        lastMessageText = (lastMsg.message || "").replace(/\s+/g, " ").trim();
      }

      if (lastMessageText && lastMsg.direction === "sent" && !suppressYouPrefix) {
        lastMessageText = `${get(t)("contacts.youPrefix") || "You"}: ${lastMessageText}`;
      }
    }
```

- [ ] **Step 3: Branch on kind 1405 in the group preview builder**

In `src/lib/components/ChatList.svelte`, locate the block at lines 341–358:

```ts
      let lastMessageText = "";
      if (lastMsg) {
        if (lastMsg.fileUrl && lastMsg.fileType) {
          lastMessageText = getMediaPreviewLabel(lastMsg.fileType);
        } else if (lastMsg.location) {
          lastMessageText = getLocationPreviewLabel();
        } else {
          lastMessageText = (lastMsg.message || "").replace(/\s+/g, " ").trim();
        }

        if (lastMessageText && lastMsg.direction === "sent") {
          lastMessageText = `${get(t)("contacts.youPrefix") || "You"}: ${lastMessageText}`;
        } else if (lastMessageText && lastMsg.senderNpub) {
          const senderProfile = profileCache.get(lastMsg.senderNpub);
          const senderName = resolveDisplayName(senderProfile?.metadata, lastMsg.senderNpub);
          lastMessageText = `${senderName}: ${lastMessageText}`;
        }
      }
```

Replace with:

```ts
      let lastMessageText = "";
      let suppressGroupSenderPrefix = false;
      if (lastMsg) {
        if (lastMsg.rumorKind === CALL_HISTORY_KIND) {
          // Forward-compat: there are no group voice calls today, but
          // this branch keeps the preview from rendering blank if a
          // future build lands them. Suppress both the "You: " and
          // "<sender>: " prefixes since role is already encoded.
          lastMessageText = getCallEventPreviewLabel(
            lastMsg.callEventType,
            lastMsg.callDuration,
            lastMsg.callInitiatorNpub,
            get(currentUser)?.npub,
          );
          suppressGroupSenderPrefix = true;
        } else if (lastMsg.fileUrl && lastMsg.fileType) {
          lastMessageText = getMediaPreviewLabel(lastMsg.fileType);
        } else if (lastMsg.location) {
          lastMessageText = getLocationPreviewLabel();
        } else {
          lastMessageText = (lastMsg.message || "").replace(/\s+/g, " ").trim();
        }

        if (!suppressGroupSenderPrefix) {
          if (lastMessageText && lastMsg.direction === "sent") {
            lastMessageText = `${get(t)("contacts.youPrefix") || "You"}: ${lastMessageText}`;
          } else if (lastMessageText && lastMsg.senderNpub) {
            const senderProfile = profileCache.get(lastMsg.senderNpub);
            const senderName = resolveDisplayName(senderProfile?.metadata, lastMsg.senderNpub);
            lastMessageText = `${senderName}: ${lastMessageText}`;
          }
        }
      }
```

- [ ] **Step 4: Run type check**

Run: `npm run check`

Expected: Pass with no new errors. Confirm there are no Svelte template errors and no missing-import errors for `CALL_HISTORY_KIND` or `getCallEventPreviewLabel`.

- [ ] **Step 5: Run full test suite**

Run: `npx vitest run`

Expected: All tests pass, including the new helper tests from Task 1. No existing tests should regress.

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/ChatList.svelte
git commit -m "feat(voice-call): show call-event preview in chat list

When the most recent message in a chat is a kind-1405 call event, the
chat list now shows a 📞-prefixed preview using the same role-aware
copy as the in-chat pill (e.g. 'Missed voice call', 'Voice call ended
• 1:23', 'Call declined'). Without this, kind-1405 rows produced an
empty preview line because the row has no message/fileUrl/location.

Suppresses the 'You: ' / '<sender>: ' prefix for call rows since the
role is already encoded in the localized string. Both the 1-on-1 and
the group preview builder are updated; the group branch is a no-op
for current data (no group calls) but defends against regressions if
group calls land later."
```

---

## Task 3: Use the helper in the notification body builder

**Files:**
- Modify: `src/lib/core/Messaging.ts:869-879` (notification body)

`processRumor` (`src/lib/core/Messaging.ts:845`) handles ALL received rumor kinds — including 1405 via `createMessageFromRumor`'s kind-1405 branch (lines 730–755). The notification body cascade at lines 870–875 currently has no kind-1405 branch, so push notifications for incoming missed/declined calls show empty bodies. We add the same branch using the same helper.

`getCallEventPreviewLabel`, `currentUser`, and `get` need to be available; we'll verify at the import site of `Messaging.ts`.

- [ ] **Step 1: Verify imports in `Messaging.ts`**

Run: `rg -n "getMediaPreviewLabel|getLocationPreviewLabel|currentUser|^import.*from 'svelte/store'" src/lib/core/Messaging.ts | head`

Expected: `getMediaPreviewLabel` and `getLocationPreviewLabel` are imported from `$lib/utils/mediaPreview`. `currentUser` is imported from `$lib/stores/auth`. `get` is imported from `svelte/store`. If any of these are missing, add them in Step 2.

- [ ] **Step 2: Add `getCallEventPreviewLabel` to the import**

Locate the existing import line for `getMediaPreviewLabel` in `src/lib/core/Messaging.ts` (something like `import { getMediaPreviewLabel, getLocationPreviewLabel } from '$lib/utils/mediaPreview';`).

Replace it with:

```ts
import { getMediaPreviewLabel, getLocationPreviewLabel, getCallEventPreviewLabel } from '$lib/utils/mediaPreview';
```

- [ ] **Step 3: Branch on kind 1405 in the notification body builder**

In `src/lib/core/Messaging.ts`, locate the notification body block at lines 869–879:

```ts
      if (!this.isFetchingHistory && rumor.created_at >= this.sessionStartedAt) {
        // Use friendly label for media attachments or location messages
        const notificationBody = (message.fileUrl && message.fileType)
          ? getMediaPreviewLabel(message.fileType)
          : message.location
            ? getLocationPreviewLabel()
            : message.message;
        // For group messages, use senderNpub (actual sender); for 1-on-1, recipientNpub is the sender
        const notificationSender = message.senderNpub || message.recipientNpub;
        // Pass conversationId so notification click navigates to correct chat (group or 1-on-1)
        await notificationService.showNewMessageNotification(notificationSender, notificationBody, message.conversationId);
      }
```

Replace with:

```ts
      if (!this.isFetchingHistory && rumor.created_at >= this.sessionStartedAt) {
        // Use friendly label for media attachments, location messages, or
        // call events (kind 1405). Without the call-event branch, missed
        // / declined call notifications would show an empty body because
        // the message has no text content.
        const notificationBody = (message.rumorKind === CALL_HISTORY_KIND)
          ? getCallEventPreviewLabel(
              message.callEventType,
              message.callDuration,
              message.callInitiatorNpub,
              user.npub,
            )
          : (message.fileUrl && message.fileType)
            ? getMediaPreviewLabel(message.fileType)
            : message.location
              ? getLocationPreviewLabel()
              : message.message;
        // For group messages, use senderNpub (actual sender); for 1-on-1, recipientNpub is the sender
        const notificationSender = message.senderNpub || message.recipientNpub;
        // Pass conversationId so notification click navigates to correct chat (group or 1-on-1)
        await notificationService.showNewMessageNotification(notificationSender, notificationBody, message.conversationId);
      }
```

`user` is the local-scoped `currentUser` value already used elsewhere in `processRumor` (at line 847: `const user = get(currentUser);`). `CALL_HISTORY_KIND` is already imported in `Messaging.ts` (it's used at line 732). If either is somehow missing, add the import.

- [ ] **Step 4: Verify `CALL_HISTORY_KIND` and `user` are in scope**

Run: `rg -n "CALL_HISTORY_KIND|const user = get\(currentUser\)" src/lib/core/Messaging.ts | head -10`

Expected: `CALL_HISTORY_KIND` appears in an import line near the top of the file, AND there is a `const user = get(currentUser);` line inside `processRumor` (around line 847). Both are required for the new branch to compile and behave correctly.

- [ ] **Step 5: Run type check**

Run: `npm run check`

Expected: Pass with no new errors.

- [ ] **Step 6: Run full test suite**

Run: `npx vitest run`

Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/lib/core/Messaging.ts
git commit -m "fix(voice-call): show preview text in call-event notifications

processRumor handles kind-1405 call events the same as kind-14/15
messages, but the notification body cascade had no branch for them,
so push notifications for incoming missed / declined calls displayed
an empty body. Reuse getCallEventPreviewLabel so notifications, the
chat-list preview, and the in-chat pill share one source of truth."
```

---

## Task 4: End-to-end manual verification

**Files:** none modified

Smoke test the full lifecycle on a dev build. Two devices / two profiles required (or at least two browser contexts) to exercise both caller and callee outcomes.

- [ ] **Step 1: Build & run**

Run: `npm run build`

Expected: Build succeeds with no errors. Then start the dev server (or load the built artifact in your usual harness).

- [ ] **Step 2: Trigger each terminal call outcome and verify the chat-list preview matches the in-chat pill**

For each row below, place a call from device A to device B, drive it to the listed outcome, and confirm:

1. The in-chat pill shows the listed text (this is unchanged behavior).
2. The chat list row's preview line shows `📞 <same text>`.
3. The chat row sorts to the top (newest first).
4. No `You:` or `<sender>:` prefix is added to call rows.

| Outcome | Trigger | Expected pill text | Expected preview |
|---|---|---|---|
| `missed` | A calls B; B never picks up; A hangs up after timeout (callee side) | "Missed voice call" | "📞 Missed voice call" |
| `cancelled` | A calls B; A hangs up before B answers (caller side) | "Cancelled" | "📞 Cancelled" |
| `ended` (no duration) | Edge case — manually verify if possible by triggering a hangup before duration is recorded; otherwise skip | "Voice call ended" | "📞 Voice call ended" |
| `ended` (with duration) | A calls B; B picks up; talk for ~1m23s; either side hangs up | "Voice call ended • 1:23" | "📞 Voice call ended • 1:23" |
| `declined` (caller side) | A calls B; B taps decline | "Call declined" | "📞 Call declined" |
| `declined` (callee side) | A calls B; B taps decline | "Declined" | "📞 Declined" |
| `busy` (caller side) | B already in another call; A calls B | "User busy" | "📞 User busy" |
| `busy` (callee side) | Same scenario, callee row | "Missed voice call (busy)" | "📞 Missed voice call (busy)" |
| `no-answer` (caller side) | A calls B; B never picks up; A's offer times out | "No answer" | "📞 No answer" |
| `no-answer` (callee side) | Same scenario, callee row (note: callee actually authors `missed`, so this row may show `missed` copy on B) | n/a | n/a |
| `failed` | Force an ICE failure (e.g. block UDP, kill network during setup) | "Connection failed" | "📞 Connection failed" |

- [ ] **Step 3: Verify push notification body for an incoming missed call**

With device B in the background (PWA or Android native), have device A call B. Let it ring out without picking up. Verify the system push notification body reads "📞 Missed voice call" (or the appropriate variant for your role) instead of an empty / placeholder body.

Repeat with device A declining a call B placed: B's notification (if any) should show "📞 Call declined" rather than blank.

- [ ] **Step 4: Verify nothing regressed for non-call rows**

In a chat where the most recent message is text, a media attachment, or a location, confirm:
- Text messages still show the trimmed text with the existing `You: ` prefix when sent.
- Media still shows `📷 Image` / `🎤 Voice Message` / `🎬 Video` / `🎵 Audio` / `📎 File`.
- Location still shows `📍 Location`.
- Sort order by `lastMessageTime` is unchanged.

- [ ] **Step 5: Done**

If all manual checks pass, the change is verified. No commit in this task.

---

## Self-Review Notes

Spec coverage:
- "show last activity for voice calls in chat list" → Task 2 (1-on-1 + group preview branches)
- "uses same role-aware copy as in-chat pill" → Task 1 (helper mirrors the pill switch and reuses i18n keys)
- "no empty preview lines" → Task 1 default branch + Task 2 wiring
- Bonus: "notification body for missed calls should not be blank" → Task 3

Type consistency: `getCallEventPreviewLabel` signature is referenced identically in Task 2 (twice) and Task 3. `CALL_HISTORY_KIND` import path is consistent.

No placeholders. Every code block is the real text the engineer types.
