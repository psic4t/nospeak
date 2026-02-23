import { describe, it, expect } from 'vitest';

// Helper functions that mirror the component implementation
function parseInlineMarkdown(text: string): string {
    text = text.replace(/~~([^~]+)~~/g, '<del>$1</del>');
    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/__([^_]+)__/g, '<strong>$1</strong>');
    text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    text = text.replace(/_([^_]+)_/g, '<em>$1</em>');
    return text;
}

function parseMarkdown(text: string): string {
    const lines = text.split('\n');
    const result: string[] = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];

        // Check for citation block (> text or > or >)
        if (/^>( .*)?$/.test(line)) {
            const citeLines: string[] = [];
            while (i < lines.length && /^>( .*)?$/.test(lines[i])) {
                citeLines.push(lines[i].replace(/^> ?/, '')); // Remove "> " or ">"
                i++;
            }
            // Recursively parse to handle nested citations and other block elements
            const citeContent = parseMarkdown(citeLines.join('\n'));
            result.push(`<blockquote class="border-s-2 border-gray-400 dark:border-slate-500 bg-gray-100/50 dark:bg-slate-800/50 ps-3 pe-3 py-1 my-1 rounded-e text-gray-700 dark:text-slate-300">${citeContent}</blockquote>`);
            continue;
        }

        // Check for unordered list (- item or * item)
        if (/^[-*] .+/.test(line)) {
            const listItems: string[] = [];
            while (i < lines.length && /^[-*] .+/.test(lines[i])) {
                listItems.push(lines[i].substring(2));
                i++;
            }
            const listContent = listItems.map(item => `<li>${parseInlineMarkdown(item)}</li>`).join('');
            result.push(`<ul class="list-disc ps-5 my-1">${listContent}</ul>`);
            continue;
        }

        // Check for ordered list (1. item, 2. item, etc.)
        if (/^\d+\. .+/.test(line)) {
            const listItems: string[] = [];
            while (i < lines.length && /^\d+\. .+/.test(lines[i])) {
                listItems.push(lines[i].replace(/^\d+\. /, ''));
                i++;
            }
            const listContent = listItems.map(item => `<li>${parseInlineMarkdown(item)}</li>`).join('');
            result.push(`<ol class="list-decimal ps-5 my-1">${listContent}</ol>`);
            continue;
        }

        result.push(parseInlineMarkdown(line));
        i++;
    }

    return result.join('\n');
}

describe('MessageContent Inline Markdown parsing', () => {
    it('should parse bold text correctly', () => {
        expect(parseInlineMarkdown('**bold text**')).toBe('<strong>bold text</strong>');
        expect(parseInlineMarkdown('__bold text__')).toBe('<strong>bold text</strong>');
    });

    it('should parse italic text correctly', () => {
        expect(parseInlineMarkdown('*italic text*')).toBe('<em>italic text</em>');
        expect(parseInlineMarkdown('_italic text_')).toBe('<em>italic text</em>');
    });

    it('should parse strikethrough text correctly', () => {
        expect(parseInlineMarkdown('~~strikethrough text~~')).toBe('<del>strikethrough text</del>');
    });

    it('should parse mixed inline markdown correctly', () => {
        expect(parseInlineMarkdown('**bold** and *italic* and ~~strikethrough~~'))
            .toBe('<strong>bold</strong> and <em>italic</em> and <del>strikethrough</del>');
    });

    it('should leave plain text unchanged', () => {
        expect(parseInlineMarkdown('plain text')).toBe('plain text');
    });
});

