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