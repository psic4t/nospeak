// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NostrEvent } from 'nostr-tools';
import { nip19 } from 'nostr-tools';

vi.mock('$lib/stores/auth', () => ({
    signer: { subscribe: vi.fn() },
    currentUser: { subscribe: vi.fn() }
}));

vi.mock('$lib/core/runtimeConfig/store', () => ({
    getIceServers: vi.fn().mockReturnValue([
        { urls: 'stun:turn.data.haus:3478' }
    ])
}));

const startCallSessionSpy = vi.fn().mockResolvedValue(undefined);
const endCallSessionSpy = vi.fn().mockResolvedValue(undefined);
const dismissIncomingCallSpy = vi.fn().mockResolvedValue(undefined);

vi.mock('$lib/core/voiceCall/androidVoiceCallPlugin', () => ({
    AndroidVoiceCall: {
        startCallSession: (opts: any) => startCallSessionSpy(opts),
        endCallSession: () => endCallSessionSpy(),
        dismissIncomingCall: (opts: any) => dismissIncomingCallSpy(opts),
        getPendingIncomingCall: vi.fn().mockResolvedValue({ pending: null }),
        clearPendingIncomingCall: vi.fn().mockResolvedValue(undefined),
        canUseFullScreenIntent: vi.fn().mockResolvedValue({ granted: true }),
        requestFullScreenIntentPermission: vi.fn().mockResolvedValue(undefined),
        addListener: vi.fn().mockResolvedValue({ remove: () => {} })
    }
}));

vi.mock('@capacitor/core', async (importOriginal) => {
    const actual = (await importOriginal()) as any;
    return {
        ...actual,
        Capacitor: {
            ...actual.Capacitor,
            getPlatform: vi.fn().mockReturnValue('android')
        }
    };
});

import { VoiceCallService, type NipAcSenders } from './VoiceCallService';
import {
    resetCall,
    setIncomingRinging,
    setActive as storeSetActive,
    incrementDuration,
    voiceCallState
} from '$lib/stores/voiceCall';
import {
    NIP_AC_KIND_OFFER,
    NIP_AC_KIND_ANSWER,
    NIP_AC_KIND_HANGUP,
    NIP_AC_KIND_REJECT
} from './constants';
import { get } from 'svelte/store';

const PEER_HEX = 'a'.repeat(64);
const PEER_NPUB = nip19.npubEncode(PEER_HEX);

function noopSenders(): NipAcSenders {
    return {
        sendOffer: vi.fn().mockResolvedValue(undefined),
        sendAnswer: vi.fn().mockResolvedValue(undefined),
        sendIceCandidate: vi.fn().mockResolvedValue(undefined),
        sendHangup: vi.fn().mockResolvedValue(undefined),
        sendReject: vi.fn().mockResolvedValue(undefined)
    };
}

function buildInner(opts: {
    senderHex: string;
    kind: number;
    callId: string;
    content?: string;
    callType?: 'voice' | 'video';
    extraTags?: string[][];
    createdAt?: number;
}): NostrEvent {
    const tags: string[][] = [
        ['call-id', opts.callId],
        ['alt', 'WebRTC ' + opts.kind]
    ];
    if (opts.callType) tags.push(['call-type', opts.callType]);
    if (opts.extraTags) tags.push(...opts.extraTags);
    return {
        kind: opts.kind,
        pubkey: opts.senderHex,
        created_at: opts.createdAt ?? Math.floor(Date.now() / 1000),
        content: opts.content ?? '',
        tags,
        id: 'inner-' + opts.kind + '-' + opts.callId,
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
        this.createOffer = vi.fn().mockResolvedValue({ type: 'offer', sdp: 'sdp-offer' });
        this.createAnswer = vi.fn().mockResolvedValue({ type: 'answer', sdp: 'sdp-answer' });
        this.addIceCandidate = vi.fn().mockResolvedValue(undefined);
        this.close = vi.fn();
        this.iceConnectionState = 'new';
        (globalThis as any).__lastPeerConnection = this;
    }
    (globalThis as any).RTCPeerConnection = MockRTCPeerConnection;
    (globalThis as any).RTCSessionDescription = function (init: any) {
        Object.assign(this, init);
    };
    (globalThis as any).RTCIceCandidate = function (init: any) {
        Object.assign(this, init);
    };
    const fakeStream = {
        getTracks: () => [{ stop: vi.fn(), enabled: true }],
        getAudioTracks: () => [{ stop: vi.fn(), enabled: true }]
    };
    (globalThis as any).navigator = {
        ...((globalThis as any).navigator ?? {}),
        mediaDevices: {
            getUserMedia: vi.fn().mockResolvedValue(fakeStream)
        }
    };
}

