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
 * Resolve a single pill key, preferring a video override when
 * `callMediaType === 'video'` and falling back to the voice key when
 * the locale has not supplied a video override yet.
 *
 * The fallback is keyed on the translator-result equalling the lookup
 * key itself — that's the contract svelte-i18n uses when a key is
 * missing — so locales without a `voiceCall.pill.video.*` block
 * render their localized voice copy rather than a raw key string.
 *
 * Exported for use by `CallEventMessage.svelte` so the in-chat pill
 * and the chat-list / notification previews share identical key
 * resolution logic.
 */
export function resolvePillKey(
    tr: (key: string) => string,
    base: string,
    callMediaType: 'voice' | 'video' | undefined
): string {
    if (callMediaType === 'video') {
        const videoKey = `voiceCall.pill.video.${base}`;
        const translated = tr(videoKey);
        // svelte-i18n returns the key when no translation is found.
        if (translated !== videoKey) return translated;
        // Locale has no video override — use the voice copy so we never
        // emit the raw key.
    }
    return tr(`voiceCall.pill.${base}`);
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
 * Video calls (`callMediaType === 'video'`) re-use the role/outcome
 * matrix but resolve through `voiceCall.pill.video.*` overrides for the
 * subset of keys whose copy mentions "voice call" (missed, ended,
 * endedWithDuration, noAnswerMe, busyMe, generic). The leading emoji
 * also switches from 📞 to 📹 so the chat-list row and notification
 * preview are visually distinguishable from voice calls without
 * relying on the user reading the label.
 *
 * @param callEventType   Value of the `call-event-type` tag persisted on
 *                        the rumor (`Message.callEventType`).
 * @param callDuration    Seconds; only consulted for `'ended'`.
 * @param callInitiatorNpub  npub from the `call-initiator` tag
 *                           (`Message.callInitiatorNpub`).
 * @param currentUserNpub The locally-authenticated user's npub
 *                        (`get(currentUser)?.npub`).
 * @param callMediaType   `'voice'` (default) or `'video'`. Controls
 *                        i18n key selection and the leading emoji.
 *                        Undefined / unknown values are treated as
 *                        `'voice'` for forward-compat with future media
 *                        types.
 */
export function getCallEventPreviewLabel(
    callEventType: string | undefined,
    callDuration: number | undefined,
    callInitiatorNpub: string | undefined,
    currentUserNpub: string | undefined,
    callMediaType?: 'voice' | 'video'
): string {
    const tr = get(t);
    const iAmInitiator =
        !!callInitiatorNpub &&
        !!currentUserNpub &&
        callInitiatorNpub === currentUserNpub;
    const pick = (base: string) => resolvePillKey(tr, base, callMediaType);

    let label: string;
    switch (callEventType) {
        case 'missed':
            label = pick('missed');
            break;
        case 'cancelled':
            label = pick('cancelled');
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
                label = pick('endedWithDuration').replace('{duration}', formatted);
            } else {
                label = pick('ended');
            }
            break;
        }
        case 'declined':
            // Without a known role we can't pick the right side, so fall
            // through to the generic label (matches pill's behavior when
            // $currentUser is null).
            if (!callInitiatorNpub || !currentUserNpub) {
                label = pick('generic');
            } else {
                label = iAmInitiator ? pick('declinedByPeer') : pick('declinedByMe');
            }
            break;
        case 'busy':
            if (!callInitiatorNpub || !currentUserNpub) {
                label = pick('generic');
            } else {
                label = iAmInitiator ? pick('busyByPeer') : pick('busyMe');
            }
            break;
        case 'no-answer':
            if (!callInitiatorNpub || !currentUserNpub) {
                label = pick('generic');
            } else {
                label = iAmInitiator ? pick('noAnswerByPeer') : pick('noAnswerMe');
            }
            break;
        case 'failed':
            label = pick('failed');
            break;
        default:
            // Legacy ('outgoing', 'incoming'), undefined, empty, and any
            // unknown forward-compat value.
            label = pick('generic');
            break;
    }

    const emoji = callMediaType === 'video' ? '📹' : '📞';
    return `${emoji} ${label}`;
}
