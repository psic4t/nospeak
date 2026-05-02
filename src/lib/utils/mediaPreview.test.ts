import { describe, it, expect, vi } from 'vitest';

// Mock the i18n module
vi.mock('$lib/i18n', () => ({
    t: {
        subscribe: vi.fn((fn) => {
            fn((key: string) => {
                const translations: Record<string, string> = {
                    'contacts.mediaPreview.voiceMessage': 'Voice Message',
                    'contacts.mediaPreview.image': 'Image',
                    'contacts.mediaPreview.video': 'Video',
                    'contacts.mediaPreview.audio': 'Audio',
                    'contacts.mediaPreview.file': 'File',
                    'contacts.mediaPreview.location': 'Location',
                    'voiceCall.pill.missed': 'Missed voice call',
                    'voiceCall.pill.ended': 'Voice call ended',
                    'voiceCall.pill.endedWithDuration': 'Voice call ended \u2022 {duration}',
                    'voiceCall.pill.noAnswerByPeer': 'No answer',
                    'voiceCall.pill.noAnswerMe': 'Missed voice call',
                    'voiceCall.pill.declinedByPeer': 'Call declined',
                    'voiceCall.pill.declinedByMe': 'Declined',
                    'voiceCall.pill.busyByPeer': 'User busy',
                    'voiceCall.pill.busyMe': 'Missed voice call (busy)',
                    'voiceCall.pill.failed': 'Connection failed',
                    'voiceCall.pill.cancelled': 'Cancelled',
                    'voiceCall.pill.generic': 'Voice call',
                    // Video overrides — only the keys that need to differ
                    // from voice copy. Keys without an override fall back
                    // to the voice key via resolvePillKey, which is the
                    // contract this test mock encodes by simply returning
                    // the lookup key when not present in `translations`.
                    'voiceCall.pill.video.missed': 'Missed video call',
                    'voiceCall.pill.video.ended': 'Video call ended',
                    'voiceCall.pill.video.endedWithDuration': 'Video call ended \u2022 {duration}',
                    'voiceCall.pill.video.noAnswerMe': 'Missed video call',
                    'voiceCall.pill.video.busyMe': 'Missed video call (busy)',
                    'voiceCall.pill.video.generic': 'Video call'
                };
                // Return the raw key on miss so the resolvePillKey
                // fallback (key === translated → use voice copy) is
                // exercised exactly as in production svelte-i18n.
                return translations[key] !== undefined ? translations[key] : key;
            });
            return () => {};
        })
    }
}));

import {
    getMediaPreviewLabel,
    getLocationPreviewLabel,
    getCallEventPreviewLabel
} from './mediaPreview';

describe('getMediaPreviewLabel', () => {
    it('returns voice message label for audio/webm', () => {
        expect(getMediaPreviewLabel('audio/webm')).toBe('🎤 Voice Message');
    });

    it('returns voice message label for audio/ogg', () => {
        expect(getMediaPreviewLabel('audio/ogg')).toBe('🎤 Voice Message');
    });

    it('returns voice message label for audio/mp4 (m4a)', () => {
        expect(getMediaPreviewLabel('audio/mp4')).toBe('🎤 Voice Message');
    });

    it('returns voice message label for audio/x-m4a', () => {
        expect(getMediaPreviewLabel('audio/x-m4a')).toBe('🎤 Voice Message');
    });

    it('returns voice message label for codecs containing opus', () => {
        expect(getMediaPreviewLabel('audio/ogg; codecs=opus')).toBe('🎤 Voice Message');
    });

    it('returns image label for image/* types', () => {
        expect(getMediaPreviewLabel('image/jpeg')).toBe('📷 Image');
        expect(getMediaPreviewLabel('image/png')).toBe('📷 Image');
        expect(getMediaPreviewLabel('image/gif')).toBe('📷 Image');
        expect(getMediaPreviewLabel('image/webp')).toBe('📷 Image');
    });

    it('returns video label for video/* types', () => {
        expect(getMediaPreviewLabel('video/mp4')).toBe('🎬 Video');
        expect(getMediaPreviewLabel('video/webm')).toBe('🎬 Video');
        expect(getMediaPreviewLabel('video/quicktime')).toBe('🎬 Video');
    });

    it('returns audio label for other audio/* types (music)', () => {
        expect(getMediaPreviewLabel('audio/mpeg')).toBe('🎵 Audio');
        expect(getMediaPreviewLabel('audio/mp3')).toBe('🎵 Audio');
        expect(getMediaPreviewLabel('audio/wav')).toBe('🎵 Audio');
    });

    it('returns file label for unknown types', () => {
        expect(getMediaPreviewLabel('application/pdf')).toBe('📎 File');
        expect(getMediaPreviewLabel('application/zip')).toBe('📎 File');
        expect(getMediaPreviewLabel('text/plain')).toBe('📎 File');
    });
});

