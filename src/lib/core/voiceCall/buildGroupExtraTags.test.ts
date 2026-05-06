/**
 * Unit tests for {@link buildGroupExtraTags}, the shared helper that
 * builds the group-call tag suffix for NIP-AC inner events. Tag order
 * is fixed by the wire-parity fixture in
 * `tests/fixtures/nip-ac-wire/inner-events.json`; if these tests fail,
 * the JS-side senders have drifted from the fixture and the Java-side
 * `NativeNipAcSenderTest` will also fail once the Android senders are
 * updated.
 *
 * The fixture itself is exercised end-to-end by
 * {@link wireParity.test.ts}, which covers the *full* tag list
 * (including the base `[p, call-id, alt]` prefix and any `call-type`).
 * This file pins the *suffix* alone so a regression in the helper —
 * not in the senders — surfaces immediately with a focused failure.
 */
import { describe, expect, it } from 'vitest';
import { buildGroupExtraTags } from './nipAcGiftWrap';
import type { NipAcGroupSendContext } from './types';

const groupCallId =
    '7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e';
const conversationId = '1234567890abcdef';
const initiatorHex =
    '1111111111111111111111111111111111111111111111111111111111111111';
const peerB =
    '3333333333333333333333333333333333333333333333333333333333333333';
const peerC =
    '4444444444444444444444444444444444444444444444444444444444444444';
const peerD =
    '5555555555555555555555555555555555555555555555555555555555555555';
const roster = [initiatorHex, peerB, peerC, peerD];

const baseGroup: NipAcGroupSendContext = {
    groupCallId,
    conversationId,
    initiatorHex
};

describe('buildGroupExtraTags', () => {
    it('returns an empty array when group is undefined', () => {
        expect(buildGroupExtraTags(undefined)).toEqual([]);
        expect(
            buildGroupExtraTags(undefined, {
                includeParticipants: true,
                includeRoleInvite: true
            })
        ).toEqual([]);
    });

    it('emits the three base tags in fixed order for non-offer kinds', () => {
        const tags = buildGroupExtraTags(baseGroup);
        expect(tags).toEqual([
            ['group-call-id', groupCallId],
            ['conversation-id', conversationId],
            ['initiator', initiatorHex]
        ]);
    });

    it('omits the participants tag when includeParticipants is false', () => {
        const tags = buildGroupExtraTags(
            { ...baseGroup, participants: roster },
            { includeParticipants: false }
        );
        expect(tags.find((t) => t[0] === 'participants')).toBeUndefined();
    });

    it('emits the participants tag (one tag with N+1 entries) when requested', () => {
        const tags = buildGroupExtraTags(
            { ...baseGroup, participants: roster },
            { includeParticipants: true }
        );
        expect(tags).toEqual([
            ['group-call-id', groupCallId],
            ['conversation-id', conversationId],
            ['initiator', initiatorHex],
            ['participants', initiatorHex, peerB, peerC, peerD]
        ]);
    });

    it('skips the participants tag when participants is empty', () => {
        const tags = buildGroupExtraTags(
            { ...baseGroup, participants: [] },
            { includeParticipants: true }
        );
        expect(tags.find((t) => t[0] === 'participants')).toBeUndefined();
    });

    it('emits role=invite at the end on invite-only offers', () => {
        const tags = buildGroupExtraTags(
            { ...baseGroup, participants: roster, roleInvite: true },
            { includeParticipants: true, includeRoleInvite: true }
        );
        expect(tags).toEqual([
            ['group-call-id', groupCallId],
            ['conversation-id', conversationId],
            ['initiator', initiatorHex],
            ['participants', initiatorHex, peerB, peerC, peerD],
            ['role', 'invite']
        ]);
    });

    it('does not emit role=invite when includeRoleInvite is false', () => {
        const tags = buildGroupExtraTags(
            { ...baseGroup, roleInvite: true },
            { includeRoleInvite: false }
        );
        expect(tags.find((t) => t[0] === 'role')).toBeUndefined();
    });

    it('does not emit role=invite when group.roleInvite is unset, even if includeRoleInvite=true', () => {
        const tags = buildGroupExtraTags(baseGroup, {
            includeRoleInvite: true
        });
        expect(tags.find((t) => t[0] === 'role')).toBeUndefined();
    });
});
