import { describe, expect, it } from 'vitest';

import { extractKind0DisplayName, extractKind0Picture, extractKind0Username } from './AndroidProfileCache';


describe('AndroidProfileCache', () => {
    describe('extractKind0Username', () => {
        it('returns trimmed kind 0 name', () => {
            expect(extractKind0Username({ name: ' alice ' })).toBe('alice');
        });

        it('returns null when name missing or empty', () => {
            expect(extractKind0Username({})).toBeNull();
            expect(extractKind0Username({ name: '' })).toBeNull();
            expect(extractKind0Username({ name: '   ' })).toBeNull();
        });

        it('returns null for non-object input', () => {
            expect(extractKind0Username(null)).toBeNull();
            expect(extractKind0Username('alice')).toBeNull();
        });
    });

    describe('extractKind0DisplayName', () => {
        it('prefers display_name over name', () => {
            expect(extractKind0DisplayName({ display_name: 'Alice', name: 'alice' })).toBe('Alice');
        });

        it('falls back to name when display_name missing', () => {
            expect(extractKind0DisplayName({ name: 'alice' })).toBe('alice');
        });

        it('falls back to displayName (camelCase)', () => {
            expect(extractKind0DisplayName({ displayName: 'CamelAlice' })).toBe('CamelAlice');
        });

        it('returns null when no name fields exist', () => {
            expect(extractKind0DisplayName({})).toBeNull();
        });

        it('skips empty/whitespace-only values', () => {
            expect(extractKind0DisplayName({ display_name: '  ', name: 'alice' })).toBe('alice');
        });

        it('returns null for non-object input', () => {
            expect(extractKind0DisplayName(null)).toBeNull();
            expect(extractKind0DisplayName('alice')).toBeNull();
        });
    });

    describe('extractKind0Picture', () => {
        it('returns trimmed picture url', () => {
            expect(extractKind0Picture({ picture: ' https://example.com/a.png ' })).toBe('https://example.com/a.png');
        });

        it('returns null for missing or empty picture', () => {
            expect(extractKind0Picture({})).toBeNull();
            expect(extractKind0Picture({ picture: '' })).toBeNull();
            expect(extractKind0Picture({ picture: '   ' })).toBeNull();
        });
    });
});
