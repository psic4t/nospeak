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

function getMessageText(
    callEventType: string | undefined,
    iAmInitiator: boolean,
    callDuration?: number
): string {
    switch (callEventType) {
        case 'missed':
            return PILL.missed;
        case 'cancelled':
            return PILL.cancelled;
        case 'ended': {
            const duration = formatDuration(callDuration);
            return duration
                ? PILL.endedWithDuration.replace('{duration}', duration)
                : PILL.ended;
        }
        case 'declined':
            return iAmInitiator ? PILL.declinedByPeer : PILL.declinedByMe;
        case 'busy':
            return iAmInitiator ? PILL.busyByPeer : PILL.busyMe;
        case 'no-answer':
            return iAmInitiator ? PILL.noAnswerByPeer : PILL.noAnswerMe;
        case 'failed':
            return PILL.failed;
        default:
            return PILL.generic;
    }
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
});
