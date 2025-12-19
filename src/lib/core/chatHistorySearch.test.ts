import { describe, it, expect } from 'vitest';
import type { Message } from '$lib/db/db';
import { buildChatHistorySearchResults } from './chatHistorySearch';

function baseMessage(overrides: Partial<Message>): Message {
    return {
        recipientNpub: 'npub1test',
        message: '',
        sentAt: overrides.sentAt ?? Date.now(),
        eventId: overrides.eventId ?? 'event-' + Math.random().toString(36).slice(2),
        direction: overrides.direction ?? 'sent',
        createdAt: Date.now(),
        ...overrides
    };
}

describe('chatHistorySearch', () => {
    it('returns no results when query is shorter than 3 characters', () => {
        const messages: Message[] = [baseMessage({ message: 'Hello', rumorKind: 14 })];
        expect(buildChatHistorySearchResults(messages, 'he')).toEqual([]);
    });
    it('matches case-insensitively on message text', () => {
        const messages: Message[] = [
            baseMessage({ sentAt: 1, message: 'Hello there', rumorKind: 14 }),
            baseMessage({ sentAt: 2, message: 'Goodbye', rumorKind: 14 })
        ];

        const results = buildChatHistorySearchResults(messages, 'heLLo');
        expect(results).toHaveLength(1);
        expect(results[0].message).toBe('Hello there');
    });

    it('includes file bubble + caption when caption matches', () => {
        const fileRumorId = 'file-rumor-1';

        const file = baseMessage({
            sentAt: 10,
            rumorKind: 15,
            rumorId: fileRumorId,
            message: ''
        });

        const caption = baseMessage({
            sentAt: 11,
            rumorKind: 14,
            parentRumorId: fileRumorId,
            message: 'A nice Caption'
        });

        const results = buildChatHistorySearchResults([file, caption], 'caption');
        expect(results.map((m) => m.rumorKind)).toEqual([15, 14]);
        expect(results[0].rumorId).toBe(fileRumorId);
        expect(results[1].parentRumorId).toBe(fileRumorId);
    });

    it('deduplicates messages when a parent is pulled in by caption match', () => {
        const fileRumorId = 'file-rumor-2';

        const file = baseMessage({
            sentAt: 20,
            rumorKind: 15,
            rumorId: fileRumorId,
            message: ''
        });

        const caption = baseMessage({
            sentAt: 21,
            rumorKind: 14,
            parentRumorId: fileRumorId,
            message: 'foo'
        });

        const text = baseMessage({
            sentAt: 30,
            rumorKind: 14,
            message: 'Foo bar'
        });

        const results = buildChatHistorySearchResults([file, caption, text], 'foo');
        const ids = results.map((m) => m.eventId);
        expect(new Set(ids).size).toBe(ids.length);
        expect(results.map((m) => m.rumorKind)).toEqual([15, 14, 14]);
    });

    it('does not force parent inclusion when direction differs', () => {
        const fileRumorId = 'file-rumor-3';

        const file = baseMessage({
            sentAt: 40,
            rumorKind: 15,
            rumorId: fileRumorId,
            direction: 'sent'
        });

        const caption = baseMessage({
            sentAt: 41,
            rumorKind: 14,
            parentRumorId: fileRumorId,
            direction: 'received',
            message: 'caption mismatch'
        });

        const results = buildChatHistorySearchResults([file, caption], 'caption');
        expect(results).toHaveLength(1);
        expect(results[0].message).toBe('caption mismatch');
    });
});
