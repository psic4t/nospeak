// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NostrEvent } from 'nostr-tools';
import { nip19 } from 'nostr-tools';

vi.mock('$lib/stores/auth', () => ({
    signer: { subscribe: vi.fn() },
    currentUser: { subscribe: vi.fn() }
}));

vi.mock('$lib/core/runtimeConfig/store', () => ({
    // Mirror the runtime-config defaults shape (STUN + plain TURN over
    // UDP+TCP via array-`urls`). Exercising the array form here
    // ensures the createPeerConnection path keeps tolerating it
    // — RTCIceServer.urls is `string | string[]` per the WebRTC spec.
    getIceServers: vi.fn().mockReturnValue([
        { urls: 'stun:turn.data.haus:3478' },
        {
            urls: [
                'turn:turn.data.haus:3478?transport=udp',
                'turn:turn.data.haus:3478?transport=tcp'
            ],
            username: 'free',
            credential: 'free'
        }
    ]),
    getIceServersJson: vi.fn().mockReturnValue(
        '[{"urls":"stun:turn.data.haus:3478"},' +
        '{"urls":["turn:turn.data.haus:3478?transport=udp",' +
        '"turn:turn.data.haus:3478?transport=tcp"],' +
        '"username":"free","credential":"free"}]'
    )
}));

// AndroidVoiceCall is no longer imported by VoiceCallService (the
// web/PWA backend after the native voice-call split moved all native
// session lifecycle plumbing into VoiceCallServiceNative).

