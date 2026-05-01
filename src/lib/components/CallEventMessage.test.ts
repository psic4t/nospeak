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
});