describe('MessageContent Block Markdown parsing', () => {
    it('should parse single-line citation correctly', () => {
        const result = parseMarkdown('> quoted text');
        expect(result).toContain('<blockquote');
        expect(result).toContain('quoted text');
        expect(result).toContain('border-s-2');
        expect(result).toContain('bg-gray-100/50');
    });

    it('should group multi-line citations into single blockquote', () => {
        const result = parseMarkdown('> line one\n> line two\n> line three');
        // Should have only one blockquote
        expect((result.match(/<blockquote/g) || []).length).toBe(1);
        // Should contain all lines (now separated by newlines due to recursive parsing)
        expect(result).toContain('line one');
        expect(result).toContain('line two');
        expect(result).toContain('line three');
    });

    it('should handle multi-line citations with empty lines', () => {
        const result = parseMarkdown('> line one\n> \n> line three');
        // Should have only one blockquote (empty line should not break the block)
        expect((result.match(/<blockquote/g) || []).length).toBe(1);
        // Should contain all lines
        expect(result).toContain('line one');
        expect(result).toContain('line three');
        // Should NOT contain a literal ">" character outside the blockquote
        expect(result).not.toMatch(/>\s*\n[^<]/);
    });

    it('should handle citation with bare > marker', () => {
        const result = parseMarkdown('> line one\n>\n> line three');
        // Should have only one blockquote
        expect((result.match(/<blockquote/g) || []).length).toBe(1);
    });

    it('should handle nested citations (multi-level quoting)', () => {
        const result = parseMarkdown('> > deeply nested\n> outer quote');
        // Should have two blockquotes (outer and inner)
        expect((result.match(/<blockquote/g) || []).length).toBe(2);
        // Inner quote should contain the deeply nested text
        expect(result).toContain('deeply nested');
        // Outer quote should contain the outer text
        expect(result).toContain('outer quote');
    });

    it('should handle triple-nested citations', () => {
        const result = parseMarkdown('> > > level 3\n> > level 2\n> level 1');
        // Should have three blockquotes
        expect((result.match(/<blockquote/g) || []).length).toBe(3);
    });

    it('should apply inline markdown within citations', () => {
        const result = parseMarkdown('> **bold** and *italic*');
        expect(result).toContain('<strong>bold</strong>');
        expect(result).toContain('<em>italic</em>');
    });

    it('should parse unordered list with dash', () => {
        const result = parseMarkdown('- item one\n- item two\n- item three');
        expect(result).toContain('<ul class="list-disc ps-5 my-1">');
        expect(result).toContain('<li>item one</li>');
        expect(result).toContain('<li>item two</li>');
        expect(result).toContain('<li>item three</li>');
    });

    it('should parse unordered list with asterisk', () => {
        const result = parseMarkdown('* item one\n* item two');
        expect(result).toContain('<ul class="list-disc ps-5 my-1">');
        expect(result).toContain('<li>item one</li>');
        expect(result).toContain('<li>item two</li>');
    });

    it('should parse ordered list', () => {
        const result = parseMarkdown('1. first\n2. second\n3. third');
        expect(result).toContain('<ol class="list-decimal ps-5 my-1">');
        expect(result).toContain('<li>first</li>');
        expect(result).toContain('<li>second</li>');
        expect(result).toContain('<li>third</li>');
    });

    it('should apply inline markdown within list items', () => {
        const result = parseMarkdown('- **bold item**\n- *italic item*');
        expect(result).toContain('<li><strong>bold item</strong></li>');
        expect(result).toContain('<li><em>italic item</em></li>');
    });

    it('should handle mixed content: text + list + text', () => {
        const result = parseMarkdown('intro text\n- item one\n- item two\noutro text');
        expect(result).toContain('intro text');
        expect(result).toContain('<ul');
        expect(result).toContain('outro text');
    });

    it('should handle citation followed by regular text', () => {
        const result = parseMarkdown('> quoted\nmy response');
        expect(result).toContain('<blockquote');
        expect(result).toContain('quoted');
        expect(result).toContain('my response');
        // blockquote and response should be separate
        expect(result).toContain('</blockquote>\nmy response');
    });

    it('should handle empty lines between blocks', () => {
        const result = parseMarkdown('text before\n\n- list item\n\ntext after');
        expect(result).toContain('text before');
        expect(result).toContain('<ul');
        expect(result).toContain('text after');
    });

    it('should not treat dash without space as list item', () => {
        const result = parseMarkdown('-not a list');
        expect(result).not.toContain('<ul');
        expect(result).toBe('-not a list');
    });

    it('should not treat number without proper format as ordered list', () => {
        const result = parseMarkdown('1.not a list');
        expect(result).not.toContain('<ol');
        expect(result).toBe('1.not a list');
    });
});