import { VoiceCallService, type NipAcSenders } from './VoiceCallService';
import {
    resetCall,
    setIncomingRinging,
    setActive as storeSetActive,
    setOutgoingRinging,
    setRenegotiationState,
    incrementDuration,
    voiceCallState
} from '$lib/stores/voiceCall';
import {
    NIP_AC_KIND_OFFER,
    NIP_AC_KIND_ANSWER,
    NIP_AC_KIND_HANGUP,
    NIP_AC_KIND_REJECT,
    NIP_AC_KIND_RENEGOTIATE,
    RENEGOTIATION_TIMEOUT_MS
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
        sendReject: vi.fn().mockResolvedValue(undefined),
        sendRenegotiate: vi.fn().mockResolvedValue(undefined)
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
    function MockRTCPeerConnection(this: any, config?: any) {
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
        // Capture the config arg so tests can assert RTCConfiguration
        // shape (e.g. defensive sdpSemantics: 'unified-plan').
        this.__config = config;
        (globalThis as any).__lastPeerConnection = this;
        (globalThis as any).__lastPeerConnectionConfig = config;
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

    describe('RTCPeerConnection configuration', () => {
        it('constructs the 1-on-1 peer connection with sdpSemantics: "unified-plan"', async () => {
            const senders = noopSenders();
            service.registerNipAcSenders(senders);
            await service.initiateCall(PEER_NPUB);

            const config = (globalThis as any).__lastPeerConnectionConfig;
            expect(config).toBeDefined();
            expect(config.sdpSemantics).toBe('unified-plan');
            // iceServers should still be passed through.
            expect(Array.isArray(config.iceServers)).toBe(true);
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
                sendReject: vi.fn().mockResolvedValue(undefined),
                sendRenegotiate: vi.fn().mockResolvedValue(undefined)
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
                sendReject: hangingReject,
                sendRenegotiate: vi.fn()
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
        });
    });

    // -----------------------------------------------------------------
    //  Phase 3: video calling (web/PWA)
    // -----------------------------------------------------------------

    describe('video calling', () => {
        function makeVideoStream(label = 'init'): any {
            // A minimal MediaStream-shaped object exposing getTracks()
            // with both audio and video tracks. cacheLocalTracks now
            // walks getTracks() and buckets by kind.
            const audioTrack = { kind: 'audio', enabled: true, stop: vi.fn() };
            const videoTrack = {
                kind: 'video',
                enabled: true,
                stop: vi.fn(),
                _label: label
            };
            const tracks = [audioTrack, videoTrack];
            return {
                _label: label,
                getTracks: () => tracks,
                getAudioTracks: () => [audioTrack],
                getVideoTracks: () => [videoTrack],
                addTrack: vi.fn((t: any) => tracks.push(t)),
                removeTrack: vi.fn((t: any) => {
                    const i = tracks.indexOf(t);
                    if (i >= 0) tracks.splice(i, 1);
                })
            };
        }

        function installVideoMedia(): {
            stream: any;
            getUserMedia: ReturnType<typeof vi.fn>;
        } {
            const stream = makeVideoStream('initial');
            const getUserMedia = vi.fn().mockImplementation((constraints: any) => {
                // Camera flip path supplies its own constraints with no
                // audio key — return a video-only stream-shape with the
                // requested facing label.
                if (constraints && !('audio' in constraints) && constraints.video) {
                    const target =
                        constraints.video.facingMode === 'environment'
                            ? 'back'
                            : 'front';
                    const flipped = makeVideoStream(target);
                    return Promise.resolve(flipped);
                }
                return Promise.resolve(stream);
            });
            (globalThis as any).navigator = {
                ...((globalThis as any).navigator ?? {}),
                mediaDevices: { getUserMedia }
            };
            return { stream, getUserMedia };
        }

        it('initiateCall("video") requests video constraints and tags the offer', async () => {
            const { getUserMedia } = installVideoMedia();
            const senders = noopSenders();
            service.registerNipAcSenders(senders);

            await service.initiateCall(PEER_NPUB, 'video');

            const constraints = getUserMedia.mock.calls[0][0];
            expect(constraints.audio).toBeTruthy();
            expect(constraints.video).toBeTruthy();
            expect(constraints.video.facingMode).toBe('user');
            // The store reflects the kind.
            expect(get(voiceCallState).callKind).toBe('video');
            // The outgoing offer carried the call-type tag.
            expect(senders.sendOffer).toHaveBeenCalledTimes(1);
            const args = (senders.sendOffer as any).mock.calls[0];
            expect(args[3]).toEqual({ callType: 'video' });
            // getCallKind returns the active kind.
            expect(service.getCallKind()).toBe('video');
        });

        it('initiateCall() defaults to voice constraints when no kind is given', async () => {
            const senders = noopSenders();
            service.registerNipAcSenders(senders);

            await service.initiateCall(PEER_NPUB);

            // The default mock from installWebRtcStubs returns an
            // audio-only stream; the constraints requested by the
            // service should not include video.
            const getUserMedia = (globalThis as any).navigator.mediaDevices
                .getUserMedia;
            const constraints = getUserMedia.mock.calls[0][0];
            expect(constraints.video).toBe(false);
            expect(get(voiceCallState).callKind).toBe('voice');
        });

        it('handleOffer with call-type="video" sets store callKind to video', async () => {
            const senders = noopSenders();
            service.registerNipAcSenders(senders);

            const offer = buildInner({
                senderHex: PEER_HEX,
                kind: NIP_AC_KIND_OFFER,
                callId: 'video-call',
                content: 'sdp',
                callType: 'video'
            });
            await service.handleNipAcEvent(offer);

            expect(get(voiceCallState).callKind).toBe('video');
            expect(service.getCallKind()).toBe('video');
            expect(get(voiceCallState).status).toBe('incoming-ringing');
        });

        it('handleOffer without call-type tag defaults to voice (back-compat)', async () => {
            const senders = noopSenders();
            service.registerNipAcSenders(senders);

            const offer = buildInner({
                senderHex: PEER_HEX,
                kind: NIP_AC_KIND_OFFER,
                callId: 'tagless-call',
                content: 'sdp'
                // callType omitted: no `call-type` tag is added
            });
            await service.handleNipAcEvent(offer);

            expect(get(voiceCallState).callKind).toBe('voice');
            expect(get(voiceCallState).status).toBe('incoming-ringing');
        });

        it('toggleCamera flips the local video track enabled flag', async () => {
            installVideoMedia();
            const senders = noopSenders();
            service.registerNipAcSenders(senders);

            await service.initiateCall(PEER_NPUB, 'video');
            expect(service.isCameraOff()).toBe(false);

            await service.toggleCamera();
            expect(service.isCameraOff()).toBe(true);
            expect(get(voiceCallState).isCameraOff).toBe(true);

            await service.toggleCamera();
            expect(service.isCameraOff()).toBe(false);
            expect(get(voiceCallState).isCameraOff).toBe(false);
        });

        it('toggleCamera is a no-op on voice calls', async () => {
            const senders = noopSenders();
            service.registerNipAcSenders(senders);

            await service.initiateCall(PEER_NPUB, 'voice');
            await service.toggleCamera();
            expect(service.isCameraOff()).toBe(false);
            expect(get(voiceCallState).isCameraOff).toBe(false);
        });

        it('flipCamera replaces the video track via the existing sender', async () => {
            installVideoMedia();
            const senders = noopSenders();
            service.registerNipAcSenders(senders);

            await service.initiateCall(PEER_NPUB, 'video');

            // Wire a senders array onto the mock peer connection so the
            // service's flipCamera path can find the video sender.
            const pc = (globalThis as any).__lastPeerConnection;
            const replaceTrack = vi.fn().mockResolvedValue(undefined);
            const audioSender = { track: { kind: 'audio' } };
            const videoSender = { track: { kind: 'video' }, replaceTrack };
            pc.getSenders = () => [audioSender, videoSender];

            expect(get(voiceCallState).facingMode).toBe('user');

            await service.flipCamera();

            // The video sender's replaceTrack was called with the new
            // back-camera video track produced by the stubbed
            // getUserMedia.
            expect(replaceTrack).toHaveBeenCalledTimes(1);
            const newTrack = replaceTrack.mock.calls[0][0];
            expect(newTrack.kind).toBe('video');
            // Store mirrors the new facing mode.
            expect(get(voiceCallState).facingMode).toBe('environment');
            expect(get(voiceCallState).isCameraFlipping).toBe(false);
        });

        it('cleanup resets callKind, video track refs, and facingMode', async () => {
            installVideoMedia();
            const senders = noopSenders();
            service.registerNipAcSenders(senders);

            await service.initiateCall(PEER_NPUB, 'video');
            expect(service.getCallKind()).toBe('video');

            // Hangup runs cleanup() internally.
            service.hangup();

            expect(service.getCallKind()).toBe('voice');
            expect(service.isCameraOff()).toBe(false);
        });

        it('default speakerphone on when video call goes active', async () => {
            installVideoMedia();
            const senders = noopSenders();
            service.registerNipAcSenders(senders);

            await service.initiateCall(PEER_NPUB, 'video');
            const pc = (globalThis as any).__lastPeerConnection;

            expect(get(voiceCallState).isSpeakerOn).toBe(false);

            pc.iceConnectionState = 'connected';
            pc.oniceconnectionstatechange();

            expect(get(voiceCallState).isSpeakerOn).toBe(true);
            expect(get(voiceCallState).status).toBe('active');
        });

        it('voice call does not auto-enable speakerphone on active', async () => {
            const senders = noopSenders();
            service.registerNipAcSenders(senders);

            await service.initiateCall(PEER_NPUB, 'voice');
            const pc = (globalThis as any).__lastPeerConnection;

            pc.iceConnectionState = 'connected';
            pc.oniceconnectionstatechange();

            expect(get(voiceCallState).isSpeakerOn).toBe(false);
            expect(get(voiceCallState).status).toBe('active');
        });
    });

    // ------------------------------------------------------------------
    //  NIP-AC kind 25055 Call Renegotiate (mid-call SDP change)
    //
    //  Covers:
    //   - handleRenegotiate accepted/rejected per status
    //   - call-id mismatch silently dropped
    //   - glare resolution: lowercase-hex pubkey lex compare; higher
    //     wins (drops peer offer); lower loses (rolls back, accepts)
    //   - voice→video flip on incoming upgrade
    //   - requestVideoUpgrade happy path / not-eligible / camera-denied
    //   - timeout rolls back the local offer
    // ------------------------------------------------------------------
    describe('renegotiation (NIP-AC kind 25055)', () => {
        // We share a peer hex so we can construct deterministic glare
        // inputs by varying SELF_HEX (the recipient `p` tag in inner
        // events) above or below PEER_HEX.
        const PEER_HEX_LOW = '0'.repeat(64);
        const PEER_HEX_HIGH = 'f'.repeat(64);

        function makeVideoStream(label = 'init'): any {
            const audioTrack = {
                stop: vi.fn(),
                kind: 'audio',
                enabled: true,
                label: 'audio-' + label
            };
            const videoTrack = {
                stop: vi.fn(),
                kind: 'video',
                enabled: true,
                label: 'video-' + label
            };
            const tracks: any[] = [audioTrack, videoTrack];
            return {
                getTracks: () => tracks,
                getAudioTracks: () => [audioTrack],
                getVideoTracks: () => [videoTrack],
                addTrack: vi.fn((t: any) => tracks.push(t)),
                removeTrack: vi.fn((t: any) => {
                    const i = tracks.indexOf(t);
                    if (i >= 0) tracks.splice(i, 1);
                })
            };
        }

        /**
         * Stub mediaDevices.getUserMedia to return a stream that has
         * a video track (for renegotiation tests where the upgrade path
         * needs a video track to attach). The default `installWebRtcStubs`
         * stream is audio-only. Returns the underlying mock so callers
         * can introspect or fail it on demand.
         */
        function installVideoMedia(opts?: { fail?: boolean }): {
            stream: any;
            getUserMedia: ReturnType<typeof vi.fn>;
        } {
            const stream = makeVideoStream('initial');
            const getUserMedia = vi.fn().mockImplementation(() =>
                opts?.fail
                    ? Promise.reject(new Error('NotAllowedError'))
                    : Promise.resolve(stream)
            );
            (globalThis as any).navigator = {
                ...((globalThis as any).navigator ?? {}),
                mediaDevices: { getUserMedia }
            };
            return { stream, getUserMedia };
        }

        /**
         * Patch a mock RTCPeerConnection produced by installWebRtcStubs
         * with renegotiation-relevant surface area: signalingState,
         * getSenders(), removeTrack().
         */
        function patchPcForRenegotiation(pc: any): {
            removeTrack: ReturnType<typeof vi.fn>;
            getSenders: () => any[];
            senders: any[];
        } {
            const senders: any[] = [];
            pc.getSenders = vi.fn(() => senders);
            const origAddTrack = pc.addTrack;
            pc.addTrack = vi.fn((track: any, stream: any) => {
                senders.push({ track });
                if (typeof origAddTrack === 'function') {
                    return origAddTrack.call(pc, track, stream);
                }
                return undefined;
            });
            const removeTrack = vi.fn((sender: any) => {
                const i = senders.indexOf(sender);
                if (i >= 0) senders.splice(i, 1);
            });
            pc.removeTrack = removeTrack;
            // Default to a non-glare state. Tests that exercise glare
            // override this before invoking handleRenegotiate.
            pc.signalingState = 'stable';
            return { removeTrack, getSenders: () => senders, senders };
        }

        /**
         * Build a kind-25055 inner event addressed to `selfHex` from
         * `peerHex`. The `p` tag carries `selfHex` so the receive-side
         * code can resolve the local pubkey for glare comparisons.
         */
        function buildRenegotiateInner(opts: {
            peerHex: string;
            selfHex: string;
            callId: string;
            sdp?: string;
        }): NostrEvent {
            return {
                kind: NIP_AC_KIND_RENEGOTIATE,
                pubkey: opts.peerHex,
                created_at: Math.floor(Date.now() / 1000),
                content:
                    opts.sdp ??
                    'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\n',
                tags: [
                    ['p', opts.selfHex],
                    ['call-id', opts.callId],
                    ['alt', 'WebRTC call renegotiation']
                ],
                id: 'inner-25055-' + opts.callId,
                sig: ''
            };
        }

        /**
         * Place the service into an active voice-call session with a
         * primed peer connection. Returns the pc and the peer hex used
         * so tests can craft renegotiate events targeting it.
         */
        async function bringUpActiveVoiceCall(senders: NipAcSenders): Promise<{
            pc: any;
            peerHex: string;
            selfHex: string;
            callId: string;
        }> {
            const peerHex = PEER_HEX;
            // The local user's hex is whatever `inner.tags[p]` carries
            // — for this helper we don't simulate inbound events, so
            // we pick a deterministic value tests can lex-compare. Use
            // a string between PEER_HEX_LOW and PEER_HEX_HIGH so
            // tests can choose glare directions explicitly when they
            // craft inner events.
            const selfHex = '5'.repeat(64);
            service.registerNipAcSenders(senders);
            await service.initiateCall(nip19.npubEncode(peerHex), 'voice');
            const pc = (globalThis as any).__lastPeerConnection;
            patchPcForRenegotiation(pc);

            // Apply a fake answer to transition outgoing-ringing →
            // connecting → active.
            const answerInner: NostrEvent = {
                kind: NIP_AC_KIND_ANSWER,
                pubkey: peerHex,
                created_at: Math.floor(Date.now() / 1000),
                content: 'sdp-answer',
                tags: [
                    ['p', selfHex],
                    ['call-id', get(voiceCallState).callId!],
                    ['alt', 'WebRTC call answer']
                ],
                id: 'inner-answer',
                sig: ''
            };
            await service.handleNipAcEvent(answerInner);
            pc.iceConnectionState = 'connected';
            pc.oniceconnectionstatechange();

            const callId = get(voiceCallState).callId!;
            return { pc, peerHex, selfHex, callId };
        }

        it('handleRenegotiate accepted in active state publishes a kind-25051 answer', async () => {
            const senders = noopSenders();
            const { peerHex, selfHex, callId } = await bringUpActiveVoiceCall(senders);

            const inner = buildRenegotiateInner({ peerHex, selfHex, callId });
            await service.handleNipAcEvent(inner);

            expect(senders.sendAnswer).toHaveBeenCalledTimes(1);
            const args = (senders.sendAnswer as any).mock.calls[0];
            expect(args[1]).toBe(callId);
            // Status remains active throughout.
            expect(get(voiceCallState).status).toBe('active');
            // Renegotiation state cycles back to idle.
            expect(get(voiceCallState).renegotiationState).toBe('idle');
        });

        it('handleRenegotiate accepted in connecting state publishes a kind-25051 answer', async () => {
            const senders = noopSenders();
            const { peerHex, selfHex, callId } = await bringUpActiveVoiceCall(senders);
            // Force status back to connecting to exercise that branch.
            const pc = (globalThis as any).__lastPeerConnection;
            // We cannot easily move back to connecting via store APIs
            // without breaking other invariants; instead end the call
            // and bring it up again, stopping just before active.
            // The helper transitions through connecting then to active
            // — for this test we just verify connecting status is also
            // accepted by manually flipping the store.
            voiceCallState.update(s => ({ ...s, status: 'connecting' }));

            const inner = buildRenegotiateInner({ peerHex, selfHex, callId });
            await service.handleNipAcEvent(inner);

            expect(senders.sendAnswer).toHaveBeenCalledTimes(1);
            // Status was preserved at connecting.
            expect(get(voiceCallState).status).toBe('connecting');
            void pc;
        });

        it.each(['idle', 'outgoing-ringing', 'incoming-ringing', 'ended'] as const)(
            'handleRenegotiate dropped in %s status without publishing an answer',
            async (status) => {
                const senders = noopSenders();
                service.registerNipAcSenders(senders);
                if (status === 'outgoing-ringing') {
                    setOutgoingRinging(PEER_NPUB, 'call-x');
                } else if (status === 'incoming-ringing') {
                    setIncomingRinging(PEER_NPUB, 'call-x');
                } else if (status === 'ended') {
                    setOutgoingRinging(PEER_NPUB, 'call-x');
                    voiceCallState.update(s => ({ ...s, status: 'ended' }));
                }
                // For 'idle' we leave the resetCall() value in place.

                const inner = buildRenegotiateInner({
                    peerHex: PEER_HEX,
                    selfHex: '5'.repeat(64),
                    callId: 'call-x'
                });
                await service.handleNipAcEvent(inner);

                expect(senders.sendAnswer).not.toHaveBeenCalled();
            }
        );

        it('handleRenegotiate with mismatched call-id is dropped silently', async () => {
            const senders = noopSenders();
            const { peerHex, selfHex } = await bringUpActiveVoiceCall(senders);
            (senders.sendAnswer as any).mockClear();

            const inner = buildRenegotiateInner({
                peerHex,
                selfHex,
                callId: 'wrong-call-id'
            });
            await service.handleNipAcEvent(inner);

            expect(senders.sendAnswer).not.toHaveBeenCalled();
        });

        it('glare: WIN keeps outgoing offer and ignores peer renegotiate (our hex > theirs)', async () => {
            const senders = noopSenders();
            const { pc, callId } = await bringUpActiveVoiceCall(senders);
            (senders.sendAnswer as any).mockClear();

            // Simulate a pending local offer.
            pc.signalingState = 'have-local-offer';
            const setLocalDescription = pc.setLocalDescription;
            setLocalDescription.mockClear();

            // Our hex > theirs.
            const ourHex = 'f'.repeat(64);
            const theirHex = PEER_HEX_LOW;
            const inner = buildRenegotiateInner({
                peerHex: theirHex,
                selfHex: ourHex,
                callId
            });
            await service.handleNipAcEvent(inner);

            // No answer published, no rollback called.
            expect(senders.sendAnswer).not.toHaveBeenCalled();
            expect(setLocalDescription).not.toHaveBeenCalled();
            // Glare state was set for diagnostics.
            expect(get(voiceCallState).renegotiationState).toBe('glare');
        });

        it('glare: LOSE rolls back our offer and accepts peer renegotiate (our hex < theirs)', async () => {
            const senders = noopSenders();
            const { pc, callId } = await bringUpActiveVoiceCall(senders);
            (senders.sendAnswer as any).mockClear();

            pc.signalingState = 'have-local-offer';

            // Our hex < theirs.
            const ourHex = '0'.repeat(64);
            const theirHex = PEER_HEX_HIGH;
            const inner = buildRenegotiateInner({
                peerHex: theirHex,
                selfHex: ourHex,
                callId
            });
            await service.handleNipAcEvent(inner);

            // Rollback was called and we then sent a kind-25051 answer.
            const rollbackCall = (pc.setLocalDescription as any).mock.calls.find(
                (c: any[]) => c[0] && c[0].type === 'rollback'
            );
            expect(rollbackCall).toBeTruthy();
            expect(senders.sendAnswer).toHaveBeenCalledTimes(1);
        });

        it('handleRenegotiate flips callKind to video when SDP carries video m-line', async () => {
            const senders = noopSenders();
            installVideoMedia(); // for the camera-acquire branch
            const { peerHex, selfHex, callId } = await bringUpActiveVoiceCall(senders);

            // The default mock createAnswer returns { type:'answer', sdp:'sdp-answer' }
            // which has no 'a=inactive', so the upgrade is treated as
            // accepted on our side. Provide a video offer SDP.
            const inner = buildRenegotiateInner({
                peerHex,
                selfHex,
                callId,
                sdp: 'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\n'
            });
            await service.handleNipAcEvent(inner);

            expect(get(voiceCallState).callKind).toBe('video');
            // Speaker auto-on for video.
            expect(get(voiceCallState).isSpeakerOn).toBe(true);
        });

        it('requestVideoUpgrade publishes kind-25055 with a fresh SDP offer', async () => {
            const senders = noopSenders();
            installVideoMedia();
            const { pc, callId } = await bringUpActiveVoiceCall(senders);
            (senders.sendOffer as any).mockClear();

            await service.requestVideoUpgrade();

            expect(senders.sendRenegotiate).toHaveBeenCalledTimes(1);
            const args = (senders.sendRenegotiate as any).mock.calls[0];
            expect(args[1]).toBe(callId);
            expect(get(voiceCallState).renegotiationState).toBe('outgoing');
            expect(pc.createOffer).toHaveBeenCalled();
            expect(pc.setLocalDescription).toHaveBeenCalled();
        });

        it('requestVideoUpgrade flips callKind to video on receiving the kind-25051 answer', async () => {
            const senders = noopSenders();
            installVideoMedia();
            const { peerHex, selfHex, callId } = await bringUpActiveVoiceCall(senders);
            await service.requestVideoUpgrade();

            const answer: NostrEvent = {
                kind: NIP_AC_KIND_ANSWER,
                pubkey: peerHex,
                created_at: Math.floor(Date.now() / 1000),
                content:
                    'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\na=sendrecv\r\n',
                tags: [
                    ['p', selfHex],
                    ['call-id', callId],
                    ['alt', 'WebRTC call answer']
                ],
                id: 'inner-25051-renegotiation',
                sig: ''
            };
            await service.handleNipAcEvent(answer);

            expect(get(voiceCallState).callKind).toBe('video');
            expect(get(voiceCallState).renegotiationState).toBe('idle');
            expect(get(voiceCallState).isSpeakerOn).toBe(true);
        });

        it('requestVideoUpgrade reverts state when camera permission is denied', async () => {
            const senders = noopSenders();
            installVideoMedia({ fail: true });
            await bringUpActiveVoiceCall(senders);

            await service.requestVideoUpgrade();

            expect(senders.sendRenegotiate).not.toHaveBeenCalled();
            expect(get(voiceCallState).renegotiationState).toBe('idle');
            expect(get(voiceCallState).callKind).toBe('voice');
        });

        it('requestVideoUpgrade rejected while another renegotiation is pending', async () => {
            const senders = noopSenders();
            installVideoMedia();
            await bringUpActiveVoiceCall(senders);
            // Force renegotiation state to outgoing to simulate an
            // already-pending upgrade.
            setRenegotiationState('outgoing');

            await service.requestVideoUpgrade();

            expect(senders.sendRenegotiate).not.toHaveBeenCalled();
        });

        it('requestVideoUpgrade rolls back on timeout', async () => {
            vi.useFakeTimers();
            try {
                const senders = noopSenders();
                installVideoMedia();
                const { pc } = await bringUpActiveVoiceCall(senders);

                await service.requestVideoUpgrade();
                // setLocalDescription was called once for the outgoing
                // offer; clear before checking for the rollback call.
                (pc.setLocalDescription as any).mockClear();

                // Have-local-offer is required for the rollback branch
                // to actually invoke setLocalDescription({rollback}).
                pc.signalingState = 'have-local-offer';

                vi.advanceTimersByTime(RENEGOTIATION_TIMEOUT_MS + 100);
                // Allow the queued promise inside the timeout body to resolve.
                await Promise.resolve();
                await Promise.resolve();

                const rollbackCall = (pc.setLocalDescription as any).mock.calls.find(
                    (c: any[]) => c[0] && c[0].type === 'rollback'
                );
                expect(rollbackCall).toBeTruthy();
                expect(get(voiceCallState).renegotiationState).toBe('idle');
                // The underlying call survives.
                expect(get(voiceCallState).status).toBe('active');
                expect(get(voiceCallState).callKind).toBe('voice');
            } finally {
                vi.useRealTimers();
            }
        });

        it("upgraded voice→video call's history rumor carries call-media-type=video", async () => {
            // Spec coverage for the "Call History via Kind 1405 Events"
            // requirement (modified by add-video-calling): the
            // call-media-type tag MUST reflect the call's *latest*
            // media kind at hangup time, not the original kind. After
            // a successful voice→video upgrade, an `ended` rumor must
            // be authored with callMediaType='video'.
            const createCallEventSpy = vi.fn().mockResolvedValue(undefined);
            const senders = noopSenders();
            installVideoMedia();
            service.registerCallEventCreator(createCallEventSpy);
            const { peerHex, selfHex, callId } = await bringUpActiveVoiceCall(senders);

            // The call's kind is voice at this point.
            expect(get(voiceCallState).callKind).toBe('voice');

            // Trigger the voice→video upgrade.
            await service.requestVideoUpgrade();
            // Apply the matching kind-25051 with a video m-line so the
            // upgrade is treated as accepted.
            const renegAnswer: NostrEvent = {
                kind: NIP_AC_KIND_ANSWER,
                pubkey: peerHex,
                created_at: Math.floor(Date.now() / 1000),
                content:
                    'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\na=sendrecv\r\n',
                tags: [
                    ['p', selfHex],
                    ['call-id', callId],
                    ['alt', 'WebRTC call answer']
                ],
                id: 'inner-25051-upgrade-history',
                sig: ''
            };
            await service.handleNipAcEvent(renegAnswer);
            expect(get(voiceCallState).callKind).toBe('video');
            createCallEventSpy.mockClear();

            // Now hang up — the resulting `ended` rumor should be
            // authored with callMediaType='video'.
            service.hangup();

            expect(createCallEventSpy).toHaveBeenCalledTimes(1);
            const args = createCallEventSpy.mock.calls[0];
            // signature: (recipientNpub, type, duration, callId, initiatorNpub, callMediaType)
            expect(args[1]).toBe('ended');
            expect(args[5]).toBe('video');
        });

        it('self-renegotiate ignored regardless of status (handled in Messaging.ts)', async () => {
            // The self-event filter lives in Messaging.handleNipAcWrap;
            // VoiceCallService.handleNipAcEvent should never see a
            // self-renegotiate. This test documents the contract: if
            // somehow a self-renegotiate reaches us, the kind-specific
            // status guard alone would still drop it because
            // pubkey-equality with self is irrelevant here. We simulate
            // by checking that handleRenegotiate's normal status guard
            // applies independently of pubkey identity.
            const senders = noopSenders();
            service.registerNipAcSenders(senders);

            const inner = buildRenegotiateInner({
                peerHex: PEER_HEX,
                selfHex: '5'.repeat(64),
                callId: 'no-active-call'
            });
            // Status is idle (no bringUpActiveVoiceCall).
            await service.handleNipAcEvent(inner);

            expect(senders.sendAnswer).not.toHaveBeenCalled();
        });
    });
});
