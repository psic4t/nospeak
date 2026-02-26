import { describe, it, expect } from 'vitest';
import { resolveDisplayName, resolveUsername, resolveMentionLabel } from './nameUtils';

const NPUB = 'npub1abcdef1234567890';
const SHORT = 'npub1abcdef1...';

// ---------------------------------------------------------------------------
// resolveDisplayName
// ---------------------------------------------------------------------------
describe('resolveDisplayName', () => {
    it('returns display_name when present', () => {
        expect(resolveDisplayName({ display_name: 'Alice' })).toBe('Alice');
    });

    it('falls back to name when display_name is missing', () => {
        expect(resolveDisplayName({ name: 'alice' })).toBe('alice');
    });

    it('falls back to displayName (camelCase) when others missing', () => {
        expect(resolveDisplayName({ displayName: 'CamelAlice' })).toBe('CamelAlice');
    });

    it('prefers display_name over name and displayName', () => {
        expect(resolveDisplayName({
            display_name: 'Display',
            name: 'name',
            displayName: 'Camel',
        })).toBe('Display');
    });

    it('prefers name over displayName', () => {
        expect(resolveDisplayName({
            name: 'name',
            displayName: 'Camel',
        })).toBe('name');
    });

    it('falls back to shortNpub when metadata has no names', () => {
        expect(resolveDisplayName({}, NPUB)).toBe(SHORT);
    });

    it('returns Unknown when no metadata and no npub', () => {
        expect(resolveDisplayName({})).toBe('Unknown');
    });

    it('returns Unknown for null metadata without npub', () => {
        expect(resolveDisplayName(null)).toBe('Unknown');
    });

    it('returns Unknown for undefined metadata without npub', () => {
        expect(resolveDisplayName(undefined)).toBe('Unknown');
    });

    it('returns shortNpub for null metadata with npub', () => {
        expect(resolveDisplayName(null, NPUB)).toBe(SHORT);
    });

    it('treats empty string as missing', () => {
        expect(resolveDisplayName({ display_name: '', name: '', displayName: '' }, NPUB)).toBe(SHORT);
    });

    it('treats whitespace-only strings as missing', () => {
        expect(resolveDisplayName({ display_name: '   ', name: '\t', displayName: ' \n ' }, NPUB)).toBe(SHORT);
    });

    it('trims surrounding whitespace from returned value', () => {
        expect(resolveDisplayName({ display_name: '  Alice  ' })).toBe('Alice');
    });
});

// ---------------------------------------------------------------------------
// resolveUsername
// ---------------------------------------------------------------------------
describe('resolveUsername', () => {
    it('returns name when present', () => {
        expect(resolveUsername({ name: 'alice' })).toBe('alice');
    });

    it('ignores display_name', () => {
        expect(resolveUsername({ display_name: 'Alice Display' }, NPUB)).toBe(SHORT);
    });

    it('falls back to shortNpub', () => {
        expect(resolveUsername({}, NPUB)).toBe(SHORT);
    });

    it('returns Unknown when nothing available', () => {
        expect(resolveUsername({})).toBe('Unknown');
    });

    it('returns Unknown for null metadata', () => {
        expect(resolveUsername(null)).toBe('Unknown');
    });

    it('returns Unknown for undefined metadata', () => {
        expect(resolveUsername(undefined)).toBe('Unknown');
    });

    it('returns shortNpub for null metadata with npub', () => {
        expect(resolveUsername(null, NPUB)).toBe(SHORT);
    });

    it('treats empty string as missing', () => {
        expect(resolveUsername({ name: '' }, NPUB)).toBe(SHORT);
    });

    it('treats whitespace-only strings as missing', () => {
        expect(resolveUsername({ name: '   ' }, NPUB)).toBe(SHORT);
    });

    it('trims surrounding whitespace', () => {
        expect(resolveUsername({ name: '  alice  ' })).toBe('alice');
    });
});

// ---------------------------------------------------------------------------
// resolveMentionLabel
// ---------------------------------------------------------------------------
describe('resolveMentionLabel', () => {
    it('returns "Display Name (@username)" when both present', () => {
        expect(resolveMentionLabel({ display_name: 'Alice', name: 'alice' }))
            .toBe('Alice (@alice)');
    });

    it('returns "@username" when only name exists', () => {
        expect(resolveMentionLabel({ name: 'alice' })).toBe('@alice');
    });

    it('returns display_name when only display_name exists', () => {
        expect(resolveMentionLabel({ display_name: 'Alice' })).toBe('Alice');
    });

    it('returns displayName (camelCase) when only that exists', () => {
        expect(resolveMentionLabel({ displayName: 'CamelAlice' })).toBe('CamelAlice');
    });

    it('combines displayName with name when display_name absent', () => {
        expect(resolveMentionLabel({ displayName: 'CamelAlice', name: 'alice' }))
            .toBe('CamelAlice (@alice)');
    });

    it('prefers display_name over displayName for the display part', () => {
        expect(resolveMentionLabel({
            display_name: 'Snake',
            displayName: 'Camel',
            name: 'alice',
        })).toBe('Snake (@alice)');
    });

    it('falls back to shortNpub when no names at all', () => {
        expect(resolveMentionLabel({}, NPUB)).toBe(SHORT);
    });

    it('returns Unknown when nothing available', () => {
        expect(resolveMentionLabel({})).toBe('Unknown');
    });

    it('returns Unknown for null metadata', () => {
        expect(resolveMentionLabel(null)).toBe('Unknown');
    });

    it('returns Unknown for undefined metadata', () => {
        expect(resolveMentionLabel(undefined)).toBe('Unknown');
    });

    it('returns shortNpub for null metadata with npub', () => {
        expect(resolveMentionLabel(null, NPUB)).toBe(SHORT);
    });

    it('treats empty strings as missing', () => {
        expect(resolveMentionLabel({ display_name: '', name: '' }, NPUB)).toBe(SHORT);
    });

    it('treats whitespace-only strings as missing', () => {
        expect(resolveMentionLabel({ display_name: '  ', name: '\t' }, NPUB)).toBe(SHORT);
    });

    it('trims values in combined label', () => {
        expect(resolveMentionLabel({ display_name: '  Alice  ', name: '  alice  ' }))
            .toBe('Alice (@alice)');
    });

    it('handles empty fallbackNpub as no fallback', () => {
        expect(resolveMentionLabel({}, '')).toBe('Unknown');
    });

    it('handles whitespace-only fallbackNpub as no fallback', () => {
        expect(resolveMentionLabel({}, '   ')).toBe('Unknown');
    });
});
