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

import { VoiceCallService } from './VoiceCallService';
import { resetCall } from '$lib/stores/voiceCall';
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
});
