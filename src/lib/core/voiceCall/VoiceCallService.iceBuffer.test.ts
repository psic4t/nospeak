// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NostrEvent } from 'nostr-tools';
import { VoiceCallService } from './VoiceCallService';
import {
    NIP_AC_KIND_ICE,
    NIP_AC_KIND_OFFER
} from './constants';
import { resetCall } from '$lib/stores/voiceCall';

/**
 * Tests for NIP-AC two-layer ICE candidate buffering (NIP-AC test
 * vectors B1-B11). The full P2P bring-up (createPeerConnection +
 * setRemoteDescription) is exercised through public entry points
 * `handleNipAcEvent(offer)` and `handleNipAcEvent(ice)` so the test
 * doesn't reach into private state.
 */

const SENDER_HEX_A = 'a'.repeat(64);
const SENDER_HEX_B = 'b'.repeat(64);

interface MockPeerConnection {
    addIceCandidate: ReturnType<typeof vi.fn>;
    setRemoteDescription: ReturnType<typeof vi.fn>;
    createAnswer: ReturnType<typeof vi.fn>;
    setLocalDescription: ReturnType<typeof vi.fn>;
    createOffer: ReturnType<typeof vi.fn>;
    addTrack: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
    onicecandidate: ((ev: any) => void) | null;
    ontrack: ((ev: any) => void) | null;
    oniceconnectionstatechange: (() => void) | null;
    iceConnectionState: string;
}

function makeMockPc(): MockPeerConnection {
    let setRemoteDescResolver: () => void = () => {};
    const setRemoteDescPromise = new Promise<void>((resolve) => {
        setRemoteDescResolver = resolve;
    });
    const pc: any = {
        addIceCandidate: vi.fn().mockResolvedValue(undefined),
        setRemoteDescription: vi.fn().mockImplementation(async () => {
            return setRemoteDescPromise;
        }),
        createAnswer: vi.fn().mockResolvedValue({ type: 'answer', sdp: 'answer-sdp' }),
        setLocalDescription: vi.fn().mockResolvedValue(undefined),
        createOffer: vi.fn().mockResolvedValue({ type: 'offer', sdp: 'offer-sdp' }),
        addTrack: vi.fn(),
        close: vi.fn(),
        onicecandidate: null,
        ontrack: null,
        oniceconnectionstatechange: null,
        iceConnectionState: 'new'
    };
    pc._resolveSetRemoteDescription = setRemoteDescResolver;
    return pc as MockPeerConnection & { _resolveSetRemoteDescription: () => void };
}

function buildIceEvent(opts: {
    senderHex: string;
    callId: string;
    candidate: string;
    sdpMid?: string | null;
    sdpMLineIndex?: number | null;
    createdAt?: number;
}): NostrEvent {
    return {
        kind: NIP_AC_KIND_ICE,
        pubkey: opts.senderHex,
        created_at: opts.createdAt ?? Math.floor(Date.now() / 1000),
        content: JSON.stringify({
            candidate: opts.candidate,
            sdpMid: opts.sdpMid ?? '0',
            sdpMLineIndex: opts.sdpMLineIndex ?? 0
        }),
        tags: [['call-id', opts.callId]],
        id: 'ice-' + opts.candidate,
        sig: ''
    };
}

function buildOfferEvent(opts: {
    senderHex: string;
    callId: string;
    sdp?: string;
}): NostrEvent {
    return {
        kind: NIP_AC_KIND_OFFER,
        pubkey: opts.senderHex,
        created_at: Math.floor(Date.now() / 1000),
        content: opts.sdp ?? 'offer-sdp',
        tags: [
            ['call-id', opts.callId],
            ['call-type', 'voice'],
            ['alt', 'WebRTC call offer']
        ],
        id: 'offer-' + opts.callId,
        sig: ''
    };
}

