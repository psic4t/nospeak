import { describe, it, expect } from 'vitest';

// Mirror the component's pure functions for testing
function formatDuration(seconds: number | undefined): string {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function getMessageText(callEventType: string | undefined, callDuration?: number): string {
    switch (callEventType) {
        case 'missed':
            return 'Missed voice call';
        case 'ended': {
            const duration = formatDuration(callDuration);
            return duration ? `Voice call ended \u2022 ${duration}` : 'Voice call ended';
        }
        case 'outgoing':
            return 'Outgoing voice call';
        case 'incoming':
            return 'Incoming voice call';
        default:
            return 'Voice call';
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

    describe('getMessageText', () => {
        it('returns missed call text', () => {
            expect(getMessageText('missed')).toBe('Missed voice call');
        });

        it('returns ended call with duration', () => {
            expect(getMessageText('ended', 150)).toBe('Voice call ended \u2022 2:30');
        });

        it('returns ended call without duration', () => {
            expect(getMessageText('ended')).toBe('Voice call ended');
        });

        it('returns outgoing call text', () => {
            expect(getMessageText('outgoing')).toBe('Outgoing voice call');
        });

        it('returns default for unknown type', () => {
            expect(getMessageText(undefined)).toBe('Voice call');
        });
    });
});
