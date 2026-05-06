// @vitest-environment jsdom
/**
 * Group voice-call state machine tests. Exercises the deterministic-pair
 * offerer rule, mesh-formation dispatch, busy rejection across calls,
 * authoritative-quadruple validation, last-one-standing finalization,
 * and multi-device dismissal keyed on `group-call-id`.
 *
 * Mocks `$lib/db/ConversationRepository` so the group follow-gate can
 * run against a deterministic local roster, and stubs the `currentUser`
 * store with a fixed self pubkey so the lex-rule branches are
 * predictable per case.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import { nip19, type NostrEvent } from 'nostr-tools';

// --- Self / roster fixtures (must be hoisted because vi.mock factories ---
// are evaluated before any top-level test-file code).
const {
    SELF_HEX,
    SELF_NPUB,
    A_HEX,
    A_NPUB,
    B_HEX,
    B_NPUB,
    C_HEX,
    C_NPUB,
    LO_HEX,
    LO_NPUB,
    CONV_ID,
    GROUP_CALL_ID
} = vi.hoisted(() => {
    const { nip19 } = require('nostr-tools');
    const SELF_HEX =
        '1111111111111111111111111111111111111111111111111111111111111111';
    const A_HEX =
        '3333333333333333333333333333333333333333333333333333333333333333';
    const B_HEX =
        '4444444444444444444444444444444444444444444444444444444444444444';
    const C_HEX =
        '5555555555555555555555555555555555555555555555555555555555555555';
    const LO_HEX =
        '0000000000000000000000000000000000000000000000000000000000000001';
    return {
        SELF_HEX,
        SELF_NPUB: nip19.npubEncode(SELF_HEX),
        A_HEX,
        A_NPUB: nip19.npubEncode(A_HEX),
        B_HEX,
        B_NPUB: nip19.npubEncode(B_HEX),
        C_HEX,
        C_NPUB: nip19.npubEncode(C_HEX),
        LO_HEX,
        LO_NPUB: nip19.npubEncode(LO_HEX),
        CONV_ID: '1234567890abcdef',
        GROUP_CALL_ID:
            '7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e'
    };
});

// --- Stores / DB mocks (declared BEFORE service import via vi.mock) -----
vi.mock('$lib/stores/auth', () => {
    const { writable } = require('svelte/store');
    return {
        signer: { subscribe: vi.fn() },
        currentUser: writable({ npub: SELF_NPUB })
    };
});

vi.mock('$lib/core/runtimeConfig/store', () => ({
    getIceServers: vi.fn().mockReturnValue([
        { urls: 'stun:turn.data.haus:3478' }
    ])
}));

const { conversationRepoMock } = vi.hoisted(() => ({
    conversationRepoMock: {
        getConversation: vi.fn()
    }
}));
vi.mock('$lib/db/ConversationRepository', () => ({
    conversationRepo: conversationRepoMock,
    isGroupConversationId: (id: string) => !id.startsWith('npub1'),
    deriveConversationId: () => CONV_ID,
    generateGroupTitle: (names: string[]) => names.join(', '),
    shouldReplaceConversationSubject: () => false,
    ConversationRepository: class {}
}));

// --- Service + store imports (after mocks) ------------------------------
import { VoiceCallService } from './VoiceCallService';
import {
    groupVoiceCallState,
    resetCall,
    resetGroupCall,
    setOutgoingRinging,
    voiceCallState
} from '$lib/stores/voiceCall';
import {
    NIP_AC_KIND_OFFER,
    NIP_AC_KIND_ANSWER,
    NIP_AC_KIND_HANGUP,
    NIP_AC_KIND_REJECT,
    GROUP_CALL_ID_TAG,
    CONVERSATION_ID_TAG,
    INITIATOR_TAG,
    PARTICIPANTS_TAG,
    ROLE_TAG,
    ROLE_INVITE
} from './constants';

function noopSenders() {
    return {
        sendOffer: vi.fn().mockResolvedValue(undefined),
        sendAnswer: vi.fn().mockResolvedValue(undefined),
        sendIceCandidate: vi.fn().mockResolvedValue(undefined),
        sendHangup: vi.fn().mockResolvedValue(undefined),
        sendReject: vi.fn().mockResolvedValue(undefined),
        sendRenegotiate: vi.fn().mockResolvedValue(undefined)
    };
}

function buildGroupInner(opts: {
    senderHex: string;
    kind: number;
    callId: string;
    groupCallId: string;
    conversationId?: string;
    initiatorHex?: string;
    participants?: string[];
    roleInvite?: boolean;
    content?: string;
    callType?: 'voice' | 'video';
    createdAt?: number;
}): NostrEvent {
    const tags: string[][] = [
        ['p', SELF_HEX],
        ['call-id', opts.callId],
        ['alt', 'group ' + opts.kind]
    ];
    if (opts.callType) tags.push(['call-type', opts.callType]);
    tags.push([GROUP_CALL_ID_TAG, opts.groupCallId]);
    tags.push([CONVERSATION_ID_TAG, opts.conversationId ?? CONV_ID]);
    tags.push([INITIATOR_TAG, opts.initiatorHex ?? opts.senderHex]);
    if (opts.participants) {
        tags.push([PARTICIPANTS_TAG, ...opts.participants]);
    }
    if (opts.roleInvite) {
        tags.push([ROLE_TAG, ROLE_INVITE]);
    }
    return {
        kind: opts.kind,
        pubkey: opts.senderHex,
        created_at: opts.createdAt ?? Math.floor(Date.now() / 1000),
        content: opts.content ?? '',
        tags,
        id: 'group-inner-' + opts.kind + '-' + opts.callId,
        sig: ''
    };
}

function installWebRtcStubs(): void {
    function MockRTCPeerConnection(this: any) {
        this.onicecandidate = null;
        this.ontrack = null;
        this.oniceconnectionstatechange = null;
        this.addTrack = vi.fn();
        this.setRemoteDescription = vi.fn().mockResolvedValue(undefined);
        this.setLocalDescription = vi.fn().mockResolvedValue(undefined);
        this.createOffer = vi
            .fn()
            .mockResolvedValue({ type: 'offer', sdp: 'sdp-offer' });
        this.createAnswer = vi
            .fn()
            .mockResolvedValue({ type: 'answer', sdp: 'sdp-answer' });
        this.addIceCandidate = vi.fn().mockResolvedValue(undefined);
        this.close = vi.fn();
        this.iceConnectionState = 'new';
    }
    (globalThis as any).RTCPeerConnection = MockRTCPeerConnection;
    (globalThis as any).RTCSessionDescription = function (init: any) {
        Object.assign(this, init);
    };
    (globalThis as any).RTCIceCandidate = function (init: any) {
        Object.assign(this, init);
    };
    const fakeStream = {
        getTracks: () => [{ stop: vi.fn(), enabled: true, kind: 'audio' }],
        getAudioTracks: () => [{ stop: vi.fn(), enabled: true, kind: 'audio' }]
    };
    (globalThis as any).navigator = {
        ...((globalThis as any).navigator ?? {}),
        mediaDevices: {
            getUserMedia: vi.fn().mockResolvedValue(fakeStream)
        }
    };
}

describe('Group voice-call state machine', () => {
    let service: VoiceCallService;

    beforeEach(() => {
        vi.clearAllMocks();
        resetCall();
        resetGroupCall();
        installWebRtcStubs();
        service = new VoiceCallService();
    });

    afterEach(() => {
        resetCall();
        resetGroupCall();
    });

    describe('initiateGroupCall', () => {
        it('emits exactly one offer per other roster member with full group context', async () => {
            conversationRepoMock.getConversation.mockResolvedValue({
                id: CONV_ID,
                isGroup: true,
                participants: [SELF_NPUB, A_NPUB, B_NPUB, C_NPUB]
            });
            const senders = noopSenders();
            service.registerNipAcSenders(senders);

            await service.initiateGroupCall(CONV_ID);

            expect(senders.sendOffer).toHaveBeenCalledTimes(3);
            for (const call of senders.sendOffer.mock.calls) {
                const [, , , opts] = call;
                expect(opts.callType).toEqual('voice');
                expect(opts.group.groupCallId).toBeDefined();
                expect(opts.group.conversationId).toEqual(CONV_ID);
                expect(opts.group.initiatorHex).toEqual(SELF_HEX);
                expect(opts.group.participants?.length).toEqual(4);
                expect(new Set(opts.group.participants)).toEqual(
                    new Set([SELF_HEX, A_HEX, B_HEX, C_HEX])
                );
            }

            const s = get(groupVoiceCallState);
            expect(s.status).toEqual('outgoing-ringing');
            expect(s.roster.length).toEqual(4);
            expect(Object.keys(s.participants).sort()).toEqual(
                [A_HEX, B_HEX, C_HEX].sort()
            );
        });

        it('refuses when roster size exceeds the cap', async () => {
            const D_HEX =
                '6666666666666666666666666666666666666666666666666666666666666666';
            const D_NPUB = nip19.npubEncode(D_HEX);
            conversationRepoMock.getConversation.mockResolvedValue({
                id: CONV_ID,
                isGroup: true,
                participants: [SELF_NPUB, A_NPUB, B_NPUB, C_NPUB, D_NPUB]
            });
            const senders = noopSenders();
            service.registerNipAcSenders(senders);

            await service.initiateGroupCall(CONV_ID);

            expect(senders.sendOffer).not.toHaveBeenCalled();
            expect(get(groupVoiceCallState).status).toEqual('idle');
        });

        it('refuses when the local user is not in the conversation', async () => {
            conversationRepoMock.getConversation.mockResolvedValue({
                id: CONV_ID,
                isGroup: true,
                participants: [A_NPUB, B_NPUB] // self missing
            });
            const senders = noopSenders();
            service.registerNipAcSenders(senders);

            await service.initiateGroupCall(CONV_ID);

            expect(senders.sendOffer).not.toHaveBeenCalled();
        });

        it('uses invite-only kind-25050 (empty content + role=invite) for edges where self is lex-higher', async () => {
            conversationRepoMock.getConversation.mockResolvedValue({
                id: CONV_ID,
                isGroup: true,
                participants: [SELF_NPUB, LO_NPUB]
            });
            const senders = noopSenders();
            service.registerNipAcSenders(senders);

            await service.initiateGroupCall(CONV_ID);

            expect(senders.sendOffer).toHaveBeenCalledTimes(1);
            const [recipientNpub, , content, opts] =
                senders.sendOffer.mock.calls[0];
            expect(recipientNpub).toEqual(LO_NPUB);
            expect(content).toEqual(''); // invite-only has empty SDP
            expect(opts.group.roleInvite).toBe(true);
        });
    });

    describe('inbound group offer (mesh formation)', () => {
        beforeEach(() => {
            // For receive-side tests we need the local DB to validate
            // the wire roster against the local conversation membership.
            conversationRepoMock.getConversation.mockResolvedValue({
                id: CONV_ID,
                isGroup: true,
                participants: [SELF_NPUB, A_NPUB, B_NPUB, C_NPUB]
            });
        });

        it('seeds incoming-ringing on the first inbound real-SDP group offer', async () => {
            const senders = noopSenders();
            service.registerNipAcSenders(senders);
            const inner = buildGroupInner({
                senderHex: A_HEX,
                kind: NIP_AC_KIND_OFFER,
                callId: 'pair-a',
                groupCallId: GROUP_CALL_ID,
                participants: [SELF_HEX, A_HEX, B_HEX, C_HEX],
                content: 'sdp-from-A',
                callType: 'voice'
            });
            await service.handleNipAcEvent(inner);

            const s = get(groupVoiceCallState);
            expect(s.status).toEqual('incoming-ringing');
            expect(s.groupCallId).toEqual(GROUP_CALL_ID);
            expect(s.initiatorHex).toEqual(A_HEX);
            // Sender's participant entry exists.
            expect(s.participants[A_HEX]).toBeDefined();
            expect(s.participants[A_HEX].callId).toEqual('pair-a');
            // The lex-test for role-seed uses content=='' as the
            // discriminator: real SDP → answerer.
            expect(s.participants[A_HEX].role).toEqual('answerer');
        });

        it('drops a group offer with mismatched roster set (anti-impersonation)', async () => {
            const senders = noopSenders();
            service.registerNipAcSenders(senders);
            const inner = buildGroupInner({
                senderHex: A_HEX,
                kind: NIP_AC_KIND_OFFER,
                callId: 'pair-a',
                groupCallId: GROUP_CALL_ID,
                participants: [SELF_HEX, A_HEX, B_HEX, LO_HEX], // LO not in local
                content: 'sdp-from-A',
                callType: 'voice'
            });
            await service.handleNipAcEvent(inner);

            expect(get(groupVoiceCallState).status).toEqual('idle');
            expect(senders.sendReject).not.toHaveBeenCalled();
        });

        it('drops a group offer whose video call-type is set (group video unsupported in v1)', async () => {
            const senders = noopSenders();
            service.registerNipAcSenders(senders);
            const inner = buildGroupInner({
                senderHex: A_HEX,
                kind: NIP_AC_KIND_OFFER,
                callId: 'pair-a',
                groupCallId: GROUP_CALL_ID,
                participants: [SELF_HEX, A_HEX, B_HEX, C_HEX],
                content: 'sdp-from-A',
                callType: 'video'
            });
            await service.handleNipAcEvent(inner);

            expect(get(groupVoiceCallState).status).toEqual('idle');
            expect(senders.sendReject).not.toHaveBeenCalled();
        });

        it('busy-rejects a group offer with a different group-call-id while another group call is active', async () => {
            const senders = noopSenders();
            service.registerNipAcSenders(senders);

            // Seed first call as incoming-ringing.
            const firstOffer = buildGroupInner({
                senderHex: A_HEX,
                kind: NIP_AC_KIND_OFFER,
                callId: 'pair-a',
                groupCallId: GROUP_CALL_ID,
                participants: [SELF_HEX, A_HEX, B_HEX, C_HEX],
                content: 'sdp-from-A',
                callType: 'voice'
            });
            await service.handleNipAcEvent(firstOffer);
            expect(get(groupVoiceCallState).status).toEqual('incoming-ringing');

            const otherGroupCallId =
                '8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e';
            const conflictingOffer = buildGroupInner({
                senderHex: B_HEX,
                kind: NIP_AC_KIND_OFFER,
                callId: 'pair-b-other',
                groupCallId: otherGroupCallId,
                participants: [SELF_HEX, A_HEX, B_HEX, C_HEX],
                content: 'sdp-from-B-other',
                callType: 'voice'
            });
            await service.handleNipAcEvent(conflictingOffer);

            expect(senders.sendReject).toHaveBeenCalledTimes(1);
            const [, , reason, opts] = senders.sendReject.mock.calls[0];
            expect(reason).toEqual('busy');
            expect(opts.group.groupCallId).toEqual(otherGroupCallId);
        });

        it('busy-rejects a 1-on-1 offer received while in a group call', async () => {
            const senders = noopSenders();
            service.registerNipAcSenders(senders);

            // Put us in a group incoming-ringing.
            await service.handleNipAcEvent(buildGroupInner({
                senderHex: A_HEX,
                kind: NIP_AC_KIND_OFFER,
                callId: 'pair-a',
                groupCallId: GROUP_CALL_ID,
                participants: [SELF_HEX, A_HEX, B_HEX, C_HEX],
                content: 'sdp-from-A',
                callType: 'voice'
            }));

            // Inbound 1-on-1 offer (no group-call-id) from A.
            const inner1to1: NostrEvent = {
                kind: NIP_AC_KIND_OFFER,
                pubkey: A_HEX,
                created_at: Math.floor(Date.now() / 1000),
                content: 'sdp-1on1',
                tags: [
                    ['p', SELF_HEX],
                    ['call-id', 'cid-1on1'],
                    ['alt', '1-on-1 offer'],
                    ['call-type', 'voice']
                ],
                id: 'inner-1on1',
                sig: ''
            };
            await service.handleNipAcEvent(inner1to1);

            expect(senders.sendReject).toHaveBeenCalledTimes(1);
            const [recipient, callId, reason] =
                senders.sendReject.mock.calls[0];
            expect(recipient).toEqual(A_NPUB);
            expect(callId).toEqual('cid-1on1');
            expect(reason).toEqual('busy');
        });

        it('caches authoritative quadruple from first kind-25050 and drops disagreeing later events', async () => {
            const senders = noopSenders();
            service.registerNipAcSenders(senders);

            // First offer: A is initiator (which is also the implicit
            // initiator in our build helper when initiatorHex omitted).
            await service.handleNipAcEvent(
                buildGroupInner({
                    senderHex: A_HEX,
                    kind: NIP_AC_KIND_OFFER,
                    callId: 'pair-a',
                    groupCallId: GROUP_CALL_ID,
                    initiatorHex: A_HEX,
                    participants: [SELF_HEX, A_HEX, B_HEX, C_HEX],
                    content: 'sdp-from-A'
                })
            );
            expect(get(groupVoiceCallState).status).toEqual(
                'incoming-ringing'
            );

            // Disagreement on initiator → drop.
            const disagree = buildGroupInner({
                senderHex: B_HEX,
                kind: NIP_AC_KIND_ANSWER,
                callId: 'pair-a',
                groupCallId: GROUP_CALL_ID,
                initiatorHex: B_HEX, // disagrees with cached quad
                content: 'sdp-disagree'
            });
            await service.handleNipAcEvent(disagree);

            // No participant for B_HEX should have been added; B was not
            // a sender in the first offer.
            expect(
                get(groupVoiceCallState).participants[B_HEX]
            ).toBeUndefined();
        });
    });

    describe('multi-device dismissal keyed on group-call-id', () => {
        beforeEach(() => {
            conversationRepoMock.getConversation.mockResolvedValue({
                id: CONV_ID,
                isGroup: true,
                participants: [SELF_NPUB, A_NPUB, B_NPUB]
            });
        });

        it('self kind-25051 with matching group-call-id transitions to answered-elsewhere', async () => {
            const senders = noopSenders();
            service.registerNipAcSenders(senders);

            await service.handleNipAcEvent(
                buildGroupInner({
                    senderHex: A_HEX,
                    kind: NIP_AC_KIND_OFFER,
                    callId: 'pair-a',
                    groupCallId: GROUP_CALL_ID,
                    initiatorHex: A_HEX,
                    participants: [SELF_HEX, A_HEX, B_HEX],
                    content: 'sdp-from-A'
                })
            );

            // Self kind-25051 (event from our own pubkey, simulated via
            // handleSelfAnswer entry point used by Messaging.ts).
            const selfAnswer: NostrEvent = {
                kind: NIP_AC_KIND_ANSWER,
                pubkey: SELF_HEX,
                created_at: Math.floor(Date.now() / 1000),
                content: 'sdp-self-ans',
                tags: [
                    ['p', SELF_HEX],
                    ['call-id', 'pair-a'],
                    ['alt', 'self answer'],
                    [GROUP_CALL_ID_TAG, GROUP_CALL_ID],
                    [CONVERSATION_ID_TAG, CONV_ID],
                    [INITIATOR_TAG, A_HEX]
                ],
                id: 'self-ans',
                sig: ''
            };
            await service.handleSelfAnswer(selfAnswer);

            const s = get(groupVoiceCallState);
            expect(s.status).toEqual('ended');
            expect(s.endReason).toEqual('answered-elsewhere');
        });

        it('self kind-25054 with matching group-call-id transitions to rejected-elsewhere', async () => {
            const senders = noopSenders();
            service.registerNipAcSenders(senders);

            await service.handleNipAcEvent(
                buildGroupInner({
                    senderHex: A_HEX,
                    kind: NIP_AC_KIND_OFFER,
                    callId: 'pair-a',
                    groupCallId: GROUP_CALL_ID,
                    initiatorHex: A_HEX,
                    participants: [SELF_HEX, A_HEX, B_HEX],
                    content: 'sdp-from-A'
                })
            );

            const selfReject: NostrEvent = {
                kind: NIP_AC_KIND_REJECT,
                pubkey: SELF_HEX,
                created_at: Math.floor(Date.now() / 1000),
                content: '',
                tags: [
                    ['p', SELF_HEX],
                    ['call-id', 'pair-a'],
                    ['alt', 'self reject'],
                    [GROUP_CALL_ID_TAG, GROUP_CALL_ID],
                    [CONVERSATION_ID_TAG, CONV_ID],
                    [INITIATOR_TAG, A_HEX]
                ],
                id: 'self-rej',
                sig: ''
            };
            await service.handleSelfReject(selfReject);

            expect(get(groupVoiceCallState).endReason).toEqual(
                'rejected-elsewhere'
            );
        });
    });

    describe('hangup leaves remaining peers undisturbed locally', () => {
        beforeEach(() => {
            conversationRepoMock.getConversation.mockResolvedValue({
                id: CONV_ID,
                isGroup: true,
                participants: [SELF_NPUB, A_NPUB, B_NPUB]
            });
        });

        it('sends a kind-25053 to every still-live peer and ends the local call', async () => {
            const senders = noopSenders();
            service.registerNipAcSenders(senders);
            await service.initiateGroupCall(CONV_ID);
            // Now we should have 2 participants (A, B) in `ringing`.
            expect(
                Object.keys(get(groupVoiceCallState).participants).length
            ).toEqual(2);

            service.hangupGroupCall();

            expect(senders.sendHangup).toHaveBeenCalledTimes(2);
            for (const call of senders.sendHangup.mock.calls) {
                const opts = call[3];
                expect(opts.group.groupCallId).toBeDefined();
                expect(opts.group.conversationId).toEqual(CONV_ID);
            }
            expect(get(groupVoiceCallState).status).toEqual('ended');
            expect(get(groupVoiceCallState).endReason).toEqual('hangup');
        });
    });
});