describe('NIP-AC ICE candidate buffering', () => {
    let service: VoiceCallService;
    let mockPcs: Array<MockPeerConnection & { _resolveSetRemoteDescription: () => void }>;

    beforeEach(() => {
        resetCall();
        service = new VoiceCallService();
        mockPcs = [];
        // RTCPeerConnection is invoked with `new`, so use a regular
        // constructor function rather than vi.fn().mockImplementation.
        function MockRTCPeerConnection(this: any) {
            const pc = makeMockPc() as MockPeerConnection & {
                _resolveSetRemoteDescription: () => void;
            };
            mockPcs.push(pc);
            return pc;
        }
        (globalThis as any).RTCPeerConnection = MockRTCPeerConnection as any;
        // Provide a minimal RTCIceCandidate constructor that just echoes its init.
        // @ts-expect-error: jsdom doesn't provide RTCIceCandidate
        globalThis.RTCIceCandidate = function (init: RTCIceCandidateInit) {
            return init;
        };
        // @ts-expect-error: jsdom doesn't provide RTCSessionDescription
        globalThis.RTCSessionDescription = function (init: any) {
            return init;
        };
        // Stub senders so handleOffer's busy-reject path is a no-op.
        service.registerNipAcSenders({
            sendOffer: vi.fn().mockResolvedValue(undefined),
            sendAnswer: vi.fn().mockResolvedValue(undefined),
            sendIceCandidate: vi.fn().mockResolvedValue(undefined),
            sendHangup: vi.fn().mockResolvedValue(undefined),
            sendReject: vi.fn().mockResolvedValue(undefined),
            sendRenegotiate: vi.fn().mockResolvedValue(undefined)
        });
    });

    afterEach(() => {
        resetCall();
    });

    it('B1: candidate before session is buffered globally', async () => {
        const ice = buildIceEvent({
            senderHex: SENDER_HEX_A,
            callId: 'call-1',
            candidate: 'c1'
        });
        await service.handleNipAcEvent(ice);

        // No PeerConnection means none was constructed.
        expect(mockPcs.length).toBe(0);
    });

    it('B2: multiple early candidates are preserved per peer', async () => {
        for (const c of ['c1', 'c2', 'c3']) {
            await service.handleNipAcEvent(
                buildIceEvent({ senderHex: SENDER_HEX_A, callId: 'call-1', candidate: c })
            );
        }
        expect(mockPcs.length).toBe(0);
    });

    it('B3+B4: global buffer drains and flushes after setRemoteDescription', async () => {
        // Three candidates arrive before the offer.
        for (const c of ['c1', 'c2', 'c3']) {
            await service.handleNipAcEvent(
                buildIceEvent({ senderHex: SENDER_HEX_A, callId: 'call-1', candidate: c })
            );
        }

        // Offer arrives. handleOffer creates the PeerConnection (which
        // drains the global buffer into the per-session buffer) and then
        // awaits setRemoteDescription — our mock holds that promise.
        const offer = buildOfferEvent({ senderHex: SENDER_HEX_A, callId: 'call-1' });
        const offerPromise = service.handleNipAcEvent(offer);

        // Until setRemoteDescription resolves, no addIceCandidate should fire.
        // Yield once so the inner setRemoteDescription microtask gets a chance.
        await new Promise((r) => setTimeout(r, 0));
        const pc = mockPcs[0];
        expect(pc.addIceCandidate).not.toHaveBeenCalled();
        expect(pc.setRemoteDescription).toHaveBeenCalledTimes(1);

        // Resolve setRemoteDescription -> flushPerSessionIce should drain.
        pc._resolveSetRemoteDescription();
        await offerPromise;

        expect(pc.addIceCandidate).toHaveBeenCalledTimes(3);
        const calls = pc.addIceCandidate.mock.calls.map(
            (c: any[]) => c[0].candidate
        );
        expect(calls).toEqual(['c1', 'c2', 'c3']);
    });

    it('B5: candidate after PC but before setRemoteDescription is buffered per session', async () => {
        // Trigger PC creation by handling an offer; hold remote desc.
        const offer = buildOfferEvent({ senderHex: SENDER_HEX_A, callId: 'call-1' });
        const offerPromise = service.handleNipAcEvent(offer);
        // Yield once so handleOffer reaches setRemoteDescription.
        await new Promise((r) => setTimeout(r, 0));
        const pc = mockPcs[0];

        // Now ICE arrives — PC exists but remote desc not yet set.
        await service.handleNipAcEvent(
            buildIceEvent({ senderHex: SENDER_HEX_A, callId: 'call-1', candidate: 'c-after' })
        );
        expect(pc.addIceCandidate).not.toHaveBeenCalled();

        pc._resolveSetRemoteDescription();
        await offerPromise;
        expect(pc.addIceCandidate).toHaveBeenCalledTimes(1);
        expect(pc.addIceCandidate.mock.calls[0][0].candidate).toBe('c-after');
    });

    it('B6: candidate after remote desc is applied directly', async () => {
        const offer = buildOfferEvent({ senderHex: SENDER_HEX_A, callId: 'call-1' });
        const offerPromise = service.handleNipAcEvent(offer);
        await new Promise((r) => setTimeout(r, 0));
        const pc = mockPcs[0];
        pc._resolveSetRemoteDescription();
        await offerPromise;

        // Now ICE arrives after remote desc has been set.
        await service.handleNipAcEvent(
            buildIceEvent({ senderHex: SENDER_HEX_A, callId: 'call-1', candidate: 'c-late' })
        );

        // 0 buffered candidates flushed + 1 directly applied = 1 call.
        expect(pc.addIceCandidate).toHaveBeenCalledTimes(1);
        expect(pc.addIceCandidate.mock.calls[0][0].candidate).toBe('c-late');
    });

    it('B7: per-session buffer is not cleared on creation; only on flush', async () => {
        // PC created via offer; set remote desc takes time. ICE arrives.
        const offer = buildOfferEvent({ senderHex: SENDER_HEX_A, callId: 'call-1' });
        const offerPromise = service.handleNipAcEvent(offer);
        await new Promise((r) => setTimeout(r, 0));
        const pc = mockPcs[0];

        // Two candidates arrive after PC, before remote desc resolves.
        await service.handleNipAcEvent(
            buildIceEvent({ senderHex: SENDER_HEX_A, callId: 'call-1', candidate: 'c-pre1' })
        );
        await service.handleNipAcEvent(
            buildIceEvent({ senderHex: SENDER_HEX_A, callId: 'call-1', candidate: 'c-pre2' })
        );
        expect(pc.addIceCandidate).not.toHaveBeenCalled();

        pc._resolveSetRemoteDescription();
        await offerPromise;
        expect(pc.addIceCandidate).toHaveBeenCalledTimes(2);
    });

    it('B8: candidates buffered while ringing are preserved when offer arrives', async () => {
        // Three candidates arrive globally first.
        for (const c of ['r1', 'r2']) {
            await service.handleNipAcEvent(
                buildIceEvent({ senderHex: SENDER_HEX_A, callId: 'call-1', candidate: c })
            );
        }
        // Then more candidates arrive — still globally because no PC.
        await service.handleNipAcEvent(
            buildIceEvent({ senderHex: SENDER_HEX_A, callId: 'call-1', candidate: 'r3' })
        );

        // Offer creates PC and triggers drain + flush.
        const offer = buildOfferEvent({ senderHex: SENDER_HEX_A, callId: 'call-1' });
        const offerPromise = service.handleNipAcEvent(offer);
        await new Promise((r) => setTimeout(r, 0));
        const pc = mockPcs[0];
        pc._resolveSetRemoteDescription();
        await offerPromise;

        const calls = pc.addIceCandidate.mock.calls.map(
            (c: any[]) => c[0].candidate
        );
        expect(calls).toEqual(['r1', 'r2', 'r3']);
    });

    it('B9: global buffers are independent per peer', async () => {
        // Two peers, three candidates each.
        for (const c of ['a1', 'a2']) {
            await service.handleNipAcEvent(
                buildIceEvent({ senderHex: SENDER_HEX_A, callId: 'call-A', candidate: c })
            );
        }
        for (const c of ['b1']) {
            await service.handleNipAcEvent(
                buildIceEvent({ senderHex: SENDER_HEX_B, callId: 'call-B', candidate: c })
            );
        }

        // Offer from peer A drains A's buffer only.
        const offerA = buildOfferEvent({
            senderHex: SENDER_HEX_A,
            callId: 'call-A'
        });
        const offerPromise = service.handleNipAcEvent(offerA);
        await new Promise((r) => setTimeout(r, 0));
        const pc = mockPcs[0];
        pc._resolveSetRemoteDescription();
        await offerPromise;

        const calls = pc.addIceCandidate.mock.calls.map(
            (c: any[]) => c[0].candidate
        );
        expect(calls).toEqual(['a1', 'a2']);
        // Peer B's buffer is NOT drained — only one PC was constructed.
        expect(mockPcs.length).toBe(1);
    });

    it('B10: registering one session does not drain another peer', async () => {
        await service.handleNipAcEvent(
            buildIceEvent({ senderHex: SENDER_HEX_A, callId: 'call-A', candidate: 'a1' })
        );
        await service.handleNipAcEvent(
            buildIceEvent({ senderHex: SENDER_HEX_B, callId: 'call-B', candidate: 'b1' })
        );

        const offerA = buildOfferEvent({ senderHex: SENDER_HEX_A, callId: 'call-A' });
        const offerPromise = service.handleNipAcEvent(offerA);
        await new Promise((r) => setTimeout(r, 0));
        const pc = mockPcs[0];
        pc._resolveSetRemoteDescription();
        await offerPromise;

        const calls = pc.addIceCandidate.mock.calls.map(
            (c: any[]) => c[0].candidate
        );
        expect(calls).toEqual(['a1']);
        expect(calls).not.toContain('b1');
    });

    it('B11: full P2P flow — ringing candidates + post-PC + post-remote-desc', async () => {
        // Phase 1: candidates while ringing (no PC yet).
        await service.handleNipAcEvent(
            buildIceEvent({ senderHex: SENDER_HEX_A, callId: 'call-1', candidate: 'phase1-a' })
        );
        await service.handleNipAcEvent(
            buildIceEvent({ senderHex: SENDER_HEX_A, callId: 'call-1', candidate: 'phase1-b' })
        );

        // Phase 2: offer arrives → PC created. Hold remote desc.
        const offer = buildOfferEvent({ senderHex: SENDER_HEX_A, callId: 'call-1' });
        const offerPromise = service.handleNipAcEvent(offer);
        await new Promise((r) => setTimeout(r, 0));
        const pc = mockPcs[0];

        // Phase 3: candidate arrives after PC but before remote desc.
        await service.handleNipAcEvent(
            buildIceEvent({ senderHex: SENDER_HEX_A, callId: 'call-1', candidate: 'phase2' })
        );
        expect(pc.addIceCandidate).not.toHaveBeenCalled();

        // Phase 4: remote desc resolves → flush.
        pc._resolveSetRemoteDescription();
        await offerPromise;
        expect(pc.addIceCandidate).toHaveBeenCalledTimes(3);
        const flushedOrder = pc.addIceCandidate.mock.calls.map(
            (c: any[]) => c[0].candidate
        );
        expect(flushedOrder).toEqual(['phase1-a', 'phase1-b', 'phase2']);

        // Phase 5: late candidate is applied directly.
        await service.handleNipAcEvent(
            buildIceEvent({ senderHex: SENDER_HEX_A, callId: 'call-1', candidate: 'phase3' })
        );
        expect(pc.addIceCandidate).toHaveBeenCalledTimes(4);
        const lastCall =
            pc.addIceCandidate.mock.calls[pc.addIceCandidate.mock.calls.length - 1][0]
                .candidate;
        expect(lastCall).toBe('phase3');
    });
});