describe('getCallEventPreviewLabel', () => {
    const me = 'npub1me';
    const peer = 'npub1peer';

    // Symmetric outcomes
    it('formats missed (local-only on callee)', () => {
        expect(getCallEventPreviewLabel('missed', undefined, peer, me))
            .toBe('📞 Missed voice call');
    });

    it('formats cancelled (local-only on caller)', () => {
        expect(getCallEventPreviewLabel('cancelled', undefined, me, me))
            .toBe('📞 Cancelled');
    });

    it('formats ended without duration', () => {
        expect(getCallEventPreviewLabel('ended', undefined, me, me))
            .toBe('📞 Voice call ended');
    });

    it('formats ended with duration as MM:SS', () => {
        expect(getCallEventPreviewLabel('ended', 83, me, me))
            .toBe('📞 Voice call ended • 1:23');
    });

    it('pads ended duration seconds to two digits', () => {
        expect(getCallEventPreviewLabel('ended', 65, me, me))
            .toBe('📞 Voice call ended • 1:05');
        expect(getCallEventPreviewLabel('ended', 9, me, me))
            .toBe('📞 Voice call ended • 0:09');
    });

    it('treats ended with duration 0 as ended without duration', () => {
        expect(getCallEventPreviewLabel('ended', 0, me, me))
            .toBe('📞 Voice call ended');
    });

    it('formats failed', () => {
        expect(getCallEventPreviewLabel('failed', undefined, me, me))
            .toBe('📞 Connection failed');
    });

    // Asymmetric outcomes — initiator side
    it('formats declined as "Call declined" when local user is initiator', () => {
        expect(getCallEventPreviewLabel('declined', undefined, me, me))
            .toBe('📞 Call declined');
    });

    it('formats busy as "User busy" when local user is initiator', () => {
        expect(getCallEventPreviewLabel('busy', undefined, me, me))
            .toBe('📞 User busy');
    });

    it('formats no-answer as "No answer" when local user is initiator', () => {
        expect(getCallEventPreviewLabel('no-answer', undefined, me, me))
            .toBe('📞 No answer');
    });

    // Asymmetric outcomes — peer side (local user is recipient)
    it('formats declined as "Declined" when peer is initiator', () => {
        expect(getCallEventPreviewLabel('declined', undefined, peer, me))
            .toBe('📞 Declined');
    });

    it('formats busy as "Missed voice call (busy)" when peer is initiator', () => {
        expect(getCallEventPreviewLabel('busy', undefined, peer, me))
            .toBe('📞 Missed voice call (busy)');
    });

    it('formats no-answer as "Missed voice call" when peer is initiator', () => {
        expect(getCallEventPreviewLabel('no-answer', undefined, peer, me))
            .toBe('📞 Missed voice call');
    });

    // Missing currentUserNpub → asymmetric falls through to generic
    it('falls through to generic when currentUserNpub is undefined for asymmetric outcomes', () => {
        expect(getCallEventPreviewLabel('declined', undefined, peer, undefined))
            .toBe('📞 Voice call');
        expect(getCallEventPreviewLabel('busy', undefined, peer, undefined))
            .toBe('📞 Voice call');
        expect(getCallEventPreviewLabel('no-answer', undefined, peer, undefined))
            .toBe('📞 Voice call');
    });

    // Missing callInitiatorNpub → asymmetric falls through to generic
    it('falls through to generic when callInitiatorNpub is undefined for asymmetric outcomes', () => {
        expect(getCallEventPreviewLabel('declined', undefined, undefined, me))
            .toBe('📞 Voice call');
    });

    // Symmetric outcomes don't depend on role
    it('formats missed correctly even without npubs', () => {
        expect(getCallEventPreviewLabel('missed', undefined, undefined, undefined))
            .toBe('📞 Missed voice call');
    });

    it('formats ended with duration even without npubs', () => {
        expect(getCallEventPreviewLabel('ended', 125, undefined, undefined))
            .toBe('📞 Voice call ended • 2:05');
    });

    // Legacy / forward-compat values
    it('falls through to generic for legacy "outgoing"', () => {
        expect(getCallEventPreviewLabel('outgoing', undefined, me, me))
            .toBe('📞 Voice call');
    });

    it('falls through to generic for legacy "incoming"', () => {
        expect(getCallEventPreviewLabel('incoming', undefined, peer, me))
            .toBe('📞 Voice call');
    });

    it('falls through to generic for unknown forward-compat value', () => {
        expect(getCallEventPreviewLabel('some-future-value', undefined, me, me))
            .toBe('📞 Voice call');
    });

    it('falls through to generic for undefined callEventType', () => {
        expect(getCallEventPreviewLabel(undefined, undefined, me, me))
            .toBe('📞 Voice call');
    });

    it('falls through to generic for empty-string callEventType', () => {
        expect(getCallEventPreviewLabel('', undefined, me, me))
            .toBe('📞 Voice call');
    });
});

