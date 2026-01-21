import { describe, it, expect } from 'vitest';
import { deriveConversationId, isGroupConversationId, generateGroupTitle } from './ConversationRepository';

describe('deriveConversationId', () => {
    const selfPubkey = 'aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111';
    const alicePubkey = 'bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222';
    const bobPubkey = 'cccc3333cccc3333cccc3333cccc3333cccc3333cccc3333cccc3333cccc3333';
    const carolPubkey = 'dddd4444dddd4444dddd4444dddd4444dddd4444dddd4444dddd4444dddd4444';

    it('returns npub for 1-on-1 chat', () => {
        const result = deriveConversationId([alicePubkey], selfPubkey);
        expect(result).toMatch(/^npub1/);
    });

    it('returns npub when self is included in 1-on-1 participants', () => {
        const result = deriveConversationId([selfPubkey, alicePubkey], selfPubkey);
        expect(result).toMatch(/^npub1/);
    });

    it('returns 16-char hash for group chat', () => {
        const result = deriveConversationId([alicePubkey, bobPubkey], selfPubkey);
        expect(result).toHaveLength(16);
        expect(result).toMatch(/^[0-9a-f]{16}$/);
    });

    it('returns deterministic hash regardless of input order', () => {
        const result1 = deriveConversationId([alicePubkey, bobPubkey, carolPubkey], selfPubkey);
        const result2 = deriveConversationId([carolPubkey, alicePubkey, bobPubkey], selfPubkey);
        const result3 = deriveConversationId([bobPubkey, carolPubkey, alicePubkey], selfPubkey);
        
        expect(result1).toBe(result2);
        expect(result2).toBe(result3);
    });

    it('returns same hash when self is included or not', () => {
        const result1 = deriveConversationId([alicePubkey, bobPubkey], selfPubkey);
        const result2 = deriveConversationId([selfPubkey, alicePubkey, bobPubkey], selfPubkey);
        
        expect(result1).toBe(result2);
    });

    it('returns different hash for different participant sets', () => {
        const result1 = deriveConversationId([alicePubkey, bobPubkey], selfPubkey);
        const result2 = deriveConversationId([alicePubkey, carolPubkey], selfPubkey);
        
        expect(result1).not.toBe(result2);
    });
});

describe('isGroupConversationId', () => {
    it('returns false for npub', () => {
        expect(isGroupConversationId('npub1abc123def456')).toBe(false);
    });

    it('returns true for hash', () => {
        expect(isGroupConversationId('abc123def4567890')).toBe(true);
    });
});

describe('generateGroupTitle', () => {
    it('returns "Group Chat" for empty names', () => {
        expect(generateGroupTitle([])).toBe('Group Chat');
    });

    it('returns single name for one participant', () => {
        expect(generateGroupTitle(['Alice'])).toBe('Alice');
    });

    it('joins all names when short enough', () => {
        expect(generateGroupTitle(['Alice', 'Bob', 'Carol'])).toBe('Alice, Bob, Carol');
    });

    it('truncates with "+N more" when too long', () => {
        const longNames = ['Alexander', 'Benjamin', 'Charlotte', 'Dominique', 'Elizabeth'];
        const result = generateGroupTitle(longNames, 30);
        
        expect(result.length).toBeLessThanOrEqual(30);
        expect(result).toContain('+');
        expect(result).toContain('more');
    });

    it('respects custom maxLength', () => {
        const names = ['Alice', 'Bob', 'Carol', 'Dave'];
        const result = generateGroupTitle(names, 20);
        
        expect(result.length).toBeLessThanOrEqual(20);
    });
});
