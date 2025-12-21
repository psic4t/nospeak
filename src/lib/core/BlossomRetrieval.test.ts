import { describe, it, expect } from 'vitest';

import { extractBlossomSha256FromUrl, buildBlossomCandidateUrls } from './BlossomRetrieval';

describe('extractBlossomSha256FromUrl', () => {
    it('extracts the last 64-hex occurrence', () => {
        const shaA = 'a'.repeat(64);
        const shaB = 'b'.repeat(64);

        const result = extractBlossomSha256FromUrl(
            `https://cdn.example.com/user/${shaA}/${shaB}.pdf`
        );

        expect(result).toEqual({
            sha256: shaB,
            extension: '.pdf'
        });
    });

    it('returns null when none present', () => {
        expect(extractBlossomSha256FromUrl('https://example.com/file.png')).toBeNull();
    });
});

describe('buildBlossomCandidateUrls', () => {
    it('builds origin-root urls preserving extension', () => {
        const urls = buildBlossomCandidateUrls({
            servers: ['https://cdn.one', 'cdn.two'],
            sha256: 'deadbeef'.padEnd(64, '0'),
            extension: '.jpg'
        });

        expect(urls[0]).toBe(`https://cdn.one/${'deadbeef'.padEnd(64, '0')}.jpg`);
        expect(urls[1]).toBe(`https://cdn.two/${'deadbeef'.padEnd(64, '0')}.jpg`);
    });
});
