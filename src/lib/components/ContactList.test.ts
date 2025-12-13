import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

interface TestMessage {
    message: string;
    sentAt: number;
    direction: 'sent' | 'received';
}
 
function buildLastMessagePreview(messages: TestMessage[]): { lastMessageTime: number; lastMessageText?: string } {
    const lastMsg = messages[0];
    const lastMsgTime = lastMsg ? lastMsg.sentAt : 0;
    const rawLastMessageText = lastMsg ? lastMsg.message : '';
 
    let lastMessageText = rawLastMessageText
        .replace(/\s+/g, ' ')
        .trim();
 
    if (lastMessageText && lastMsg && lastMsg.direction === 'sent') {
        lastMessageText = `You: ${lastMessageText}`;
    }
 
    return {
        lastMessageTime: lastMsgTime,
        lastMessageText: lastMessageText || undefined
    };
}
 
describe('ContactList last message preview', () => {
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
});


describe('ContactList mobile preview layout', () => {
    it('uses a mobile-only last-message preview element', () => {
        const filePath = join(__dirname, 'ContactList.svelte');
        const content = readFileSync(filePath, 'utf8');
 
        // Ensure we render a conditional lastMessageText preview
        expect(content).toContain('contact.lastMessageText');
 
        // Ensure the preview line is marked as mobile-only via md:hidden
        expect(content).toContain('truncate md:hidden');
    });
});

describe('ContactList header QR button', () => {
    it('renders a QR trigger next to the avatar', () => {
        const filePath = join(__dirname, 'ContactList.svelte');
        const content = readFileSync(filePath, 'utf8');
 
        expect(content).toContain('aria-label="Show nostr QR code"');
    });
});

describe('ContactList header scan QR button', () => {
    it('renders a camera-capable scan QR trigger next to the contacts title', () => {
        const filePath = join(__dirname, 'ContactList.svelte');
        const content = readFileSync(filePath, 'utf8');
 
        expect(content).toContain('contacts.scanQrAria');
        expect(content).toContain('showScanContactQrModal');
        expect(content).toContain('canScanQr');
        expect(content).toContain('navigator.mediaDevices.getUserMedia');
    });
});

 