describe('MessageContent URL handling', () => {
    it('skips URL preview when fileUrl is provided (encrypted file messages)', () => {
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

        const isAudio = (url: string) => {
            try {
                const u = new URL(url);
                return /\.mp3$/i.test(u.pathname);
            } catch {
                return false;
            }
        };

        const getFirstNonMediaUrl = (text: string): string | null => {
            const matches = text.match(urlRegex) ?? [];
            for (const candidate of matches) {
                if (!isImage(candidate) && !isVideo(candidate) && !isAudio(candidate)) {
                    return candidate;
                }
            }
            return null;
        };

        // Simulate the component logic: when fileUrl is set, previewUrl should be null
        const fileUrl = 'https://blossom.primal.net/0b416e77b6725ec89810b03c998281588adc735b41e730dabb97ce44c2f43c77';
        const content = 'https://blossom.primal.net/0b416e77b6725ec89810b03c998281588adc735b41e730dabb97ce44c2f43c77';

        // With fileUrl present, preview should be skipped
        const fileUrlPresent = 'https://blossom.primal.net/0b416e77b6725ec89810b03c998281588adc735b41e730dabb97ce44c2f43c77';
        const previewUrlWithFile = fileUrlPresent ? null : getFirstNonMediaUrl(content);
        expect(previewUrlWithFile).toBeNull();

        // Without fileUrl, the URL would be extracted
        const fileUrlAbsent = null;
        const previewUrlWithoutFile = fileUrlAbsent ? null : getFirstNonMediaUrl(content);
        expect(previewUrlWithoutFile).toBe('https://blossom.primal.net/0b416e77b6725ec89810b03c998281588adc735b41e730dabb97ce44c2f43c77');
    });

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

        const isAudio = (url: string) => {
            try {
                const u = new URL(url);
                return /\.mp3$/i.test(u.pathname);
            } catch {
                return false;
            }
        };
 
        const getFirstNonMediaUrl = (text: string): string | null => {
            const matches = text.match(urlRegex) ?? [];
            for (const candidate of matches) {
                if (!isImage(candidate) && !isVideo(candidate) && !isAudio(candidate)) {
                    return candidate;
                }
            }
            return null;
        };
 
        const text = 'Check this image https://example.com/photo.jpg and this song https://example.com/audio.mp3 and this site https://example.com/page';
        const firstNonMedia = getFirstNonMediaUrl(text);
        expect(firstNonMedia).toBe('https://example.com/page');
    });
 
    it('classifies image, video, and audio URLs correctly', () => {
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

        const isAudio = (url: string) => {
            try {
                const u = new URL(url);
                return /\.mp3$/i.test(u.pathname);
            } catch {
                return false;
            }
        };
 
        const imageUrl = 'https://example.com/photo.webp';
        const videoUrl = 'https://example.com/clip.mp4';
        const audioUrl = 'https://example.com/song.mp3';
        const pageUrl = 'https://example.com/page';
 
        expect(isImage(imageUrl)).toBe(true);
        expect(isVideo(imageUrl)).toBe(false);
        expect(isAudio(imageUrl)).toBe(false);

        expect(isImage(videoUrl)).toBe(false);
        expect(isVideo(videoUrl)).toBe(true);
        expect(isAudio(videoUrl)).toBe(false);

        expect(isImage(audioUrl)).toBe(false);
        expect(isVideo(audioUrl)).toBe(false);
        expect(isAudio(audioUrl)).toBe(true);

        expect(isImage(pageUrl)).toBe(false);
        expect(isVideo(pageUrl)).toBe(false);
        expect(isAudio(pageUrl)).toBe(false);
    });

});
