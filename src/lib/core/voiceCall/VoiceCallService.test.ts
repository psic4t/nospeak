import { describe, it, expect, vi, beforeEach } from 'vitest';

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

vi.mock('$lib/core/voiceCall/androidVoiceCallPlugin', () => ({
    AndroidVoiceCall: {
        startCallSession: (opts: any) => startCallSessionSpy(opts),
        endCallSession: () => endCallSessionSpy(),
        getPendingIncomingCall: vi.fn().mockResolvedValue({ pending: null }),
        clearPendingIncomingCall: vi.fn().mockResolvedValue(undefined),
        canUseFullScreenIntent: vi.fn().mockResolvedValue({ granted: true }),
        requestFullScreenIntentPermission: vi.fn().mockResolvedValue(undefined),
        addListener: vi.fn().mockResolvedValue({ remove: () => {} })
    }
}));

vi.mock('@capacitor/core', async (importOriginal) => {
    const actual = await importOriginal() as any;
    return {
        ...actual,
        Capacitor: {
            ...actual.Capacitor,
            getPlatform: vi.fn().mockReturnValue('android')
        }
    };
});

import { VoiceCallService } from './VoiceCallService';
import { resetCall, setIncomingRinging } from '$lib/stores/voiceCall';
import type { VoiceCallSignal } from './types';