describe('VoiceCallService', () => {
    let service: VoiceCallService;

    beforeEach(() => {
        vi.clearAllMocks();
        resetCall();
        installWebRtcStubs();
        service = new VoiceCallService();
    });

    afterEach(() => {
        resetCall();
    });

    describe('generateCallId', () => {
        it('returns a 32-hex string', () => {
            const id = service.generateCallId();
            expect(id).toMatch(/^[0-9a-f]{32}$/);
        });

        it('returns unique values', () => {
            expect(service.generateCallId()).not.toBe(service.generateCallId());
        });
    });

    describe('handleOffer dedup', () => {
        it('S22-like: ignores a duplicate offer for the same call-id and same sender', async () => {
            setIncomingRinging(PEER_NPUB, 'call-1');
            const senders = noopSenders();
            service.registerNipAcSenders(senders);

            const offer = buildInner({
                senderHex: PEER_HEX,
                kind: NIP_AC_KIND_OFFER,
                callId: 'call-1',
                content: 'sdp',
                callType: 'voice'
            });
            await service.handleNipAcEvent(offer);

            // No busy reject sent — duplicate is silently dropped.
            expect(senders.sendReject).not.toHaveBeenCalled();
        });

        it('S11: sends Call Reject with content "busy" when a different call arrives in incoming-ringing', async () => {
            setIncomingRinging(PEER_NPUB, 'call-existing');
            const senders = noopSenders();
            service.registerNipAcSenders(senders);

            const otherSenderHex = 'b'.repeat(64);
            const offer = buildInner({
                senderHex: otherSenderHex,
                kind: NIP_AC_KIND_OFFER,
                callId: 'call-different',
                content: 'sdp',
                callType: 'voice'
            });
            await service.handleNipAcEvent(offer);

            expect(senders.sendReject).toHaveBeenCalledTimes(1);
            const args = (senders.sendReject as any).mock.calls[0];
            expect(args[1]).toBe('call-different');
            expect(args[2]).toBe('busy');
        });
    });

    describe('Android session lifecycle', () => {
        it('startCallSession with role=outgoing on initiateCall', async () => {
            const senders = noopSenders();
            service.registerNipAcSenders(senders);

            await service.initiateCall(PEER_NPUB);

            expect(startCallSessionSpy).toHaveBeenCalledTimes(1);
            const args = startCallSessionSpy.mock.calls[0][0];
            expect(args.role).toBe('outgoing');
            expect(args.peerNpub).toBe(PEER_NPUB);
            expect(args.callId).toBeTruthy();
        });

        it('startCallSession with role=incoming on acceptCall', async () => {
            const senders = noopSenders();
            service.registerNipAcSenders(senders);

            const offer = buildInner({
                senderHex: PEER_HEX,
                kind: NIP_AC_KIND_OFFER,
                callId: 'inc-1',
                content: 'sdp',
                callType: 'voice'
            });
            await service.handleNipAcEvent(offer);
            startCallSessionSpy.mockClear();

            await service.acceptCall();

            expect(startCallSessionSpy).toHaveBeenCalledTimes(1);
            const args = startCallSessionSpy.mock.calls[0][0];
            expect(args.role).toBe('incoming');
            expect(args.callId).toBe('inc-1');
        });

        it('endCallSession invoked on hangup', async () => {
            const senders = noopSenders();
            service.registerNipAcSenders(senders);

            await service.initiateCall(PEER_NPUB);
            startCallSessionSpy.mockClear();
            endCallSessionSpy.mockClear();

            service.hangup();

            expect(endCallSessionSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe('ICE trickle gating', () => {
        it('forwards candidates while gathering before connection is established', async () => {
            const senders = noopSenders();
            service.registerNipAcSenders(senders);

            await service.initiateCall(PEER_NPUB);
            const pc = (globalThis as any).__lastPeerConnection;
            expect(pc.onicecandidate).toBeTypeOf('function');

            pc.onicecandidate({
                candidate: {
                    candidate: 'candidate:1 1 udp 1 1.1.1.1 1 typ host',
                    sdpMid: '0',
                    sdpMLineIndex: 0
                }
            });
            await Promise.resolve();
            // sendIceCandidate is fire-and-forget; one call is enough.
            expect(senders.sendIceCandidate).toHaveBeenCalledTimes(1);
        });

        it('stops forwarding once iceConnectionState is connected', async () => {
            const senders = noopSenders();
            service.registerNipAcSenders(senders);

            await service.initiateCall(PEER_NPUB);
            const pc = (globalThis as any).__lastPeerConnection;
            pc.onicecandidate({
                candidate: {
                    candidate: 'a',
                    sdpMid: '0',
                    sdpMLineIndex: 0
                }
            });
            await Promise.resolve();
            expect(senders.sendIceCandidate).toHaveBeenCalledTimes(1);

            pc.iceConnectionState = 'connected';
            pc.oniceconnectionstatechange();

            pc.onicecandidate({
                candidate: {
                    candidate: 'b',
                    sdpMid: '0',
                    sdpMLineIndex: 0
                }
            });
            await Promise.resolve();
            expect(senders.sendIceCandidate).toHaveBeenCalledTimes(1);
        });
    });

    describe('synchronous cancellation', () => {
        it('hangup during outgoing-ringing dismisses synchronously even if publish hangs', async () => {
            // Initial offer must publish; subsequent hangup publish hangs.
            let hangupHangs = false;
            const senders: NipAcSenders = {
                sendOffer: vi.fn().mockResolvedValue(undefined),
                sendAnswer: vi.fn().mockResolvedValue(undefined),
                sendIceCandidate: vi.fn().mockResolvedValue(undefined),
                sendHangup: vi.fn().mockImplementation(() => {
                    if (hangupHangs) return new Promise(() => {});
                    return Promise.resolve();
                }),
                sendReject: vi.fn().mockResolvedValue(undefined)
            };
            service.registerNipAcSenders(senders);

            await service.initiateCall(PEER_NPUB);
            expect(get(voiceCallState).status).toBe('outgoing-ringing');

            hangupHangs = true;
            service.hangup();
            expect(get(voiceCallState).status).toBe('ended');
            expect(get(voiceCallState).endReason).toBe('hangup');
            expect(senders.sendHangup).toHaveBeenCalledTimes(1);
        });

        it('declineCall during incoming-ringing dismisses synchronously', async () => {
            const hangingReject = vi
                .fn()
                .mockImplementation(() => new Promise(() => {}));
            service.registerNipAcSenders({
                sendOffer: vi.fn(),
                sendAnswer: vi.fn(),
                sendIceCandidate: vi.fn(),
                sendHangup: vi.fn(),
                sendReject: hangingReject
            });

            setIncomingRinging(PEER_NPUB, 'call-decline');

            service.declineCall();
            expect(get(voiceCallState).status).toBe('ended');
            expect(get(voiceCallState).endReason).toBe('rejected');
            expect(hangingReject).toHaveBeenCalledTimes(1);
        });
    });

    describe('call-event authoring per terminal transition', () => {
        it("authors 'cancelled' via local path when caller hangs up while outgoing-ringing", async () => {
            const createCallEventSpy = vi.fn().mockResolvedValue(undefined);
            const localCreateCallEventSpy = vi.fn().mockResolvedValue(undefined);
            service.registerNipAcSenders(noopSenders());
            service.registerCallEventCreator(createCallEventSpy);
            service.registerLocalCallEventCreator(localCreateCallEventSpy);

            await service.initiateCall(PEER_NPUB);
            const expectedCallId = get(voiceCallState).callId;

            service.hangup();

            expect(get(voiceCallState).status).toBe('ended');
            expect(localCreateCallEventSpy).toHaveBeenCalledTimes(1);
            const [recipient, type, callId] = localCreateCallEventSpy.mock.calls[0];
            expect(recipient).toBe(PEER_NPUB);
            expect(type).toBe('cancelled');
            expect(callId).toBe(expectedCallId);
            expect(createCallEventSpy).not.toHaveBeenCalled();
        });

        it("authors 'declined' via gift-wrapped path when user declines", async () => {
            const createCallEventSpy = vi.fn().mockResolvedValue(undefined);
            const localCreateCallEventSpy = vi.fn().mockResolvedValue(undefined);
            service.registerNipAcSenders(noopSenders());
            service.registerCallEventCreator(createCallEventSpy);
            service.registerLocalCallEventCreator(localCreateCallEventSpy);

            setIncomingRinging(PEER_NPUB, 'call-decline-1');
            service.declineCall();

            expect(createCallEventSpy).toHaveBeenCalledTimes(1);
            const [recipient, type, duration, callId, initiatorNpub] =
                createCallEventSpy.mock.calls[0];
            expect(recipient).toBe(PEER_NPUB);
            expect(type).toBe('declined');
            expect(duration).toBeUndefined();
            expect(callId).toBe('call-decline-1');
            expect(initiatorNpub).toBe(PEER_NPUB);
            expect(localCreateCallEventSpy).not.toHaveBeenCalled();
        });

        it('caller authors NOTHING when receiving Call Reject (callee owns the rumor)', async () => {
            const createCallEventSpy = vi.fn().mockResolvedValue(undefined);
            const localCreateCallEventSpy = vi.fn().mockResolvedValue(undefined);
            service.registerNipAcSenders(noopSenders());
            service.registerCallEventCreator(createCallEventSpy);
            service.registerLocalCallEventCreator(localCreateCallEventSpy);

            await service.initiateCall(PEER_NPUB);
            const callId = get(voiceCallState).callId!;
            createCallEventSpy.mockClear();

            const reject = buildInner({
                senderHex: PEER_HEX,
                kind: NIP_AC_KIND_REJECT,
                callId,
                content: ''
            });
            await service.handleNipAcEvent(reject);

            expect(get(voiceCallState).status).toBe('ended');
            expect(get(voiceCallState).endReason).toBe('rejected');
            expect(createCallEventSpy).not.toHaveBeenCalled();
            expect(localCreateCallEventSpy).not.toHaveBeenCalled();
        });

        it("caller authors 'busy' when receiving Call Reject with content 'busy'", async () => {
            const createCallEventSpy = vi.fn().mockResolvedValue(undefined);
            service.registerNipAcSenders(noopSenders());
            service.registerCallEventCreator(createCallEventSpy);

            await service.initiateCall(PEER_NPUB);
            const callId = get(voiceCallState).callId!;
            createCallEventSpy.mockClear();

            const busyReject = buildInner({
                senderHex: PEER_HEX,
                kind: NIP_AC_KIND_REJECT,
                callId,
                content: 'busy'
            });
            await service.handleNipAcEvent(busyReject);

            expect(get(voiceCallState).status).toBe('ended');
            expect(get(voiceCallState).endReason).toBe('busy');
            expect(createCallEventSpy).toHaveBeenCalledTimes(1);
            const args = createCallEventSpy.mock.calls[0];
            expect(args[0]).toBe(PEER_NPUB);
            expect(args[1]).toBe('busy');
        });

        it("authors 'failed' on caller side when ICE fails", async () => {
            const createCallEventSpy = vi.fn().mockResolvedValue(undefined);
            service.registerNipAcSenders(noopSenders());
            service.registerCallEventCreator(createCallEventSpy);

            await service.initiateCall(PEER_NPUB);
            const pc = (globalThis as any).__lastPeerConnection;
            pc.iceConnectionState = 'failed';
            pc.oniceconnectionstatechange();

            expect(get(voiceCallState).status).toBe('ended');
            expect(get(voiceCallState).endReason).toBe('ice-failed');
            expect(createCallEventSpy).toHaveBeenCalledTimes(1);
            expect(createCallEventSpy.mock.calls[0][1]).toBe('failed');
        });

        it("does NOT author 'failed' on callee side when ICE fails", async () => {
            const createCallEventSpy = vi.fn().mockResolvedValue(undefined);
            service.registerNipAcSenders(noopSenders());
            service.registerCallEventCreator(createCallEventSpy);

            const offer = buildInner({
                senderHex: PEER_HEX,
                kind: NIP_AC_KIND_OFFER,
                callId: 'call-failed-callee',
                content: 'sdp',
                callType: 'voice'
            });
            await service.handleNipAcEvent(offer);
            const pc = (globalThis as any).__lastPeerConnection;
            pc.iceConnectionState = 'failed';
            pc.oniceconnectionstatechange();

            expect(get(voiceCallState).status).toBe('ended');
            expect(get(voiceCallState).endReason).toBe('ice-failed');
            const failedCalls = createCallEventSpy.mock.calls.filter(
                (c) => c[1] === 'failed'
            );
            expect(failedCalls.length).toBe(0);
        });

        it("authors 'missed' via local path when caller hangs up before pickup", async () => {
            const createCallEventSpy = vi.fn().mockResolvedValue(undefined);
            const localCreateCallEventSpy = vi.fn().mockResolvedValue(undefined);
            service.registerNipAcSenders(noopSenders());
            service.registerCallEventCreator(createCallEventSpy);
            service.registerLocalCallEventCreator(localCreateCallEventSpy);

            const callId = 'call-missed-1';
            setIncomingRinging(PEER_NPUB, callId);

            const hangup = buildInner({
                senderHex: PEER_HEX,
                kind: NIP_AC_KIND_HANGUP,
                callId,
                content: ''
            });
            await service.handleNipAcEvent(hangup);

            expect(localCreateCallEventSpy).toHaveBeenCalledTimes(1);
            const [recipient, type, callIdArg, initiatorNpub] =
                localCreateCallEventSpy.mock.calls[0];
            expect(recipient).toBe(PEER_NPUB);
            expect(type).toBe('missed');
            expect(callIdArg).toBe(callId);
            expect(initiatorNpub).toBe(PEER_NPUB);
            expect(createCallEventSpy).not.toHaveBeenCalled();
        });

        it("authors 'ended' with duration when caller hangs up active call", async () => {
            const createCallEventSpy = vi.fn().mockResolvedValue(undefined);
            service.registerNipAcSenders(noopSenders());
            service.registerCallEventCreator(createCallEventSpy);

            await service.initiateCall(PEER_NPUB);
            storeSetActive();
            incrementDuration();
            incrementDuration();
            incrementDuration();

            const expectedCallId = get(voiceCallState).callId;
            service.hangup();

            expect(createCallEventSpy).toHaveBeenCalledTimes(1);
            const [recipient, type, duration, callId] =
                createCallEventSpy.mock.calls[0];
            expect(recipient).toBe(PEER_NPUB);
            expect(type).toBe('ended');
            expect(duration).toBe(3);
            expect(callId).toBe(expectedCallId);
        });
    });

    describe('NIP-AC self-event multi-device handling', () => {
        it('S16: self Call Answer in incoming-ringing transitions to answered-elsewhere', async () => {
            service.registerNipAcSenders(noopSenders());
            const callId = 'call-multi-device';
            setIncomingRinging(PEER_NPUB, callId);

            // The caller is PEER_HEX; the local user (rumor pubkey for self-wrap)
            // is whoever signed the answer. We invoke handleSelfAnswer directly
            // (the receive path's self-event filter is what calls this).
            const selfHex = 'c'.repeat(64);
            const selfAnswer = buildInner({
                senderHex: selfHex,
                kind: NIP_AC_KIND_ANSWER,
                callId,
                content: 'sdp-answer'
            });
            await service.handleSelfAnswer(selfAnswer);

            expect(get(voiceCallState).status).toBe('ended');
            expect(get(voiceCallState).endReason).toBe('answered-elsewhere');
            expect(dismissIncomingCallSpy).toHaveBeenCalledWith({ callId });
        });

        it('self Call Reject in incoming-ringing transitions to rejected-elsewhere', async () => {
            service.registerNipAcSenders(noopSenders());
            const callId = 'call-multi-device-reject';
            setIncomingRinging(PEER_NPUB, callId);

            const selfHex = 'd'.repeat(64);
            const selfReject = buildInner({
                senderHex: selfHex,
                kind: NIP_AC_KIND_REJECT,
                callId,
                content: ''
            });
            await service.handleSelfReject(selfReject);

            expect(get(voiceCallState).status).toBe('ended');
            expect(get(voiceCallState).endReason).toBe('rejected-elsewhere');
            expect(dismissIncomingCallSpy).toHaveBeenCalledWith({ callId });
        });

        it('self Call Answer with mismatched call-id is ignored', async () => {
            service.registerNipAcSenders(noopSenders());
            setIncomingRinging(PEER_NPUB, 'call-X');

            const selfHex = 'e'.repeat(64);
            const selfAnswer = buildInner({
                senderHex: selfHex,
                kind: NIP_AC_KIND_ANSWER,
                callId: 'call-Y',
                content: 'sdp'
            });
            await service.handleSelfAnswer(selfAnswer);

            expect(get(voiceCallState).status).toBe('incoming-ringing');
            expect(dismissIncomingCallSpy).not.toHaveBeenCalled();
        });

        it('self Call Answer outside incoming-ringing is ignored', async () => {
            service.registerNipAcSenders(noopSenders());
            // status is idle
            const selfHex = 'f'.repeat(64);
            const selfAnswer = buildInner({
                senderHex: selfHex,
                kind: NIP_AC_KIND_ANSWER,
                callId: 'whatever',
                content: 'sdp'
            });
            await service.handleSelfAnswer(selfAnswer);

            expect(get(voiceCallState).status).toBe('idle');
            expect(dismissIncomingCallSpy).not.toHaveBeenCalled();
        });
    });
});
