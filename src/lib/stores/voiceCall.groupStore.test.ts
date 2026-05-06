/**
 * Unit tests for the group voice-call Svelte store and its pure
 * mutators. Pinning of the aggregate-status derivation rule and the
 * idempotent upsert/replace semantics that the state machine in
 * {@code VoiceCallService.ts} depends on.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import {
    deriveGroupStatus,
    endGroupCall,
    groupVoiceCallState,
    incrementGroupDuration,
    resetGroupCall,
    setGroupConnecting,
    setGroupEndedAnsweredElsewhere,
    setGroupEndedRejectedElsewhere,
    setGroupIncomingRinging,
    setGroupOutgoingRinging,
    setGroupParticipantStatus,
    toggleGroupMute,
    toggleGroupSpeaker,
    upsertGroupParticipant
} from './voiceCall';
import type { ParticipantState } from '$lib/core/voiceCall/types';

const G = '7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e';
const C = '1234567890abcdef';
const I = '1111111111111111111111111111111111111111111111111111111111111111';
const A = '3333333333333333333333333333333333333333333333333333333333333333';
const B = '4444444444444444444444444444444444444444444444444444444444444444';
const D = '5555555555555555555555555555555555555555555555555555555555555555';

function buildParticipants(
    entries: Array<Partial<ParticipantState> & { pubkeyHex: string }>
): Record<string, ParticipantState> {
    const map: Record<string, ParticipantState> = {};
    for (const e of entries) {
        map[e.pubkeyHex] = {
            pubkeyHex: e.pubkeyHex,
            callId: e.callId ?? 'cid-' + e.pubkeyHex.slice(0, 4),
            role: e.role ?? 'offerer',
            pcStatus: e.pcStatus ?? 'pending',
            endReason: e.endReason ?? null
        };
    }
    return map;
}

describe('deriveGroupStatus', () => {
    it("returns the fallback when there are no participants", () => {
        expect(deriveGroupStatus({}, 'idle')).toEqual('idle');
        expect(deriveGroupStatus({}, 'outgoing-ringing')).toEqual(
            'outgoing-ringing'
        );
    });

    it("returns 'active' when at least one participant is active", () => {
        const map = buildParticipants([
            { pubkeyHex: A, pcStatus: 'connecting' },
            { pubkeyHex: B, pcStatus: 'active' },
            { pubkeyHex: D, pcStatus: 'ringing' }
        ]);
        expect(deriveGroupStatus(map, 'incoming-ringing')).toEqual('active');
    });

    it("returns 'connecting' when at least one is connecting and none active", () => {
        const map = buildParticipants([
            { pubkeyHex: A, pcStatus: 'ringing' },
            { pubkeyHex: B, pcStatus: 'connecting' }
        ]);
        expect(deriveGroupStatus(map, 'outgoing-ringing')).toEqual('connecting');
    });

    it("returns 'ended' only when EVERY participant is ended (last-one-standing)", () => {
        const allEnded = buildParticipants([
            { pubkeyHex: A, pcStatus: 'ended' },
            { pubkeyHex: B, pcStatus: 'ended' }
        ]);
        expect(deriveGroupStatus(allEnded, 'active')).toEqual('ended');

        const someStillActive = buildParticipants([
            { pubkeyHex: A, pcStatus: 'ended' },
            { pubkeyHex: B, pcStatus: 'active' }
        ]);
        expect(deriveGroupStatus(someStillActive, 'active')).toEqual('active');
    });

    it("falls back when only ringing/pending participants exist", () => {
        const map = buildParticipants([
            { pubkeyHex: A, pcStatus: 'ringing' },
            { pubkeyHex: B, pcStatus: 'pending' }
        ]);
        expect(deriveGroupStatus(map, 'outgoing-ringing')).toEqual(
            'outgoing-ringing'
        );
        expect(deriveGroupStatus(map, 'incoming-ringing')).toEqual(
            'incoming-ringing'
        );
    });
});

describe('group store mutators', () => {
    beforeEach(() => {
        resetGroupCall();
    });

    it('seeds outgoing ringing with the full roster and participant entries', () => {
        setGroupOutgoingRinging(G, C, I, [I, A, B, D], [
            { pubkeyHex: A, callId: 'p-a', role: 'offerer', pcStatus: 'ringing' },
            { pubkeyHex: B, callId: 'p-b', role: 'answerer', pcStatus: 'pending' },
            { pubkeyHex: D, callId: 'p-d', role: 'offerer', pcStatus: 'ringing' }
        ]);
        const s = get(groupVoiceCallState);
        expect(s.groupCallId).toEqual(G);
        expect(s.conversationId).toEqual(C);
        expect(s.initiatorHex).toEqual(I);
        expect(s.roster).toEqual([I, A, B, D]);
        expect(Object.keys(s.participants).sort()).toEqual([A, B, D].sort());
        expect(s.status).toEqual('outgoing-ringing');
        expect(s.endReason).toBeNull();
        expect(s.duration).toEqual(0);
    });

    it('seeds incoming ringing with only the offerer entry', () => {
        setGroupIncomingRinging(G, C, I, [I, A, B, D], {
            pubkeyHex: I,
            callId: 'p-i',
            role: 'offerer',
            pcStatus: 'ringing'
        });
        const s = get(groupVoiceCallState);
        expect(s.status).toEqual('incoming-ringing');
        expect(Object.keys(s.participants)).toEqual([I]);
        expect(s.participants[I].role).toEqual('offerer');
    });

    it('upsertGroupParticipant adds a missing entry without changing existing entries', () => {
        setGroupIncomingRinging(G, C, I, [I, A, B], {
            pubkeyHex: I,
            callId: 'p-i',
            role: 'offerer',
            pcStatus: 'ringing'
        });
        upsertGroupParticipant(A, {
            callId: 'p-a',
            role: 'offerer',
            pcStatus: 'pending'
        });
        const s = get(groupVoiceCallState);
        expect(s.participants[I].callId).toEqual('p-i');
        expect(s.participants[A].callId).toEqual('p-a');
        expect(s.participants[A].pcStatus).toEqual('pending');
    });

    it('setGroupParticipantStatus re-derives aggregate status', () => {
        setGroupOutgoingRinging(G, C, I, [I, A, B], [
            { pubkeyHex: A, callId: 'p-a', role: 'offerer', pcStatus: 'ringing' },
            { pubkeyHex: B, callId: 'p-b', role: 'offerer', pcStatus: 'ringing' }
        ]);
        // Move A to active → aggregate flips to active.
        setGroupParticipantStatus(A, 'active');
        expect(get(groupVoiceCallState).status).toEqual('active');
        // End A; B still active? B never moved to active; aggregate now derives
        // from {A: ended, B: ringing} → fallback (which is the current status,
        // 'active' from above) — but our derivation rule treats partial-ended +
        // ringing as 'connecting' if any connecting, otherwise the fallback.
        setGroupParticipantStatus(A, 'ended', 'hangup');
        // B is 'ringing', no participant is 'active' or 'connecting', so the
        // fallback is preserved (status stays 'active' from before — last one
        // active or not, the derivation falls through to the prev fallback).
        // Now end B too:
        setGroupParticipantStatus(B, 'ended', 'timeout');
        expect(get(groupVoiceCallState).status).toEqual('ended');
    });

    it('setGroupParticipantStatus is a no-op for unknown participant pubkeys', () => {
        setGroupOutgoingRinging(G, C, I, [I, A], [
            { pubkeyHex: A, callId: 'p-a', role: 'offerer', pcStatus: 'ringing' }
        ]);
        const before = get(groupVoiceCallState);
        setGroupParticipantStatus(D, 'active'); // D is not in participants
        const after = get(groupVoiceCallState);
        expect(after).toEqual(before);
    });

    it('endGroupCall preserves participants for the Ended display window', () => {
        setGroupOutgoingRinging(G, C, I, [I, A, B], [
            { pubkeyHex: A, callId: 'p-a', role: 'offerer', pcStatus: 'active' },
            { pubkeyHex: B, callId: 'p-b', role: 'offerer', pcStatus: 'active' }
        ]);
        endGroupCall('hangup');
        const s = get(groupVoiceCallState);
        expect(s.status).toEqual('ended');
        expect(s.endReason).toEqual('hangup');
        expect(Object.keys(s.participants).length).toEqual(2);
    });

    it('setGroupEndedAnsweredElsewhere / RejectedElsewhere set the right reason', () => {
        setGroupIncomingRinging(G, C, I, [I, A], {
            pubkeyHex: I,
            callId: 'p-i',
            role: 'offerer',
            pcStatus: 'ringing'
        });
        setGroupEndedAnsweredElsewhere();
        expect(get(groupVoiceCallState).endReason).toEqual('answered-elsewhere');

        setGroupIncomingRinging(G, C, I, [I, A], {
            pubkeyHex: I,
            callId: 'p-i',
            role: 'offerer',
            pcStatus: 'ringing'
        });
        setGroupEndedRejectedElsewhere();
        expect(get(groupVoiceCallState).endReason).toEqual('rejected-elsewhere');
    });

    it('setGroupConnecting forces aggregate to connecting', () => {
        setGroupIncomingRinging(G, C, I, [I, A], {
            pubkeyHex: I,
            callId: 'p-i',
            role: 'offerer',
            pcStatus: 'ringing'
        });
        setGroupConnecting();
        expect(get(groupVoiceCallState).status).toEqual('connecting');
    });

    it('toggleGroupMute / toggleGroupSpeaker / incrementGroupDuration are pure flips', () => {
        setGroupOutgoingRinging(G, C, I, [I, A], [
            { pubkeyHex: A, callId: 'p-a', role: 'offerer', pcStatus: 'active' }
        ]);
        toggleGroupMute();
        expect(get(groupVoiceCallState).isMuted).toEqual(true);
        toggleGroupMute();
        expect(get(groupVoiceCallState).isMuted).toEqual(false);
        toggleGroupSpeaker();
        expect(get(groupVoiceCallState).isSpeakerOn).toEqual(true);
        incrementGroupDuration();
        incrementGroupDuration();
        expect(get(groupVoiceCallState).duration).toEqual(2);
    });

    it('resetGroupCall clears all fields back to idle', () => {
        setGroupOutgoingRinging(G, C, I, [I, A, B], [
            { pubkeyHex: A, callId: 'p-a', role: 'offerer', pcStatus: 'active' },
            { pubkeyHex: B, callId: 'p-b', role: 'offerer', pcStatus: 'connecting' }
        ]);
        endGroupCall('hangup');
        resetGroupCall();
        const s = get(groupVoiceCallState);
        expect(s.groupCallId).toBeNull();
        expect(s.conversationId).toBeNull();
        expect(s.initiatorHex).toBeNull();
        expect(s.roster).toEqual([]);
        expect(s.participants).toEqual({});
        expect(s.status).toEqual('idle');
        expect(s.endReason).toBeNull();
        expect(s.duration).toEqual(0);
    });
});
