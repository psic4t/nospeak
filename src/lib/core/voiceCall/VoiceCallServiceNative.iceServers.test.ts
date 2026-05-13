/**
 * Verifies that {@code VoiceCallServiceNative} forwards the runtime
 * config iceServers list to the Android plugin on every entry point
 * that can construct a native peer connection ({@code initiateCall} and
 * {@code acceptCall}). Part of
 * {@code fix-android-ice-servers-from-runtime-config}.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { nip19 } from 'nostr-tools';

// Mock the Capacitor plugin BEFORE importing the service so the
// service's import binds to the mocked module. Mocks must be created
// inside vi.hoisted (vi.mock factories run before all const/let in
// the module body).
const mocks = vi.hoisted(() => {
    return {
        initiateCallMock: vi.fn().mockResolvedValue(undefined),
        acceptCallMock: vi.fn().mockResolvedValue(undefined),
        declineCallMock: vi.fn().mockResolvedValue(undefined),
        addListenerMock: vi.fn().mockResolvedValue({ remove: vi.fn() })
    };
});

vi.mock('./androidVoiceCallPlugin', () => ({
    AndroidVoiceCall: {
        initiateCall: mocks.initiateCallMock,
        acceptCall: mocks.acceptCallMock,
        declineCall: mocks.declineCallMock,
        hangup: vi.fn().mockResolvedValue(undefined),
        toggleMute: vi.fn().mockResolvedValue(undefined),
        toggleSpeaker: vi.fn().mockResolvedValue(undefined),
        toggleCamera: vi.fn().mockResolvedValue(undefined),
        flipCamera: vi.fn().mockResolvedValue(undefined),
        requestVideoUpgrade: vi.fn().mockResolvedValue(undefined),
        dismissIncomingCall: vi.fn().mockResolvedValue(undefined),
        addListener: mocks.addListenerMock
    }
}));

// AndroidMicrophone / AndroidCamera permission stubs — grant by default.
vi.mock('$lib/core/AndroidMicrophone', () => ({
    AndroidMicrophone: {
        requestPermission: vi.fn().mockResolvedValue({ granted: true })
    }
}));
vi.mock('$lib/core/AndroidCamera', () => ({
    AndroidCamera: {
        requestPermission: vi.fn().mockResolvedValue({ granted: true })
    }
}));

// Profile lookup stub — returns no profile, so the service uses the
// shortened-npub fallback for peerName.
vi.mock('$lib/db/ProfileRepository', () => ({
    profileRepo: {
        getProfileIgnoreTTL: vi.fn().mockResolvedValue(null)
    }
}));

import { VoiceCallServiceNative } from './VoiceCallServiceNative';
import {
    voiceCallState,
    setIncomingRinging,
    resetCall
} from '$lib/stores/voiceCall';
import { getIceServersJson } from '$lib/core/runtimeConfig/store';

function makeNpub(): { npub: string; hex: string } {
    const hex = '0'.repeat(64);
    const npub = nip19.npubEncode(hex);
    return { npub, hex };
}

describe('VoiceCallServiceNative iceServers wire-through', () => {
    beforeEach(() => {
        mocks.initiateCallMock.mockClear();
        mocks.acceptCallMock.mockClear();
        mocks.declineCallMock.mockClear();
        mocks.addListenerMock.mockClear();
        resetCall();
    });

    it('forwards iceServersJson on initiateCall matching the current runtime config', async () => {
        const service = new VoiceCallServiceNative();
        const { npub } = makeNpub();

        await service.initiateCall(npub, 'voice');

        expect(mocks.initiateCallMock).toHaveBeenCalledTimes(1);
        const args = mocks.initiateCallMock.mock.calls[0][0];
        expect(typeof args.iceServersJson).toBe('string');
        expect(args.iceServersJson).toBe(getIceServersJson());
        // Sanity: not the empty list.
        expect(args.iceServersJson.length).toBeGreaterThan(2);
        const parsed = JSON.parse(args.iceServersJson);
        expect(Array.isArray(parsed)).toBe(true);
        expect(parsed.length).toBeGreaterThan(0);
    });

    it('forwards iceServersJson on acceptCall matching the current runtime config', async () => {
        const service = new VoiceCallServiceNative();
        const { npub } = makeNpub();

        // Move the store into incoming-ringing so acceptCall's guard passes.
        setIncomingRinging(npub, 'callid123', 'voice');
        expect(get(voiceCallState).status).toBe('incoming-ringing');

        await service.acceptCall();

        expect(mocks.acceptCallMock).toHaveBeenCalledTimes(1);
        const args = mocks.acceptCallMock.mock.calls[0][0];
        expect(typeof args.iceServersJson).toBe('string');
        expect(args.iceServersJson).toBe(getIceServersJson());
        const parsed = JSON.parse(args.iceServersJson);
        expect(Array.isArray(parsed)).toBe(true);
        expect(parsed.length).toBeGreaterThan(0);
    });

    it('produces byte-identical iceServersJson on initiateCall and acceptCall in the same session', async () => {
        const service = new VoiceCallServiceNative();
        const { npub } = makeNpub();

        await service.initiateCall(npub, 'voice');
        const initiateJson = mocks.initiateCallMock.mock.calls[0][0].iceServersJson;

        resetCall();
        setIncomingRinging(npub, 'callid456', 'voice');
        await service.acceptCall();
        const acceptJson = mocks.acceptCallMock.mock.calls[0][0].iceServersJson;

        expect(initiateJson).toBe(acceptJson);
    });
});
