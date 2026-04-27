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
});