describe('VoiceCallService', () => {
    let service: VoiceCallService;

    beforeEach(() => {
        vi.clearAllMocks();
        resetCall();
        service = new VoiceCallService();
    });

    describe('isVoiceCallSignal', () => {
        it('should identify valid voice call signals', () => {
            const signal: VoiceCallSignal = {
                type: 'voice-call',
                action: 'offer',
                callId: 'abc123',
                sdp: 'v=0...'
            };
            expect(service.isVoiceCallSignal(JSON.stringify(signal))).toBe(true);
        });

        it('should reject non-voice-call content', () => {
            expect(service.isVoiceCallSignal('Hello, world!')).toBe(false);
            expect(service.isVoiceCallSignal('{"type":"text"}')).toBe(false);
            expect(service.isVoiceCallSignal('')).toBe(false);
        });

        it('should reject malformed JSON', () => {
            expect(service.isVoiceCallSignal('{invalid')).toBe(false);
        });

        it('should reject signals missing required fields', () => {
            expect(service.isVoiceCallSignal('{"type":"voice-call"}')).toBe(false);
            expect(service.isVoiceCallSignal('{"type":"voice-call","action":"offer"}')).toBe(false);
        });
    });

    describe('parseSignal', () => {
        it('should parse valid signal content', () => {
            const signal: VoiceCallSignal = {
                type: 'voice-call',
                action: 'offer',
                callId: 'abc123',
                sdp: 'v=0...'
            };
            const parsed = service.parseSignal(JSON.stringify(signal));
            expect(parsed).toEqual(signal);
        });

        it('should return null for invalid content', () => {
            expect(service.parseSignal('not json')).toBeNull();
            expect(service.parseSignal('{"type":"text"}')).toBeNull();
        });
    });

    describe('generateCallId', () => {
        it('should generate a hex string', () => {
            const id = service.generateCallId();
            expect(id).toMatch(/^[0-9a-f]{32}$/);
        });

        it('should generate unique IDs', () => {
            const id1 = service.generateCallId();
            const id2 = service.generateCallId();
            expect(id1).not.toBe(id2);
        });
    });

    describe('handleOffer dedup', () => {
        it('ignores a duplicate offer for the same callId and same peerNpub', async () => {
            const senderNpub = 'npub1xyz';
            const callId = 'abc123';

            // Pre-seed the store directly, bypassing the first-offer flow
            // (which would require a full RTCPeerConnection mock).
            setIncomingRinging(senderNpub, callId);

            const sendSignalSpy = vi.fn();
            service.registerSignalSender(sendSignalSpy);

            // Duplicate offer with same callId/sender should NOT trigger a busy reply
            // AND must short-circuit before createPeerConnection (which is undefined in jsdom).
            const signal: VoiceCallSignal = {
                type: 'voice-call',
                action: 'offer',
                callId,
                sdp: 'v=0\r\no=- 1 1 IN IP4 0\r\n...'
            };

            // If the dedup check works, this resolves cleanly with no signal sent
            // and no RTCPeerConnection call. If it doesn't, this throws ReferenceError
            // (the busy-reply path doesn't touch RTCPeerConnection, but the
            // not-idle-and-different-call path does — so we expect a clean resolve).
            await expect(service.handleSignal(signal, senderNpub)).resolves.toBeUndefined();

            const busyCall = sendSignalSpy.mock.calls.find(call => {
                try {
                    const parsed = JSON.parse(call[1]);
                    return parsed.action === 'busy';
                } catch { return false; }
            });
            expect(busyCall).toBeUndefined();
        });

        it('still sends busy when a different callId arrives during incoming-ringing', async () => {
            const senderA = 'npub1aaa';

            setIncomingRinging(senderA, 'aaa');

            const sendSignalSpy = vi.fn();
            service.registerSignalSender(sendSignalSpy);

            const offerB: VoiceCallSignal = {
                type: 'voice-call', action: 'offer', callId: 'bbb', sdp: 'sdpB'
            };

            // The busy-reply path in current code returns early after sendSignal,
            // BEFORE createPeerConnection — so this should NOT throw ReferenceError
            // even in jsdom. (Verify by reading VoiceCallService.ts handleOffer.)
            await service.handleSignal(offerB, senderA);
            // Note: senderA is intentional. Even though offerB has callId='bbb',
            // handleSignal dispatches based on the senderNpub argument provided.
            // Same caller (senderA) sending a different callId is the realistic
            // scenario for "busy".

            const busyCall = sendSignalSpy.mock.calls.find(call => {
                try {
                    const parsed = JSON.parse(call[1]);
                    return parsed.action === 'busy';
                } catch { return false; }
            });
            expect(busyCall).toBeDefined();
            expect(busyCall![0]).toBe(senderA);
        });
    });

    describe('Android session lifecycle', () => {
        beforeEach(() => {
            startCallSessionSpy.mockClear();
            endCallSessionSpy.mockClear();

            // Minimal RTCPeerConnection stub for jsdom (must be a real
            // constructor — vi.fn().mockImplementation isn't `new`-able).
            (globalThis as any).RTCPeerConnection = function () {
                this.onicecandidate = null;
                this.ontrack = null;
                this.oniceconnectionstatechange = null;
                this.addTrack = vi.fn();
                this.setRemoteDescription = vi.fn().mockResolvedValue(undefined);
                this.setLocalDescription = vi.fn().mockResolvedValue(undefined);
                this.createOffer = vi.fn().mockResolvedValue({ sdp: 'v=0', type: 'offer' });
                this.createAnswer = vi.fn().mockResolvedValue({ sdp: 'v=0', type: 'answer' });
                this.addIceCandidate = vi.fn().mockResolvedValue(undefined);
                this.close = vi.fn();
                this.iceConnectionState = 'new';
                (globalThis as any).__lastPeerConnection = this;
            };
            (globalThis as any).RTCSessionDescription = function (init: any) {
                Object.assign(this, init);
            };
            (globalThis as any).RTCIceCandidate = function (init: any) {
                Object.assign(this, init);
            };

            // Stub getUserMedia so initiateCall/acceptCall can proceed.
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
        });

        it('calls startCallSession with role=outgoing when initiateCall enters outgoing-ringing', async () => {
            const recipientNpub = 'npub1recipient';

            const sendSignalSpy = vi.fn();
            service.registerSignalSender(sendSignalSpy);

            await service.initiateCall(recipientNpub);

            expect(startCallSessionSpy).toHaveBeenCalledTimes(1);
            const args = startCallSessionSpy.mock.calls[0][0];
            expect(args.role).toBe('outgoing');
            expect(args.peerNpub).toBe(recipientNpub);
            expect(args.callId).toBeTruthy();
        });

        it('calls startCallSession with role=incoming when acceptCall enters connecting', async () => {
            const senderNpub = 'npub1sender';
            const callId = 'inc1';

            const sendSignalSpy = vi.fn();
            service.registerSignalSender(sendSignalSpy);

            // Use a real handleSignal call so the service has a peer connection
            // and remote description set up; the stubs above let it complete.
            const offer: VoiceCallSignal = {
                type: 'voice-call', action: 'offer', callId, sdp: 'v=0\r\n...'
            };
            await service.handleSignal(offer, senderNpub);
            // Ignore any startCallSession call from handleOffer (there shouldn't
            // be one in current code, but clear to be safe).
            startCallSessionSpy.mockClear();

            await service.acceptCall();

            expect(startCallSessionSpy).toHaveBeenCalledTimes(1);
            const args = startCallSessionSpy.mock.calls[0][0];
            expect(args.role).toBe('incoming');
            expect(args.peerNpub).toBe(senderNpub);
            expect(args.callId).toBe(callId);
        });

        it('calls endCallSession when call transitions to ended via hangup', async () => {
            const recipientNpub = 'npub1recipient';

            const sendSignalSpy = vi.fn();
            service.registerSignalSender(sendSignalSpy);

            await service.initiateCall(recipientNpub);
            startCallSessionSpy.mockClear();
            endCallSessionSpy.mockClear();

            await service.hangup();

            expect(endCallSessionSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe('ICE trickle gating', () => {
        beforeEach(() => {
            startCallSessionSpy.mockClear();
            endCallSessionSpy.mockClear();

            (globalThis as any).RTCPeerConnection = function () {
                this.onicecandidate = null;
                this.ontrack = null;
                this.oniceconnectionstatechange = null;
                this.addTrack = vi.fn();
                this.setRemoteDescription = vi.fn().mockResolvedValue(undefined);
                this.setLocalDescription = vi.fn().mockResolvedValue(undefined);
                this.createOffer = vi.fn().mockResolvedValue({ sdp: 'v=0', type: 'offer' });
                this.createAnswer = vi.fn().mockResolvedValue({ sdp: 'v=0', type: 'answer' });
                this.addIceCandidate = vi.fn().mockResolvedValue(undefined);
                this.close = vi.fn();
                this.iceConnectionState = 'new';
                (globalThis as any).__lastPeerConnection = this;
            };
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
        });

        function countIceCandidateSignals(spy: ReturnType<typeof vi.fn>): number {
            return spy.mock.calls.filter(call => {
                try {
                    const parsed = JSON.parse(call[1]);
                    return parsed.action === 'ice-candidate';
                } catch { return false; }
            }).length;
        }

        function fakeCandidate(foundation: string) {
            return {
                candidate: `candidate:${foundation} 1 udp 2122260223 192.168.1.42 54321 typ host`,
                sdpMid: '0',
                sdpMLineIndex: 0,
                toJSON() {
                    return {
                        candidate: this.candidate,
                        sdpMid: this.sdpMid,
                        sdpMLineIndex: this.sdpMLineIndex
                    };
                }
            };
        }

        it('forwards candidates while gathering, before connection is established', async () => {
            const sendSignalSpy = vi.fn();
            service.registerSignalSender(sendSignalSpy);

            await service.initiateCall('npub1recipient');
            const pc = (globalThis as any).__lastPeerConnection;
            expect(pc.onicecandidate).toBeTypeOf('function');

            pc.onicecandidate({ candidate: fakeCandidate('1') });

            expect(countIceCandidateSignals(sendSignalSpy)).toBe(1);
        });

        it('stops forwarding once iceConnectionState reaches connected', async () => {
            const sendSignalSpy = vi.fn();
            service.registerSignalSender(sendSignalSpy);

            await service.initiateCall('npub1recipient');
            const pc = (globalThis as any).__lastPeerConnection;

            // First candidate trickles through.
            pc.onicecandidate({ candidate: fakeCandidate('1') });
            expect(countIceCandidateSignals(sendSignalSpy)).toBe(1);

            // Connection comes up.
            pc.iceConnectionState = 'connected';
            pc.oniceconnectionstatechange();

            // Subsequent candidates must NOT be signaled.
            pc.onicecandidate({ candidate: fakeCandidate('2') });
            pc.onicecandidate({ candidate: fakeCandidate('3') });

            expect(countIceCandidateSignals(sendSignalSpy)).toBe(1);
        });

        it('stops forwarding once iceConnectionState reaches completed', async () => {
            const sendSignalSpy = vi.fn();
            service.registerSignalSender(sendSignalSpy);

            await service.initiateCall('npub1recipient');
            const pc = (globalThis as any).__lastPeerConnection;

            pc.onicecandidate({ candidate: fakeCandidate('1') });
            expect(countIceCandidateSignals(sendSignalSpy)).toBe(1);

            pc.iceConnectionState = 'completed';
            pc.oniceconnectionstatechange();

            pc.onicecandidate({ candidate: fakeCandidate('2') });

            expect(countIceCandidateSignals(sendSignalSpy)).toBe(1);
        });

        it('re-arms trickle gating on the next call', async () => {
            const sendSignalSpy = vi.fn();
            service.registerSignalSender(sendSignalSpy);

            // First call: connect, then end via hangup.
            await service.initiateCall('npub1recipient');
            let pc = (globalThis as any).__lastPeerConnection;
            pc.onicecandidate({ candidate: fakeCandidate('1') });
            pc.iceConnectionState = 'connected';
            pc.oniceconnectionstatechange();
            await service.hangup();

            sendSignalSpy.mockClear();
            resetCall();

            // Second call: a candidate emitted before connection MUST trickle again.
            await service.initiateCall('npub1recipient2');
            pc = (globalThis as any).__lastPeerConnection;
            pc.onicecandidate({ candidate: fakeCandidate('2') });

            expect(countIceCandidateSignals(sendSignalSpy)).toBe(1);
        });
    });

    describe('synchronous cancellation', () => {
        // Regression coverage for the desktop-PWA bug where awaiting the
        // hangup/reject signal publish (which can take up to 5 s on cold
        // relays) kept the ActiveCallOverlay on screen long after the user
        // tapped the cancel button. After the fix, hangup() and declineCall()
        // must dismiss the UI synchronously and let the signal publish in the
        // background.
        beforeEach(() => {
            startCallSessionSpy.mockClear();
            endCallSessionSpy.mockClear();

            (globalThis as any).RTCPeerConnection = function () {
                this.onicecandidate = null;
                this.ontrack = null;
                this.oniceconnectionstatechange = null;
                this.addTrack = vi.fn();
                this.setRemoteDescription = vi.fn().mockResolvedValue(undefined);
                this.setLocalDescription = vi.fn().mockResolvedValue(undefined);
                this.createOffer = vi.fn().mockResolvedValue({ sdp: 'v=0', type: 'offer' });
                this.createAnswer = vi.fn().mockResolvedValue({ sdp: 'v=0', type: 'answer' });
                this.addIceCandidate = vi.fn().mockResolvedValue(undefined);
                this.close = vi.fn();
                this.iceConnectionState = 'new';
            };
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
        });

        it('hangup() during outgoing-ringing dismisses the call synchronously even if the signal publish never resolves', async () => {
            // The signalSender starts as a resolving stub so initiateCall()'s
            // own offer publish completes; then we swap to a never-resolving
            // stub for the hangup test to simulate a cold relay where
            // publishWithDeadline is still waiting for connection.
            let signalImpl: (...args: any[]) => Promise<void> = vi.fn().mockResolvedValue(undefined);
            const sendSignalSpy = vi.fn((...args: any[]) => signalImpl(...args));
            service.registerSignalSender(sendSignalSpy);

            await service.initiateCall('npub1recipient');
            const { get } = await import('svelte/store');
            const { voiceCallState } = await import('$lib/stores/voiceCall');
            expect(get(voiceCallState).status).toBe('outgoing-ringing');

            // Now make any further publishes hang — only the hangup signal
            // is published from this point on, so this isolates the test.
            signalImpl = () => new Promise(() => {});

            // Capture state synchronously after hangup() returns. On the
            // pre-fix (awaiting) code, this would still read 'outgoing-ringing'
            // until the publish settled or the 5 s deadline tripped.
            service.hangup();
            expect(get(voiceCallState).status).toBe('ended');
            expect(get(voiceCallState).endReason).toBe('hangup');

            // The hangup signal was still dispatched (fire-and-forget).
            const hangupCall = sendSignalSpy.mock.calls.find(c => {
                try { return JSON.parse(c[1]).action === 'hangup'; } catch { return false; }
            });
            expect(hangupCall).toBeDefined();
        });

        it('declineCall() during incoming-ringing dismisses synchronously even if the signal publish never resolves', async () => {
            // declineCall doesn't run any publishes prior to its own reject
            // signal, so we can register a never-resolving stub directly.
            const hangingSendSignal = vi.fn().mockReturnValue(new Promise(() => {}));
            service.registerSignalSender(hangingSendSignal);

            setIncomingRinging('npub1sender', 'callId-decline-sync');

            const { get } = await import('svelte/store');
            const { voiceCallState } = await import('$lib/stores/voiceCall');
            expect(get(voiceCallState).status).toBe('incoming-ringing');

            service.declineCall();
            expect(get(voiceCallState).status).toBe('ended');
            expect(get(voiceCallState).endReason).toBe('rejected');

            const rejectCall = hangingSendSignal.mock.calls.find(c => {
                try { return JSON.parse(c[1]).action === 'reject'; } catch { return false; }
            });
            expect(rejectCall).toBeDefined();
        });

        it('hangup() during an active call still authors the ended call event without blocking the UI', async () => {
            // Same swap-after-initiate pattern as the outgoing-ringing test:
            // initiateCall must be able to publish its offer; then we make
            // both sendSignal and createCallEvent hang to assert that
            // hangup() doesn't depend on either to dismiss the UI.
            let signalImpl: (...args: any[]) => Promise<void> = vi.fn().mockResolvedValue(undefined);
            const sendSignalSpy = vi.fn((...args: any[]) => signalImpl(...args));
            service.registerSignalSender(sendSignalSpy);

            const hangingCreateCallEvent = vi.fn().mockReturnValue(new Promise(() => {}));
            service.registerCallEventCreator(hangingCreateCallEvent);

            await service.initiateCall('npub1recipient');
            const { setActive, voiceCallState } = await import('$lib/stores/voiceCall');
            const { get } = await import('svelte/store');
            setActive();
            expect(get(voiceCallState).status).toBe('active');

            // From here on, every signal publish hangs.
            signalImpl = () => new Promise(() => {});

            service.hangup();
            // UI dismissed without waiting on either pending promise.
            expect(get(voiceCallState).status).toBe('ended');
            expect(get(voiceCallState).endReason).toBe('hangup');

            // createCallEvent was still invoked (fire-and-forget) with the
            // recipient npub captured before endCall ran.
            expect(hangingCreateCallEvent).toHaveBeenCalledTimes(1);
            const args = hangingCreateCallEvent.mock.calls[0];
            expect(args[0]).toBe('npub1recipient');
            expect(args[1]).toBe('ended');
        });
    });
});
