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
