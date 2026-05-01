import { get } from 'svelte/store';
import { t } from '$lib/i18n';

/**
 * Returns a user-friendly, localized label for a media attachment based on its MIME type.
 * Used in contact list previews and notifications.
 */
export function getMediaPreviewLabel(fileType: string): string {
    // Voice messages (webm/opus or m4a)
    if (
        fileType === "audio/webm" ||
        fileType === "audio/ogg" ||
        fileType === "audio/mp4" ||
        fileType === "audio/x-m4a" ||
        fileType.includes("opus")
    ) {
        return `🎤 ${get(t)("contacts.mediaPreview.voiceMessage")}`;
    }
    // Images
    if (fileType.startsWith("image/")) {
        return `📷 ${get(t)("contacts.mediaPreview.image")}`;
    }
    // Videos
    if (fileType.startsWith("video/")) {
        return `🎬 ${get(t)("contacts.mediaPreview.video")}`;
    }
    // Other audio (music files)
    if (fileType.startsWith("audio/")) {
        return `🎵 ${get(t)("contacts.mediaPreview.audio")}`;
    }
    // Generic file
    return `📎 ${get(t)("contacts.mediaPreview.file")}`;
}

/**
 * Returns a user-friendly, localized label for a location message.
 * Used in contact list previews and notifications.
 */
export function getLocationPreviewLabel(): string {
    return `📍 ${get(t)("contacts.mediaPreview.location")}`;
}

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
 * fall through to the generic 'Voice call' label.
 *
 * Note: the helper is slightly stricter than the pill in
 * `CallEventMessage.svelte`. The pill, when `$currentUser` is null,
 * lets `iAmInitiator` evaluate to `false` and renders the `*Me` copy
 * (e.g. "Declined"). The helper instead short-circuits to `generic` so
 * a logged-out / loading auth state never produces a misleading
 * "Declined" preview in the chat list or in a push notification.
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
            // The `> 0` guard is not just dead code on top of the truthy
            // check: it also rejects negative values from malformed
            // foreign clients, which would otherwise render as
            // "-1:-5" because JS `%` preserves sign.
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
