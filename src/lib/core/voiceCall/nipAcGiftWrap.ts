import {
    finalizeEvent,
    generateSecretKey,
    getPublicKey,
    nip44,
    verifyEvent,
    type NostrEvent
} from 'nostr-tools';
import {
    NIP_AC_GIFT_WRAP_KIND,
    GROUP_CALL_ID_TAG,
    CONVERSATION_ID_TAG,
    INITIATOR_TAG,
    PARTICIPANTS_TAG,
    ROLE_TAG,
    ROLE_INVITE
} from './constants';
import type { NipAcGroupSendContext } from './types';

/**
 * NIP-AC ephemeral gift wrap (kind 21059).
 *
 * Structurally a single-layer NIP-59 wrap: the inner signed event is
 * encrypted with NIP-44 v2 directly to the recipient using a freshly
 * generated ephemeral keypair. There is NO seal layer — the inner
 * event's own signature provides authentication, and the ephemeral
 * outer-key signature hides the sender from relays. The wrap carries
 * no `expiration` tag; the ephemeral kind range itself signals
 * transience.
 *
 * Used exclusively for voice-call signaling (inner kinds 25050-25054).
 * Chat (kind 14) and call history (kind 1405) continue to use the
 * 3-layer NIP-17 pipeline in `Messaging.createGiftWrap`.
 */
export function createNipAcGiftWrap(
    signedInnerEvent: NostrEvent,
    recipientPubkey: string
): NostrEvent {
    if (!signedInnerEvent.sig || !signedInnerEvent.id) {
        throw new Error('createNipAcGiftWrap: inner event must be signed');
    }

    const innerJson = JSON.stringify(signedInnerEvent);
    const ephemeralPriv = generateSecretKey();
    const ephemeralPub = getPublicKey(ephemeralPriv);
    const conversationKey = nip44.v2.utils.getConversationKey(
        ephemeralPriv,
        recipientPubkey
    );
    const encrypted = nip44.v2.encrypt(innerJson, conversationKey);

    const wrap: Partial<NostrEvent> = {
        kind: NIP_AC_GIFT_WRAP_KIND,
        pubkey: ephemeralPub,
        // Use the current Unix timestamp (NOT randomized into the past).
        // NIP-59 recommends randomizing kind-1059 wrap created_at up to 2
        // days in the past as a metadata-leak hardening. That treatment is
        // wrong for kind-21059 because relays apply ephemeral-event
        // freshness checks and will reject anything more than a few
        // seconds in the past with "invalid: ephemeral event expired".
        // The wrap's own pubkey is already a fresh ephemeral key (so the
        // sender is anonymous to relay operators) and the inner event's
        // own `created_at` is what receivers staleness-check against.
        created_at: Math.floor(Date.now() / 1000),
        content: encrypted,
        tags: [['p', recipientPubkey]]
    };

    // Strip generic-typed `sig` from the partial union before passing to
    // finalizeEvent (which signs and produces a fully-typed NostrEvent).
    return finalizeEvent(wrap as Parameters<typeof finalizeEvent>[0], ephemeralPriv);
}

/**
 * Decrypt and verify a NIP-AC kind-21059 gift wrap. Returns the signed
 * inner event on success, or `null` if decryption, JSON parsing, basic
 * shape validation, or signature verification fails. Callers MUST still
 * apply staleness, dedup, self-event-filter, and follow-gate checks
 * before dispatching.
 *
 * The `decryptFn` parameter takes the wrap's ephemeral pubkey and the
 * encrypted content and returns the plaintext inner JSON. Production
 * callers pass a thin wrapper around the user's NIP-44 signer; tests
 * can pass a deterministic decryptor.
 */
export async function unwrapNipAcGiftWrap(
    wrap: NostrEvent,
    decryptFn: (senderPubkey: string, content: string) => Promise<string>
): Promise<NostrEvent | null> {
    if (wrap.kind !== NIP_AC_GIFT_WRAP_KIND) {
        return null;
    }
    if (!wrap.content || typeof wrap.content !== 'string') {
        return null;
    }

    let innerJson: string;
    try {
        innerJson = await decryptFn(wrap.pubkey, wrap.content);
    } catch (err) {
        console.warn('[NIP-AC] unwrap: decrypt failed', err);
        return null;
    }

    let candidate: unknown;
    try {
        candidate = JSON.parse(innerJson);
    } catch (err) {
        console.warn('[NIP-AC] unwrap: JSON parse failed', err);
        return null;
    }

    if (!isPlainEventShape(candidate)) {
        console.warn('[NIP-AC] unwrap: inner is not a valid Nostr event shape');
        return null;
    }

    const inner = candidate as NostrEvent;

    if (!verifyEvent(inner)) {
        console.warn(
            '[NIP-AC] unwrap: inner event signature invalid; possible forgery'
        );
        return null;
    }

    return inner;
}

/**
 * Build the group-call tag suffix shared across NIP-AC senders. The
 * tag order ({@link GROUP_CALL_ID_TAG}, {@link CONVERSATION_ID_TAG},
 * {@link INITIATOR_TAG}, optionally {@link PARTICIPANTS_TAG},
 * optionally {@code ['role', ROLE_INVITE]}) is fixed by the wire-parity
 * fixture in {@code tests/fixtures/nip-ac-wire/inner-events.json}; both
 * this helper and the Java senders SHALL produce byte-equivalent inner
 * JSON.
 *
 * <p>Returns an empty array when {@code group} is undefined, so callers
 * can spread the result unconditionally.
 *
 * <p>{@code includeParticipants} controls whether the
 * `['participants', ...]` tag is emitted. Only kind-25050 (Call Offer)
 * carries the roster on the wire. {@code includeRoleInvite} controls
 * emission of the `['role', 'invite']` tag (also kind-25050 only,
 * present on invite-only offers where the recipient is the designated
 * SDP offerer for the pair).
 */
export function buildGroupExtraTags(
    group: NipAcGroupSendContext | undefined,
    opts?: { includeParticipants?: boolean; includeRoleInvite?: boolean }
): string[][] {
    if (!group) return [];
    const tags: string[][] = [
        [GROUP_CALL_ID_TAG, group.groupCallId],
        [CONVERSATION_ID_TAG, group.conversationId],
        [INITIATOR_TAG, group.initiatorHex]
    ];
    if (opts?.includeParticipants && group.participants && group.participants.length > 0) {
        tags.push([PARTICIPANTS_TAG, ...group.participants]);
    }
    if (opts?.includeRoleInvite && group.roleInvite) {
        tags.push([ROLE_TAG, ROLE_INVITE]);
    }
    return tags;
}

function isPlainEventShape(value: unknown): boolean {
    if (!value || typeof value !== 'object') return false;
    const v = value as Record<string, unknown>;
    return (
        typeof v.id === 'string' &&
        typeof v.pubkey === 'string' &&
        typeof v.kind === 'number' &&
        typeof v.created_at === 'number' &&
        typeof v.content === 'string' &&
        typeof v.sig === 'string' &&
        Array.isArray(v.tags)
    );
}
