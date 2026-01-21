import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

interface TestMessage {
    message: string;
    sentAt: number;
    direction: 'sent' | 'received';
    fileUrl?: string;
    fileType?: string;
}
 
function getMediaPreviewLabel(fileType: string): string {
    // Voice messages (webm/opus or m4a)
    if (
        fileType === "audio/webm" ||
        fileType === "audio/ogg" ||
        fileType === "audio/mp4" ||
        fileType === "audio/x-m4a" ||
        fileType.includes("opus")
    ) {
        return "🎤 Voice Message";
    }
    // Images
    if (fileType.startsWith("image/")) {
        return "📷 Image";
    }
    // Videos
    if (fileType.startsWith("video/")) {
        return "🎬 Video";
    }
    // Other audio (music files)
    if (fileType.startsWith("audio/")) {
        return "🎵 Audio";
    }
    // Generic file
    return "📎 File";
}

function buildLastMessagePreview(messages: TestMessage[]): { lastMessageTime: number; lastMessageText?: string } {
    const lastMsg = messages[0];
    const lastMsgTime = lastMsg ? lastMsg.sentAt : 0;

    let lastMessageText = "";
    if (lastMsg) {
        if (lastMsg.fileUrl && lastMsg.fileType) {
            // Media attachment - show friendly label only (message field contains URL, not caption)
            lastMessageText = getMediaPreviewLabel(lastMsg.fileType);
        } else {
            // Regular text message
            lastMessageText = (lastMsg.message || "").replace(/\s+/g, " ").trim();
        }

        if (lastMessageText && lastMsg.direction === "sent") {
            lastMessageText = `You: ${lastMessageText}`;
        }
    }

    return {
        lastMessageTime: lastMsgTime,
        lastMessageText: lastMessageText || undefined
    };
}
 
describe('ChatList last message preview', () => {
    it('normalizes whitespace and produces a single-line preview', () => {
        const messages: TestMessage[] = [
            {
                message: 'Hello\nworld   this   is   a   test',
                sentAt: 123,
                direction: 'received'
            }
        ];
 
        const result = buildLastMessagePreview(messages);
        expect(result.lastMessageTime).toBe(123);
        expect(result.lastMessageText).toBe('Hello world this is a test');
    });
 
    it('prefixes sent messages with "You:"', () => {
        const messages: TestMessage[] = [
            {
                message: 'See you soon',
                sentAt: 456,
                direction: 'sent'
            }
        ];
 
        const result = buildLastMessagePreview(messages);
        expect(result.lastMessageTime).toBe(456);
        expect(result.lastMessageText).toBe('You: See you soon');
    });
 
    it('omits preview when there are no messages', () => {
        const messages: TestMessage[] = [];

        const result = buildLastMessagePreview(messages);
        expect(result.lastMessageTime).toBe(0);
        expect(result.lastMessageText).toBeUndefined();
    });

    it('shows image emoji and label for image attachments', () => {
        const messages: TestMessage[] = [
            {
                message: '',
                sentAt: 789,
                direction: 'received',
                fileUrl: 'https://blossom.example.com/abc123',
                fileType: 'image/jpeg'
            }
        ];

        const result = buildLastMessagePreview(messages);
        expect(result.lastMessageText).toBe('📷 Image');
    });

    it('shows voice message label for audio/webm', () => {
        const messages: TestMessage[] = [
            {
                message: '',
                sentAt: 100,
                direction: 'received',
                fileUrl: 'https://blossom.example.com/voice123',
                fileType: 'audio/webm'
            }
        ];

        const result = buildLastMessagePreview(messages);
        expect(result.lastMessageText).toBe('🎤 Voice Message');
    });

    it('shows voice message label for audio/mp4 (m4a)', () => {
        const messages: TestMessage[] = [
            {
                message: '',
                sentAt: 100,
                direction: 'received',
                fileUrl: 'https://blossom.example.com/voice123',
                fileType: 'audio/mp4'
            }
        ];

        const result = buildLastMessagePreview(messages);
        expect(result.lastMessageText).toBe('🎤 Voice Message');
    });

    it('shows audio label for mp3 files', () => {
        const messages: TestMessage[] = [
            {
                message: '',
                sentAt: 100,
                direction: 'received',
                fileUrl: 'https://blossom.example.com/song.mp3',
                fileType: 'audio/mpeg'
            }
        ];

        const result = buildLastMessagePreview(messages);
        expect(result.lastMessageText).toBe('🎵 Audio');
    });

    it('shows video label for video attachments', () => {
        const messages: TestMessage[] = [
            {
                message: '',
                sentAt: 200,
                direction: 'received',
                fileUrl: 'https://blossom.example.com/video.mp4',
                fileType: 'video/mp4'
            }
        ];

        const result = buildLastMessagePreview(messages);
        expect(result.lastMessageText).toBe('🎬 Video');
    });

    it('prefixes sent media with "You:"', () => {
        const messages: TestMessage[] = [
            {
                message: '',
                sentAt: 300,
                direction: 'sent',
                fileUrl: 'https://blossom.example.com/photo.jpg',
                fileType: 'image/jpeg'
            }
        ];

        const result = buildLastMessagePreview(messages);
        expect(result.lastMessageText).toBe('You: 📷 Image');
    });

    it('shows file label for unknown file types', () => {
        const messages: TestMessage[] = [
            {
                message: '',
                sentAt: 400,
                direction: 'received',
                fileUrl: 'https://blossom.example.com/document.pdf',
                fileType: 'application/pdf'
            }
        ];

        const result = buildLastMessagePreview(messages);
        expect(result.lastMessageText).toBe('📎 File');
    });
});


describe('ChatList mobile preview layout', () => {
    it('uses a mobile-only last-message preview element', () => {
        const filePath = join(__dirname, 'ChatList.svelte');
        const content = readFileSync(filePath, 'utf8');
 
        // Ensure we render a conditional lastMessageText preview (item.lastMessageText for unified chat list)
        expect(content).toContain('item.lastMessageText');
 
        // Ensure the preview line is marked as mobile-only via md:hidden
        expect(content).toContain('truncate md:hidden');
    });
});

describe('ChatList header QR button', () => {
    it('renders a QR trigger next to the avatar', () => {
        const filePath = join(__dirname, 'ChatList.svelte');
        const content = readFileSync(filePath, 'utf8');
 
        expect(content).toContain('aria-label="Show nostr QR code"');
    });
});

describe('ChatList FAB button', () => {
    it('renders a FAB button to open contacts modal', () => {
        const filePath = join(__dirname, 'ChatList.svelte');
        const content = readFileSync(filePath, 'utf8');
 
        expect(content).toContain('showManageContactsModal');
        expect(content).toContain('chats.addContact');
    });
});
 

describe('ChatList Android native long-press behavior', () => {
    it('suppresses the WebView copy/share context menu', () => {
        const filePath = join(__dirname, 'ChatList.svelte');
        const content = readFileSync(filePath, 'utf8');
 
        expect(content).toContain('oncontextmenu');
        expect(content).toContain('onselectstart');
        expect(content).toContain('isAndroidApp');
    });
});

 

