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

    it('returns results sorted by sentAt', () => {
        const messages: Message[] = [
            baseMessage({ sentAt: 30, message: 'Third foo', rumorKind: 14 }),
            baseMessage({ sentAt: 10, message: 'First foo', rumorKind: 14 }),
            baseMessage({ sentAt: 20, message: 'Second foo', rumorKind: 14 })
        ];

        const results = buildChatHistorySearchResults(messages, 'foo');
        expect(results).toHaveLength(3);
        expect(results[0].message).toBe('First foo');
        expect(results[1].message).toBe('Second foo');
        expect(results[2].message).toBe('Third foo');
    });

    it('finds captions stored in file message via alt tag', () => {
        const file = baseMessage({
            sentAt: 10,
            rumorKind: 15,
            message: 'A nice sunset photo'
        });

        const results = buildChatHistorySearchResults([file], 'sunset');
        expect(results).toHaveLength(1);
        expect(results[0].rumorKind).toBe(15);
        expect(results[0].message).toBe('A nice sunset photo');
    });

    it('returns empty array for empty message list', () => {
        const results = buildChatHistorySearchResults([], 'test');
        expect(results).toEqual([]);
    });

    it('handles messages with undefined message field', () => {
        const messages: Message[] = [
            baseMessage({ sentAt: 1, message: undefined as unknown as string, rumorKind: 14 }),
            baseMessage({ sentAt: 2, message: 'Hello world', rumorKind: 14 })
        ];

        const results = buildChatHistorySearchResults(messages, 'hello');
        expect(results).toHaveLength(1);
        expect(results[0].message).toBe('Hello world');
    });
});