describe('getCallEventPreviewLabel — video calls', () => {
    const me = 'npub1me';
    const peer = 'npub1peer';

    it('uses 📹 emoji and video copy for missed', () => {
        expect(getCallEventPreviewLabel('missed', undefined, peer, me, 'video'))
            .toBe('📹 Missed video call');
    });

    it('uses 📹 emoji and video copy for ended without duration', () => {
        expect(getCallEventPreviewLabel('ended', undefined, me, me, 'video'))
            .toBe('📹 Video call ended');
    });

    it('uses 📹 emoji and video copy for ended with duration', () => {
        expect(getCallEventPreviewLabel('ended', 83, me, me, 'video'))
            .toBe('📹 Video call ended • 1:23');
    });

    it('uses 📹 emoji and video copy for no-answer (callee side)', () => {
        // Peer initiated → local user is callee → noAnswerMe → 'Missed video call'.
        expect(getCallEventPreviewLabel('no-answer', undefined, peer, me, 'video'))
            .toBe('📹 Missed video call');
    });

    it('uses 📹 emoji and video copy for busy (callee side)', () => {
        expect(getCallEventPreviewLabel('busy', undefined, peer, me, 'video'))
            .toBe('📹 Missed video call (busy)');
    });

    it('uses 📹 emoji and video copy for generic fallback', () => {
        expect(getCallEventPreviewLabel('outgoing', undefined, me, me, 'video'))
            .toBe('📹 Video call');
        expect(getCallEventPreviewLabel(undefined, undefined, me, me, 'video'))
            .toBe('📹 Video call');
    });

    // Media-neutral keys: video calls reuse the same English copy as
    // voice calls because there is no `voiceCall.pill.video.*` override
    // for them. Only the emoji distinguishes the rows in the chat list.
    it('shares declined copy with voice calls but switches the emoji', () => {
        expect(getCallEventPreviewLabel('declined', undefined, me, me, 'video'))
            .toBe('📹 Call declined');
        expect(getCallEventPreviewLabel('declined', undefined, peer, me, 'video'))
            .toBe('📹 Declined');
    });

    it('shares busyByPeer / noAnswerByPeer / failed / cancelled copy with voice calls', () => {
        expect(getCallEventPreviewLabel('busy', undefined, me, me, 'video'))
            .toBe('📹 User busy');
        expect(getCallEventPreviewLabel('no-answer', undefined, me, me, 'video'))
            .toBe('📹 No answer');
        expect(getCallEventPreviewLabel('failed', undefined, me, me, 'video'))
            .toBe('📹 Connection failed');
        expect(getCallEventPreviewLabel('cancelled', undefined, me, me, 'video'))
            .toBe('📹 Cancelled');
    });

    it("treats explicit 'voice' identically to undefined media type", () => {
        expect(getCallEventPreviewLabel('ended', 83, me, me, 'voice'))
            .toBe('📞 Voice call ended • 1:23');
        expect(getCallEventPreviewLabel('ended', 83, me, me))
            .toBe('📞 Voice call ended • 1:23');
    });
});

describe('resolvePillKey — video fallback to voice', () => {
    // Locale that has no video overrides — every video.* lookup misses
    // and the helper must return the voice key's translation, NOT the
    // raw key string.
    const trVoiceOnly = (key: string): string => {
        const voiceOnly: Record<string, string> = {
            'voiceCall.pill.missed': 'Sprachanruf verpasst',
            'voiceCall.pill.ended': 'Sprachanruf beendet',
            'voiceCall.pill.generic': 'Sprachanruf'
        };
        return voiceOnly[key] !== undefined ? voiceOnly[key] : key;
    };

    it('falls back to localized voice copy when video override is missing', async () => {
        const { resolvePillKey } = await import('./mediaPreview');
        expect(resolvePillKey(trVoiceOnly, 'missed', 'video'))
            .toBe('Sprachanruf verpasst');
        expect(resolvePillKey(trVoiceOnly, 'ended', 'video'))
            .toBe('Sprachanruf beendet');
        expect(resolvePillKey(trVoiceOnly, 'generic', 'video'))
            .toBe('Sprachanruf');
    });

    it("returns voice translation when callMediaType is 'voice' or undefined", async () => {
        const { resolvePillKey } = await import('./mediaPreview');
        expect(resolvePillKey(trVoiceOnly, 'missed', 'voice'))
            .toBe('Sprachanruf verpasst');
        expect(resolvePillKey(trVoiceOnly, 'missed', undefined))
            .toBe('Sprachanruf verpasst');
    });
});

describe('getLocationPreviewLabel', () => {
    it('returns location label', () => {
        expect(getLocationPreviewLabel()).toBe('📍 Location');
    });
});
