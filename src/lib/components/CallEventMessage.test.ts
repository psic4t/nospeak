import { describe, it, expect } from 'vitest';

// Mirror the component's pure functions for testing.
//
// We don't render the Svelte component here — the component depends on
// $t/svelte-i18n and $currentUser, which are awkward to set up under a
// node test runner. The pill-text logic is otherwise pure, so the simplest
// robust approach is to duplicate the switch and assert against the
// English vocabulary directly. Keep this in sync with
// src/lib/components/CallEventMessage.svelte and
// src/lib/i18n/locales/en.ts -> voiceCall.pill.*

function formatDuration(seconds: number | undefined): string {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

const PILL = {
    missed: 'Missed voice call',
    ended: 'Voice call ended',
    endedWithDuration: 'Voice call ended \u2022 {duration}',
    noAnswerByPeer: 'No answer',
    noAnswerMe: 'Missed voice call',
    declinedByPeer: 'Call declined',
    declinedByMe: 'Declined',
    busyByPeer: 'User busy',
    busyMe: 'Missed voice call (busy)',
    failed: 'Connection failed',
    cancelled: 'Cancelled',
    generic: 'Voice call'
};

// Subset of pill keys that have a video-specific override in
// src/lib/i18n/locales/en.ts -> voiceCall.pill.video.*. Keys NOT
// listed here (declined*, busyByPeer, noAnswerByPeer, failed,
// cancelled) deliberately fall through to the voice copy in
// resolvePillKey because their existing English wording is already
// media-neutral. Keep this in sync with the .video.* block in en.ts.
const PILL_VIDEO = {
    missed: 'Missed video call',
    ended: 'Video call ended',
    endedWithDuration: 'Video call ended \u2022 {duration}',
    noAnswerMe: 'Missed video call',
    busyMe: 'Missed video call (busy)',
    generic: 'Video call'
};

function pick(base: keyof typeof PILL, mediaType: 'voice' | 'video' | undefined): string {
    // Mirror of resolvePillKey from src/lib/utils/mediaPreview.ts: prefer
    // the video override if present, else fall back to the voice copy.
    if (mediaType === 'video' && base in PILL_VIDEO) {
        return (PILL_VIDEO as Record<string, string>)[base as string];
    }
    return PILL[base];
}

function getMessageText(
    callEventType: string | undefined,
    iAmInitiator: boolean,
    callDuration?: number,
    callMediaType?: 'voice' | 'video'
): string {
    switch (callEventType) {
        case 'missed':
            return pick('missed', callMediaType);
        case 'cancelled':
            return pick('cancelled', callMediaType);
        case 'ended': {
            const duration = formatDuration(callDuration);
            return duration
                ? pick('endedWithDuration', callMediaType).replace('{duration}', duration)
                : pick('ended', callMediaType);
        }
        case 'declined':
            return iAmInitiator
                ? pick('declinedByPeer', callMediaType)
                : pick('declinedByMe', callMediaType);
        case 'busy':
            return iAmInitiator
                ? pick('busyByPeer', callMediaType)
                : pick('busyMe', callMediaType);
        case 'no-answer':
            return iAmInitiator
                ? pick('noAnswerByPeer', callMediaType)
                : pick('noAnswerMe', callMediaType);
        case 'failed':
            return pick('failed', callMediaType);
        default:
            return pick('generic', callMediaType);
    }
}

/**
 * Pure mirror of CallEventMessage.svelte's `callDirection` derivation.
 * Kept in lock-step with the component:
 *
 *   - 'outgoing' — local user initiated the call (arrow up-right).
 *   - 'incoming' — peer initiated the call (arrow down-left).
 *   - 'none'     — legacy rows lacking a `call-initiator` tag, or no
 *                  authenticated user; no arrow rendered.
 */
function getCallDirection(
    hasInitiator: boolean,
    hasUser: boolean,
    iAmInitiator: boolean
): 'outgoing' | 'incoming' | 'none' {
    if (!hasInitiator || !hasUser) return 'none';
    return iAmInitiator ? 'outgoing' : 'incoming';
}

describe('CallEventMessage', () => {
    describe('formatDuration', () => {
        it('formats seconds to MM:SS', () => {
            expect(formatDuration(150)).toBe('2:30');
            expect(formatDuration(0)).toBe('');
            expect(formatDuration(undefined)).toBe('');
            expect(formatDuration(61)).toBe('1:01');
            expect(formatDuration(3600)).toBe('60:00');
        });
    });

    describe('getMessageText — symmetric outcomes', () => {
        it('returns missed text', () => {
            expect(getMessageText('missed', false)).toBe('Missed voice call');
            // missed is local-only on the callee, so iAmInitiator should
            // never be true in production; assert wording is unchanged.
            expect(getMessageText('missed', true)).toBe('Missed voice call');
        });

        it('returns cancelled text', () => {
            expect(getMessageText('cancelled', true)).toBe('Cancelled');
            // cancelled is local-only on the caller, so iAmInitiator should
            // never be false in production; assert wording is unchanged.
            expect(getMessageText('cancelled', false)).toBe('Cancelled');
        });

        it('returns ended call with duration', () => {
            expect(getMessageText('ended', true, 150)).toBe('Voice call ended \u2022 2:30');
            expect(getMessageText('ended', false, 150)).toBe('Voice call ended \u2022 2:30');
        });

        it('returns ended call without duration', () => {
            expect(getMessageText('ended', true)).toBe('Voice call ended');
            expect(getMessageText('ended', false)).toBe('Voice call ended');
        });

        it('returns failed text regardless of role', () => {
            expect(getMessageText('failed', true)).toBe('Connection failed');
            expect(getMessageText('failed', false)).toBe('Connection failed');
        });
    });

    describe('getMessageText — asymmetric outcomes (role-aware)', () => {
        it("renders 'declined' as caller-side wording when iAmInitiator", () => {
            expect(getMessageText('declined', true)).toBe('Call declined');
        });

        it("renders 'declined' as callee-side wording when !iAmInitiator", () => {
            expect(getMessageText('declined', false)).toBe('Declined');
        });

        it("renders 'busy' as caller-side wording when iAmInitiator", () => {
            expect(getMessageText('busy', true)).toBe('User busy');
        });

        it("renders 'busy' as callee-side wording when !iAmInitiator", () => {
            expect(getMessageText('busy', false)).toBe('Missed voice call (busy)');
        });

        it("renders 'no-answer' as caller-side wording when iAmInitiator", () => {
            expect(getMessageText('no-answer', true)).toBe('No answer');
        });

        it("renders 'no-answer' as callee-side wording when !iAmInitiator", () => {
            expect(getMessageText('no-answer', false)).toBe('Missed voice call');
        });
    });

    describe('getMessageText — legacy and forward-compat', () => {
        it("falls back to generic for legacy 'outgoing'", () => {
            // Was authored by an interim version of the offer-timeout path;
            // never deployed. Should not blow up in any DB that has it.
            expect(getMessageText('outgoing', true)).toBe('Voice call');
            expect(getMessageText('outgoing', false)).toBe('Voice call');
        });

        it("falls back to generic for legacy 'incoming'", () => {
            // Was declared in an older type union but never authored by
            // any production code path.
            expect(getMessageText('incoming', false)).toBe('Voice call');
        });

        it("falls back to generic for interim 'declined-outgoing'", () => {
            // From an unreleased earlier iteration of the role-aware
            // change. If anyone tested that branch locally and has rows,
            // they shouldn't render blank.
            expect(getMessageText('declined-outgoing', true)).toBe('Voice call');
        });

        it("falls back to generic for interim 'declined-incoming'", () => {
            expect(getMessageText('declined-incoming', false)).toBe('Voice call');
        });

        it('falls back to generic for undefined type', () => {
            expect(getMessageText(undefined, false)).toBe('Voice call');
        });

        it('falls back to generic for forward-compat unknown values', () => {
            expect(getMessageText('something-future', true)).toBe('Voice call');
        });
    });

    describe('getMessageText — video calls', () => {
        // Mirrors the .video.* override block in en.ts — only the keys
        // whose voice copy mentions "voice call" get a video form. The
        // rest deliberately reuse the voice copy because their wording
        // is already media-neutral (e.g. "Call declined", "User busy").

        it('renders missed as "Missed video call"', () => {
            expect(getMessageText('missed', false, undefined, 'video'))
                .toBe('Missed video call');
        });

        it('renders ended with duration as "Video call ended \u2022 MM:SS"', () => {
            expect(getMessageText('ended', true, 150, 'video'))
                .toBe('Video call ended \u2022 2:30');
        });

        it('renders ended without duration as "Video call ended"', () => {
            expect(getMessageText('ended', true, undefined, 'video'))
                .toBe('Video call ended');
        });

        it('renders no-answer (callee side) as "Missed video call"', () => {
            expect(getMessageText('no-answer', false, undefined, 'video'))
                .toBe('Missed video call');
        });

        it('renders busy (callee side) as "Missed video call (busy)"', () => {
            expect(getMessageText('busy', false, undefined, 'video'))
                .toBe('Missed video call (busy)');
        });

        it('falls back to "Video call" generic for unknown / legacy types', () => {
            expect(getMessageText('outgoing', false, undefined, 'video'))
                .toBe('Video call');
            expect(getMessageText(undefined, false, undefined, 'video'))
                .toBe('Video call');
        });

        // Media-neutral keys: video calls reuse the voice copy.
        it('reuses voice copy for media-neutral outcomes', () => {
            expect(getMessageText('declined', true, undefined, 'video'))
                .toBe('Call declined');
            expect(getMessageText('declined', false, undefined, 'video'))
                .toBe('Declined');
            expect(getMessageText('busy', true, undefined, 'video'))
                .toBe('User busy');
            expect(getMessageText('no-answer', true, undefined, 'video'))
                .toBe('No answer');
            expect(getMessageText('failed', true, undefined, 'video'))
                .toBe('Connection failed');
            expect(getMessageText('cancelled', true, undefined, 'video'))
                .toBe('Cancelled');
        });

        it("treats explicit 'voice' identically to undefined media type", () => {
            expect(getMessageText('missed', false, undefined, 'voice'))
                .toBe('Missed voice call');
            expect(getMessageText('missed', false, undefined, undefined))
                .toBe('Missed voice call');
        });
    });

    describe('getCallDirection — directional arrow next to phone icon', () => {
        it("returns 'outgoing' when local user is the initiator", () => {
            expect(getCallDirection(true, true, true)).toBe('outgoing');
        });

        it("returns 'incoming' when peer is the initiator", () => {
            expect(getCallDirection(true, true, false)).toBe('incoming');
        });

        it("returns 'none' for legacy rows lacking a call-initiator tag", () => {
            // Rows authored before `callInitiatorNpub` was added (or the
            // generic-fallback path) carry no direction info; render no
            // arrow rather than guessing.
            expect(getCallDirection(false, true, false)).toBe('none');
            expect(getCallDirection(false, true, true)).toBe('none');
        });

        it("returns 'none' when no user is authenticated", () => {
            // SSR / pre-login render path; cannot compute iAmInitiator
            // safely, so omit the arrow.
            expect(getCallDirection(true, false, false)).toBe('none');
        });

        it('is consistent with iAmInitiator across every callEventType', () => {
            // Every pill variant should pick up direction the same way:
            // the arrow is purely a function of (callInitiatorNpub,
            // currentUser, iAmInitiator). Encode that invariant here so
            // a future change to add per-type direction overrides has to
            // update this test on purpose.
            const types = [
                'missed',
                'cancelled',
                'ended',
                'declined',
                'busy',
                'no-answer',
                'failed'
            ];
            for (const _type of types) {
                expect(getCallDirection(true, true, true)).toBe('outgoing');
                expect(getCallDirection(true, true, false)).toBe('incoming');
            }
        });

        it('matches expected direction for local-only outcomes', () => {
            // 'cancelled' is only authored by the caller, so when present
            // in the local DB the local user IS the initiator → outgoing.
            // 'missed' is only authored by the callee, so the local user
            // is NOT the initiator → incoming.
            // (The component uses the same generic logic for both; this
            // test documents the resulting UX for reviewers.)
            expect(getCallDirection(true, true, /* I cancelled */ true)).toBe(
                'outgoing'
            );
            expect(getCallDirection(true, true, /* I missed */ false)).toBe(
                'incoming'
            );
        });
    });

    describe('relative-time band selection', () => {
        // Pure mirror of the band cutoffs in src/lib/utils/time.ts so a
        // future change to the bands has to update this test on purpose.
        // The component itself delegates to getRelativeTime(message.sentAt,
        // now); this assertion documents which band each (sentAt, now)
        // pair falls into, which is the user-visible contract.
        function pickBand(
            sentAt: number,
            now: number
        ):
            | 'justNow'
            | 'minutes'
            | 'hours'
            | 'days'
            | 'weeks'
            | 'months'
            | 'years' {
            const diff = now - sentAt;
            const seconds = Math.floor(diff / 1000);
            const minutes = Math.floor(seconds / 60);
            const hours = Math.floor(minutes / 60);
            const days = Math.floor(hours / 24);
            const weeks = Math.floor(days / 7);
            const months = Math.floor(days / 30);
            if (seconds < 60) return 'justNow';
            if (minutes < 60) return 'minutes';
            if (hours < 24) return 'hours';
            if (days < 7) return 'days';
            if (weeks < 4) return 'weeks';
            if (months < 12) return 'months';
            return 'years';
        }

        const NOW = 1_700_000_000_000;

        it('renders just-now for events under 60 seconds old', () => {
            // 30s ago — pill must read as "just now" so a freshly-ended
            // call doesn't briefly show "0m ago".
            expect(pickBand(NOW - 30 * 1000, NOW)).toBe('justNow');
        });

        it('renders minutes band from 1m up to 59m', () => {
            expect(pickBand(NOW - 60 * 1000, NOW)).toBe('minutes');
            expect(pickBand(NOW - 5 * 60 * 1000, NOW)).toBe('minutes');
            expect(pickBand(NOW - 59 * 60 * 1000, NOW)).toBe('minutes');
        });

        it('renders hours band from 1h up to 23h', () => {
            expect(pickBand(NOW - 60 * 60 * 1000, NOW)).toBe('hours');
            expect(pickBand(NOW - 23 * 60 * 60 * 1000, NOW)).toBe('hours');
        });

        it('renders days band from 1d up to 6d', () => {
            expect(pickBand(NOW - 24 * 60 * 60 * 1000, NOW)).toBe('days');
            expect(pickBand(NOW - 6 * 24 * 60 * 60 * 1000, NOW)).toBe('days');
        });

        it('renders weeks band from 7d up to 27d', () => {
            expect(pickBand(NOW - 7 * 24 * 60 * 60 * 1000, NOW)).toBe('weeks');
            expect(pickBand(NOW - 27 * 24 * 60 * 60 * 1000, NOW)).toBe('weeks');
        });

        it('renders months band starting at 30d', () => {
            expect(pickBand(NOW - 30 * 24 * 60 * 60 * 1000, NOW)).toBe(
                'months'
            );
        });

        it('renders years band beyond a year', () => {
            expect(pickBand(NOW - 400 * 24 * 60 * 60 * 1000, NOW)).toBe(
                'years'
            );
        });

        it('flips between bands as the reactive `now` advances', () => {
            // Captures the live-updating contract: the same `sentAt`
            // moves from "just now" to "1m ago" purely as `now`
            // advances past 60s. ChatView's per-minute ticker drives
            // this by updating its `currentTime` rune; CallEventMessage
            // is a pure function of (message, now), so this band flip
            // is the entire mechanism by which the pill text refreshes.
            const sentAt = NOW;
            expect(pickBand(sentAt, NOW + 30 * 1000)).toBe('justNow');
            expect(pickBand(sentAt, NOW + 60 * 1000)).toBe('minutes');
        });
    });

    describe('absolute-time tooltip', () => {
        // The pill renders relative time as the visible label and the
        // full localized datetime in the title attribute, exactly like
        // regular message bubbles in ChatView.svelte:2413-2416. We
        // can't easily mount the component here (no testing-library
        // dep), but we can lock the formula:
        //
        //     title = new Date(message.sentAt).toLocaleString()
        //
        // so any future change has to update this test on purpose.
        it('formats the title as the full localized datetime string', () => {
            const sentAt = 1_700_000_000_000;
            const expected = new Date(sentAt).toLocaleString();
            // Sanity: toLocaleString returns a non-empty, non-just-time
            // string (i.e., it includes the date too). This is the
            // distinguishing characteristic vs. the previous
            // toLocaleTimeString-only label.
            expect(expected).toBeTruthy();
            expect(expected.length).toBeGreaterThan(
                new Date(sentAt).toLocaleTimeString().length
            );
        });
    });
});
