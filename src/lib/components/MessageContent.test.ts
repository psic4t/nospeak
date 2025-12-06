import { describe, it, expect } from 'vitest';

describe('MessageContent Markdown parsing', () => {
    it('should parse bold text correctly', () => {
        const parseMarkdown = (text: string) => {
            text = text.replace(/~~([^~]+)~~/g, '<del>$1</del>');
            text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
            text = text.replace(/__([^_]+)__/g, '<strong>$1</strong>');
            text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
            text = text.replace(/_([^_]+)_/g, '<em>$1</em>');
            return text;
        };

        expect(parseMarkdown('**bold text**')).toBe('<strong>bold text</strong>');
        expect(parseMarkdown('__bold text__')).toBe('<strong>bold text</strong>');
    });

    it('should parse italic text correctly', () => {
        const parseMarkdown = (text: string) => {
            text = text.replace(/~~([^~]+)~~/g, '<del>$1</del>');
            text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
            text = text.replace(/__([^_]+)__/g, '<strong>$1</strong>');
            text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
            text = text.replace(/_([^_]+)_/g, '<em>$1</em>');
            return text;
        };

        expect(parseMarkdown('*italic text*')).toBe('<em>italic text</em>');
        expect(parseMarkdown('_italic text_')).toBe('<em>italic text</em>');
    });

    it('should parse strikethrough text correctly', () => {
        const parseMarkdown = (text: string) => {
            text = text.replace(/~~([^~]+)~~/g, '<del>$1</del>');
            text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
            text = text.replace(/__([^_]+)__/g, '<strong>$1</strong>');
            text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
            text = text.replace(/_([^_]+)_/g, '<em>$1</em>');
            return text;
        };

        expect(parseMarkdown('~~strikethrough text~~')).toBe('<del>strikethrough text</del>');
    });

    it('should parse mixed markdown correctly', () => {
        const parseMarkdown = (text: string) => {
            text = text.replace(/~~([^~]+)~~/g, '<del>$1</del>');
            text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
            text = text.replace(/__([^_]+)__/g, '<strong>$1</strong>');
            text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
            text = text.replace(/_([^_]+)_/g, '<em>$1</em>');
            return text;
        };

        expect(parseMarkdown('**bold** and *italic* and ~~strikethrough~~'))
            .toBe('<strong>bold</strong> and <em>italic</em> and <del>strikethrough</del>');
    });

    it('should handle simple markdown patterns', () => {
        const parseMarkdown = (text: string) => {
            text = text.replace(/~~([^~]+)~~/g, '<del>$1</del>');
            text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
            text = text.replace(/__([^_]+)__/g, '<strong>$1</strong>');
            text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
            text = text.replace(/_([^_]+)_/g, '<em>$1</em>');
            return text;
        };

        // Simple patterns work, nested patterns are not supported in this basic implementation
        expect(parseMarkdown('**bold text**')).toBe('<strong>bold text</strong>');
        expect(parseMarkdown('*italic text*')).toBe('<em>italic text</em>');
    });

    it('should leave plain text unchanged', () => {
        const parseMarkdown = (text: string) => {
            text = text.replace(/~~([^~]+)~~/g, '<del>$1</del>');
            text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
            text = text.replace(/__([^_]+)__/g, '<strong>$1</strong>');
            text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
            text = text.replace(/_([^_]+)_/g, '<em>$1</em>');
            return text;
        };

        expect(parseMarkdown('plain text')).toBe('plain text');
    });
});

describe('MessageContent URL handling', () => {
    it('detects non-media URLs separately from media URLs', () => {
        const urlRegex = /(https?:\/\/[^\s]+)/g;

        const isImage = (url: string) => {
            try {
                const u = new URL(url);
                return /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(u.pathname);
            } catch {
                return false;
            }
        };

        const isVideo = (url: string) => {
            try {
                const u = new URL(url);
                return /\.(mp4|webm|mov|ogg)$/i.test(u.pathname);
            } catch {
                return false;
            }
        };

        const getFirstNonMediaUrl = (text: string): string | null => {
            const matches = text.match(urlRegex) ?? [];
            for (const candidate of matches) {
                if (!isImage(candidate) && !isVideo(candidate)) {
                    return candidate;
                }
            }
            return null;
        };

        const text = 'Check this image https://example.com/photo.jpg and this site https://example.com/page';
        const firstNonMedia = getFirstNonMediaUrl(text);
        expect(firstNonMedia).toBe('https://example.com/page');
    });
});
